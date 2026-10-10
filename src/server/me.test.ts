import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { Counter } from "@/models/counter";
import { DeviceStat } from "@/models/device-stat";
import { Entry } from "@/models/entry";
import { RateLimit } from "@/models/rate-limit";
import { setupMemoryMongo } from "@/test/mongo";
import { addDurood, getTotals } from "./counter";
import { getMySummary } from "./me";
import { createRecoveryCode, restoreFromCode } from "./recovery";

setupMemoryMongo("noor_e_durood_me_test");

// Saturday 10 Oct 2026, noon in Karachi. The week started Monday 5 Oct.
const NOW = new Date("2026-10-10T07:00:00Z");
const at = (day: string) => new Date(`${day}T07:00:00Z`);

async function add(deviceId: string, count: number, day: string) {
  const result = await addDurood({
    deviceId,
    clientId: randomUUID(),
    count,
    mode: "tap",
    ipHash: randomUUID(),
    userAgentShort: "vitest",
    now: at(day),
  });
  expect(result.ok).toBe(true);
}

beforeEach(async () => {
  await getTotals(NOW);
  await Promise.all([
    Counter.deleteMany({}),
    Entry.deleteMany({}),
    DeviceStat.deleteMany({}),
    RateLimit.deleteMany({}),
  ]);
});

describe("getMySummary", () => {
  it("adds up today, this week, this month and all time", async () => {
    const me = randomUUID();
    await add(me, 10, "2026-10-10"); // today
    await add(me, 5, "2026-10-10");
    await add(me, 20, "2026-10-05"); // Monday, this week
    await add(me, 40, "2026-10-04"); // Sunday, last week, this month
    await add(me, 80, "2026-09-30"); // last month

    const s = await getMySummary(me, NOW);
    expect(s).toMatchObject({ today: 15, week: 35, month: 75, allTime: 155, hasRecoveryCode: false });
    expect(s.last7).toEqual([
      { day: "2026-10-04", count: 40 },
      { day: "2026-10-05", count: 20 },
      { day: "2026-10-06", count: 0 },
      { day: "2026-10-07", count: 0 },
      { day: "2026-10-08", count: 0 },
      { day: "2026-10-09", count: 0 },
      { day: "2026-10-10", count: 15 },
    ]);
  });

  it("only sees its own device and skips removed entries", async () => {
    const me = randomUUID();
    await add(me, 7, "2026-10-10");
    await add(randomUUID(), 1000, "2026-10-10");
    await add(me, 3, "2026-10-10");
    await Entry.updateOne({ deviceId: me, count: 3 }, { $set: { removed: true } });

    expect(await getMySummary(me, NOW)).toMatchObject({ today: 7, allTime: 7 });
  });

  it("is all zeros for a new device", async () => {
    const s = await getMySummary(randomUUID(), NOW);
    expect(s).toMatchObject({ today: 0, week: 0, month: 0, allTime: 0 });
    expect(s.last7).toHaveLength(7);
  });
});

describe("recovery codes", () => {
  it("links a second phone and moves its history over", async () => {
    const phoneA = randomUUID();
    const phoneB = randomUUID();
    await add(phoneA, 100, "2026-10-09");
    await add(phoneB, 30, "2026-10-10");

    const created = await createRecoveryCode(phoneA, NOW);
    if (!created.ok) throw new Error("expected a code");
    expect(created.code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);

    // Typed loosely on the other phone.
    const typed = `${created.code.slice(0, 4).toLowerCase()} - ${created.code.slice(4)}`;
    expect(await restoreFromCode(typed, phoneB, "ip", NOW)).toEqual({
      ok: true,
      deviceId: phoneA,
      merged: 30,
    });

    expect(await getMySummary(phoneA, NOW)).toMatchObject({
      today: 30,
      allTime: 130,
      hasRecoveryCode: true,
    });
    expect(await DeviceStat.findOne({ deviceId: phoneA }).lean()).toMatchObject({ totalCount: 130 });
    expect(await DeviceStat.countDocuments({ deviceId: phoneB })).toBe(0);
    // Shared totals are untouched by linking.
    expect(await getTotals(NOW)).toMatchObject({ total: 130 });
  });

  it("works for a device that has not added anything yet", async () => {
    const fresh = randomUUID();
    const created = await createRecoveryCode(fresh, NOW);
    if (!created.ok) throw new Error("expected a code");
    expect(await restoreFromCode(created.code, randomUUID(), "ip", NOW)).toMatchObject({
      ok: true,
      deviceId: fresh,
      merged: 0,
    });
  });

  it("restoring on the same device changes nothing", async () => {
    const me = randomUUID();
    await add(me, 5, "2026-10-10");
    const created = await createRecoveryCode(me, NOW);
    if (!created.ok) throw new Error("expected a code");
    expect(await restoreFromCode(created.code, me, "ip", NOW)).toEqual({
      ok: true,
      deviceId: me,
      merged: 0,
    });
  });

  it("a new code replaces the old one", async () => {
    const me = randomUUID();
    const first = await createRecoveryCode(me, NOW);
    const second = await createRecoveryCode(me, NOW);
    if (!first.ok || !second.ok) throw new Error("expected codes");

    expect(await restoreFromCode(first.code, randomUUID(), "ip", NOW)).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await restoreFromCode(second.code, randomUUID(), "ip", NOW)).toMatchObject({ ok: true });
  });

  it("rejects malformed codes without a database lookup", async () => {
    expect(await restoreFromCode("ABC", randomUUID(), "ip", NOW)).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await restoreFromCode("OOOO-IIII", randomUUID(), "ip", NOW)).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("slows down guessing from one IP", async () => {
    const results = [];
    for (let i = 0; i < 11; i++) {
      results.push(await restoreFromCode("ABCD-EFGH", randomUUID(), "guesser", NOW));
    }
    expect(results.slice(0, 10).every((r) => !r.ok && r.error === "not_found")).toBe(true);
    expect(results[10]).toEqual({ ok: false, error: "rate_limited" });
  });

  it("limits how often a device makes new codes", async () => {
    const me = randomUUID();
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await createRecoveryCode(me, NOW));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results[5]).toEqual({ ok: false, error: "rate_limited" });
  });
});

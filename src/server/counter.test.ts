import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_PER_DEVICE_PER_DAY,
  DEFAULT_MAX_PER_ENTRY,
  RATE_LIMIT_PER_DEVICE,
  RATE_LIMIT_PER_IP,
} from "@/lib/limits";
import { Counter } from "@/models/counter";
import { Entry } from "@/models/entry";
import { RateLimit } from "@/models/rate-limit";
import { User } from "@/models/user";
import { setupMemoryMongo } from "@/test/mongo";
import { createTestUser, createTestUsers } from "@/test/users";
import { addDurood, getTotals, type AddDuroodInput } from "./counter";
import { updateSettings } from "./settings";

setupMemoryMongo("noor_e_durood_test");

// 12:00 in Karachi on 10 Oct 2026.
const NOW = new Date("2026-10-10T07:00:00Z");

function submission(userId: string, overrides: Partial<AddDuroodInput> = {}): AddDuroodInput {
  return {
    userId,
    deviceId: randomUUID(),
    clientId: randomUUID(),
    count: 1,
    mode: "number",
    ipHash: randomUUID(),
    userAgentShort: "vitest",
    now: NOW,
    ...overrides,
  };
}

let user: string;

beforeEach(async () => {
  // Clear documents but keep indexes (the unique ones matter here).
  await getTotals(NOW);
  await Promise.all([
    Counter.deleteMany({}),
    Entry.deleteMany({}),
    User.deleteMany({}),
    RateLimit.deleteMany({}),
  ]);
  await updateSettings({
    maxPerEntry: DEFAULT_MAX_PER_ENTRY,
    maxPerDevicePerDay: DEFAULT_MAX_PER_DEVICE_PER_DAY,
    paused: false,
  });
  user = await createTestUser();
});

describe("atomic increments", () => {
  it("adds to the global, day and month counters", async () => {
    const result = await addDurood(submission(user, { count: 500 }));

    expect(result).toEqual({
      ok: true,
      duplicate: false,
      totals: { total: 500, today: 500, month: 500, dayKey: "2026-10-10" },
    });
    expect(await getTotals(NOW)).toEqual({
      total: 500,
      today: 500,
      month: 500,
      dayKey: "2026-10-10",
    });
    expect(await Counter.findById("day:2026-10-10").lean()).toMatchObject({ count: 500 });
    expect(await Counter.findById("month:2026-10").lean()).toMatchObject({ count: 500 });
  });

  it("counts every one of many parallel submissions", async () => {
    const users = await createTestUsers(100);
    const results = await Promise.all(users.map((u, i) => addDurood(submission(u, { count: i + 1 }))));

    expect(results.every((r) => r.ok)).toBe(true);
    expect(await getTotals(NOW)).toMatchObject({ total: 5050, today: 5050, month: 5050 });
    expect(await Entry.countDocuments()).toBe(100);
  });

  it("rolls over day and month at Karachi midnight", async () => {
    // 23:59 on 31 Oct and 00:00 on 1 Nov, Pakistan time.
    const lastMinute = new Date("2026-10-31T18:59:00Z");
    const firstMinute = new Date("2026-10-31T19:00:00Z");

    await addDurood(submission(user, { count: 10, now: lastMinute }));
    const result = await addDurood(submission(user, { count: 3, now: firstMinute }));

    expect(result).toMatchObject({
      ok: true,
      totals: { total: 13, today: 3, month: 3, dayKey: "2026-11-01" },
    });
    expect(await getTotals(lastMinute)).toMatchObject({ today: 10, month: 10 });
  });

  it("keeps the account's all-time total across days and phones", async () => {
    await addDurood(submission(user, { count: 7 }));
    await addDurood(submission(user, { count: 5, now: new Date("2026-10-11T07:00:00Z") }));

    expect(await User.findById(user).lean()).toMatchObject({ totalCount: 12, day: "2026-10-11", dayCount: 5 });
  });

  it("stores the user and their majlis on the entry", async () => {
    await addDurood(submission(user, { count: 2, majlisId: "6700000000000000000000aa" }));
    expect(await Entry.findOne().lean()).toMatchObject({ userId: user, majlisId: "6700000000000000000000aa" });
  });
});

describe("idempotency", () => {
  it("does not count a retried submission twice", async () => {
    const input = submission(user, { count: 33 });

    const first = await addDurood(input);
    const retry = await addDurood({ ...input });

    expect(first).toMatchObject({ ok: true, duplicate: false });
    expect(retry).toMatchObject({ ok: true, duplicate: true, totals: { total: 33 } });
    expect(await getTotals(NOW)).toMatchObject({ total: 33, today: 33, month: 33 });
    expect(await Entry.countDocuments()).toBe(1);
  });

  it("counts once even when retries arrive at the same time", async () => {
    const input = submission(user, { count: 100 });
    const results = await Promise.all(Array.from({ length: 10 }, () => addDurood({ ...input })));

    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && !r.duplicate)).toHaveLength(1);
    expect(await getTotals(NOW)).toMatchObject({ total: 100 });
    expect(await User.findById(user).lean()).toMatchObject({ totalCount: 100 });
  });
});

describe("limits", () => {
  it("rejects a count above maxPerEntry", async () => {
    const result = await addDurood(submission(user, { count: DEFAULT_MAX_PER_ENTRY + 1 }));

    expect(result).toEqual({ ok: false, error: "entry_limit", max: DEFAULT_MAX_PER_ENTRY });
    expect(await getTotals(NOW)).toMatchObject({ total: 0 });
    expect(await Entry.countDocuments()).toBe(0);
  });

  it("enforces the daily limit per account and leaves no trace of rejected entries", async () => {
    await updateSettings({ maxPerDevicePerDay: 1000 });

    expect(await addDurood(submission(user, { count: 600 }))).toMatchObject({ ok: true });
    expect(await addDurood(submission(user, { count: 500 }))).toEqual({
      ok: false,
      error: "daily_limit",
      max: 1000,
    });
    expect(await addDurood(submission(user, { count: 400 }))).toMatchObject({ ok: true });
    expect(await addDurood(submission(user, { count: 1 }))).toMatchObject({ ok: false, error: "daily_limit" });

    expect(await getTotals(NOW)).toMatchObject({ total: 1000 });
    expect(await Entry.countDocuments({ userId: user })).toBe(2);
    // Other accounts are not affected.
    expect(await addDurood(submission(await createTestUser(), { count: 5 }))).toMatchObject({ ok: true });
  });

  it("never lets parallel requests push an account past its daily limit", async () => {
    await updateSettings({ maxPerDevicePerDay: 100 });

    const results = await Promise.all(
      Array.from({ length: 20 }, () => addDurood(submission(user, { count: 10 }))),
    );

    expect(results.filter((r) => r.ok)).toHaveLength(10);
    expect(await getTotals(NOW)).toMatchObject({ total: 100 });
    expect(await User.findById(user).lean()).toMatchObject({ dayCount: 100 });
  });

  it("gives an account a fresh daily allowance the next Karachi day", async () => {
    await updateSettings({ maxPerDevicePerDay: 50 });

    await addDurood(submission(user, { count: 50 }));
    expect(await addDurood(submission(user, { count: 1 }))).toMatchObject({ error: "daily_limit" });

    const tomorrow = new Date("2026-10-10T19:00:00Z");
    expect(await addDurood(submission(user, { count: 50, now: tomorrow }))).toMatchObject({
      ok: true,
      totals: { today: 50, total: 100 },
    });
  });

  it("refuses a disabled account", async () => {
    await User.updateOne({ _id: user }, { $set: { disabled: true } });
    expect(await addDurood(submission(user, { count: 5 }))).toEqual({ ok: false, error: "blocked" });
    expect(await Entry.countDocuments()).toBe(0);
  });

  it("rate limits a single account per minute", async () => {
    const results = [];
    for (let i = 0; i < RATE_LIMIT_PER_DEVICE + 1; i++) {
      results.push(await addDurood(submission(user)));
    }

    expect(results.slice(0, -1).every((r) => r.ok)).toBe(true);
    expect(results.at(-1)).toEqual({ ok: false, error: "rate_limited" });

    // The next minute is a new window.
    const nextMinute = new Date(NOW.getTime() + 60_000);
    expect(await addDurood(submission(user, { now: nextMinute }))).toMatchObject({ ok: true });
  });

  it("rate limits a single IP hash across accounts", async () => {
    const ipHash = randomUUID();
    const users = await createTestUsers(RATE_LIMIT_PER_IP + 5);
    const results = await Promise.all(users.map((u) => addDurood(submission(u, { ipHash }))));

    expect(results.filter((r) => r.ok)).toHaveLength(RATE_LIMIT_PER_IP);
    expect(await getTotals(NOW)).toMatchObject({ total: RATE_LIMIT_PER_IP });
  });

  it("refuses submissions while the site is paused", async () => {
    await updateSettings({ paused: true });

    expect(await addDurood(submission(user, { count: 5 }))).toEqual({ ok: false, error: "paused" });
    expect(await getTotals(NOW)).toMatchObject({ total: 0 });
  });
});

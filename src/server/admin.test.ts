import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { Counter } from "@/models/counter";
import { DeviceStat } from "@/models/device-stat";
import { Entry } from "@/models/entry";
import { RateLimit } from "@/models/rate-limit";
import { setupMemoryMongo } from "@/test/mongo";
import {
  blockDevice,
  getDashboard,
  listBlockedDevices,
  listEntries,
  recalculateTotals,
  removeEntry,
  unblockDevice,
} from "./admin";
import { addDurood, getTotals } from "./counter";

setupMemoryMongo("noor_e_durood_admin_test");

const NOW = new Date("2026-10-10T07:00:00Z");
const at = (iso: string) => new Date(iso);

async function add(deviceId: string, count: number, now: Date = NOW) {
  const r = await addDurood({
    deviceId,
    clientId: randomUUID(),
    count,
    mode: "number",
    ipHash: randomUUID(),
    userAgentShort: "vitest",
    now,
  });
  if (!r.ok) throw new Error(`add failed: ${r.error}`);
  return r;
}

async function entryIdFor(deviceId: string, count: number) {
  const e = await Entry.findOne({ deviceId, count }).lean();
  if (!e) throw new Error("entry not found");
  return e._id.toString();
}

const submit = (deviceId: string, count: number) =>
  addDurood({
    deviceId,
    clientId: randomUUID(),
    count,
    mode: "tap",
    ipHash: "ip",
    userAgentShort: "",
    now: NOW,
  });

beforeEach(async () => {
  await getTotals(NOW);
  await Promise.all([
    Counter.deleteMany({}),
    Entry.deleteMany({}),
    DeviceStat.deleteMany({}),
    RateLimit.deleteMany({}),
  ]);
});

describe("removeEntry", () => {
  it("takes the count back off every counter and the device", async () => {
    const spammer = randomUUID();
    await add(randomUUID(), 100);
    await add(spammer, 9000);
    const id = await entryIdFor(spammer, 9000);

    expect(await removeEntry(id, "spam", NOW)).toEqual({ ok: true, count: 9000 });
    expect(await getTotals(NOW)).toMatchObject({ total: 100, today: 100, month: 100 });
    expect(await DeviceStat.findOne({ deviceId: spammer }).lean()).toMatchObject({
      totalCount: 0,
      dayCount: 0,
    });
    expect(await Entry.findById(id).lean()).toMatchObject({ removed: true, removedReason: "spam" });
  });

  it("only ever subtracts once, even when clicked twice at the same time", async () => {
    const device = randomUUID();
    await add(device, 500);
    await add(device, 20);
    const id = await entryIdFor(device, 500);

    const results = await Promise.all([removeEntry(id, "first", NOW), removeEntry(id, "second", NOW)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await getTotals(NOW)).toMatchObject({ total: 20 });
  });

  it("fixes the right day and month for an older entry", async () => {
    const device = randomUUID();
    await add(device, 70, at("2026-09-30T07:00:00Z"));
    await add(device, 5, NOW);
    const id = await entryIdFor(device, 70);

    await removeEntry(id, "old spam", NOW);
    expect(await Counter.findById("day:2026-09-30").lean()).toMatchObject({ count: 0 });
    expect(await Counter.findById("month:2026-09").lean()).toMatchObject({ count: 0 });
    expect(await getTotals(NOW)).toMatchObject({ total: 5, today: 5, month: 5 });
    // The device is on a later day now: only its all-time total changes.
    expect(await DeviceStat.findOne({ deviceId: device }).lean()).toMatchObject({
      totalCount: 5,
      dayCount: 5,
    });
  });

  it("hides removed entries from the list unless asked", async () => {
    const device = randomUUID();
    await add(device, 3);
    await removeEntry(await entryIdFor(device, 3), "test", NOW);
    expect((await listEntries({}, NOW)).entries).toHaveLength(0);
    expect((await listEntries({ showRemoved: true }, NOW)).entries).toHaveLength(1);
  });

  it("filters the list by size and by the start of a device id", async () => {
    const big = randomUUID();
    await add(big, 800);
    await add(randomUUID(), 2);
    expect((await listEntries({ minCount: 100 }, NOW)).entries.map((e) => e.count)).toEqual([800]);
    expect((await listEntries({ device: big.slice(0, 8) }, NOW)).entries).toHaveLength(1);
  });
});

describe("blocking", () => {
  it("stops a device from submitting until unblocked", async () => {
    const device = randomUUID();
    await add(device, 10);
    await blockDevice(device, "abuse", NOW);

    expect(await submit(device, 5)).toEqual({ ok: false, error: "blocked" });
    expect(await getTotals(NOW)).toMatchObject({ total: 10 });
    expect(await Entry.countDocuments({ deviceId: device })).toBe(1);
    expect(await listBlockedDevices()).toMatchObject([{ deviceId: device, reason: "abuse" }]);

    await unblockDevice(device);
    await add(device, 5);
    expect(await getTotals(NOW)).toMatchObject({ total: 15 });
  });

  it("can block a device before it ever submits", async () => {
    const device = randomUUID();
    await blockDevice(device, "pre-emptive", NOW);
    expect(await submit(device, 1)).toEqual({ ok: false, error: "blocked" });
  });
});

describe("recalculateTotals", () => {
  it("rebuilds counters from non-removed entries", async () => {
    const device = randomUUID();
    await add(device, 40, at("2026-09-29T07:00:00Z"));
    await add(device, 60, NOW);
    await add(device, 7, NOW);
    await removeEntry(await entryIdFor(device, 7), "test", NOW);

    // Simulate drift: a counter edited by hand and a stray document.
    await Counter.updateOne({ _id: "global" }, { $set: { count: 999 } });
    await Counter.create({ _id: "day:2026-01-01", count: 5 });

    const result = await recalculateTotals();
    expect(result).toMatchObject({ total: 100, corrected: 2 });
    expect(await getTotals(NOW)).toMatchObject({ total: 100, today: 60, month: 60 });
    expect(await Counter.findById("month:2026-09").lean()).toMatchObject({ count: 40 });
    expect(await Counter.findById("day:2026-01-01").lean()).toBeNull();
  });
});

describe("getDashboard", () => {
  it("summarises today without exposing IP data", async () => {
    const a = randomUUID();
    await add(a, 30, at("2026-10-10T04:10:00Z")); // 09:10 Karachi
    await add(a, 12, at("2026-10-10T07:30:00Z")); // 12:30
    await add(randomUUID(), 5000, at("2026-10-10T07:45:00Z")); // 12:45

    const d = await getDashboard(at("2026-10-10T08:00:00Z"));
    expect(d.totals).toMatchObject({ today: 5042 });
    expect(d.activeDevicesToday).toBe(2);
    expect(d.entriesToday).toBe(3);
    expect(d.perHour[9]).toBe(30);
    expect(d.perHour[12]).toBe(5012);
    expect(d.currentHour).toBe(13);
    expect(d.last30).toHaveLength(30);
    expect(d.topEntries[0]).toMatchObject({ count: 5000 });
    expect(JSON.stringify(d)).not.toContain("ipHash");
  });
});

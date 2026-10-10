import { randomUUID } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_PER_DEVICE_PER_DAY,
  DEFAULT_MAX_PER_ENTRY,
  RATE_LIMIT_PER_DEVICE,
  RATE_LIMIT_PER_IP,
} from "@/lib/limits";
import { Counter } from "@/models/counter";
import { DeviceStat } from "@/models/device-stat";
import { Entry } from "@/models/entry";
import { RateLimit } from "@/models/rate-limit";
import { addDurood, getTotals, type AddDuroodInput } from "./counter";
import { updateSettings } from "./settings";

// 12:00 in Karachi on 10 Oct 2026.
const NOW = new Date("2026-10-10T07:00:00Z");

let mongo: MongoMemoryServer;

function submission(overrides: Partial<AddDuroodInput> = {}): AddDuroodInput {
  return {
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

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  // getEnv() is lazy, so setting these before the first call is enough.
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = "noor_e_durood_test";
  process.env.IP_HASH_SALT = "test-salt-test-salt";
  process.env.ADMIN_PASSWORD = "test-password";
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

beforeEach(async () => {
  // Clear documents but keep indexes (the unique ones matter here).
  await getTotals(NOW);
  await Promise.all([
    Counter.deleteMany({}),
    Entry.deleteMany({}),
    DeviceStat.deleteMany({}),
    RateLimit.deleteMany({}),
  ]);
  await updateSettings({
    maxPerEntry: DEFAULT_MAX_PER_ENTRY,
    maxPerDevicePerDay: DEFAULT_MAX_PER_DEVICE_PER_DAY,
    paused: false,
  });
});

describe("atomic increments", () => {
  it("adds to the global, day and month counters", async () => {
    const result = await addDurood(submission({ count: 500 }));

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
    const counts = Array.from({ length: 100 }, (_, i) => i + 1);
    const results = await Promise.all(
      counts.map((count) => addDurood(submission({ count }))),
    );

    expect(results.every((r) => r.ok)).toBe(true);
    expect(await getTotals(NOW)).toMatchObject({
      total: 5050,
      today: 5050,
      month: 5050,
    });
    expect(await Entry.countDocuments()).toBe(100);
  });

  it("rolls over day and month at Karachi midnight", async () => {
    // 23:59 on 31 Oct and 00:00 on 1 Nov, Pakistan time.
    const lastMinute = new Date("2026-10-31T18:59:00Z");
    const firstMinute = new Date("2026-10-31T19:00:00Z");

    await addDurood(submission({ count: 10, now: lastMinute }));
    const result = await addDurood(submission({ count: 3, now: firstMinute }));

    expect(result).toMatchObject({
      ok: true,
      totals: { total: 13, today: 3, month: 3, dayKey: "2026-11-01" },
    });
    expect(await getTotals(lastMinute)).toMatchObject({ today: 10, month: 10 });
  });

  it("keeps a device's all-time total across days", async () => {
    const deviceId = randomUUID();
    await addDurood(submission({ deviceId, count: 7 }));
    await addDurood(
      submission({ deviceId, count: 5, now: new Date("2026-10-11T07:00:00Z") }),
    );

    expect(await DeviceStat.findOne({ deviceId }).lean()).toMatchObject({
      totalCount: 12,
      day: "2026-10-11",
      dayCount: 5,
    });
  });
});

describe("idempotency", () => {
  it("does not count a retried submission twice", async () => {
    const input = submission({ count: 33 });

    const first = await addDurood(input);
    const retry = await addDurood({ ...input });

    expect(first).toMatchObject({ ok: true, duplicate: false });
    expect(retry).toMatchObject({ ok: true, duplicate: true, totals: { total: 33 } });
    expect(await getTotals(NOW)).toMatchObject({ total: 33, today: 33, month: 33 });
    expect(await Entry.countDocuments()).toBe(1);
  });

  it("counts once even when retries arrive at the same time", async () => {
    const input = submission({ count: 100 });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => addDurood({ ...input })),
    );

    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.filter((r) => r.ok && !r.duplicate)).toHaveLength(1);
    expect(await getTotals(NOW)).toMatchObject({ total: 100 });
    expect(await DeviceStat.findOne({ deviceId: input.deviceId }).lean()).toMatchObject({
      totalCount: 100,
    });
  });
});

describe("limits", () => {
  it("rejects a count above maxPerEntry", async () => {
    const result = await addDurood(submission({ count: DEFAULT_MAX_PER_ENTRY + 1 }));

    expect(result).toEqual({
      ok: false,
      error: "entry_limit",
      max: DEFAULT_MAX_PER_ENTRY,
    });
    expect(await getTotals(NOW)).toMatchObject({ total: 0 });
    expect(await Entry.countDocuments()).toBe(0);
  });

  it("enforces maxPerDevicePerDay and leaves no trace of rejected entries", async () => {
    await updateSettings({ maxPerDevicePerDay: 1000 });
    const deviceId = randomUUID();

    expect(await addDurood(submission({ deviceId, count: 600 }))).toMatchObject({ ok: true });
    expect(await addDurood(submission({ deviceId, count: 500 }))).toEqual({
      ok: false,
      error: "daily_limit",
      max: 1000,
    });
    expect(await addDurood(submission({ deviceId, count: 400 }))).toMatchObject({ ok: true });
    expect(await addDurood(submission({ deviceId, count: 1 }))).toMatchObject({
      ok: false,
      error: "daily_limit",
    });

    expect(await getTotals(NOW)).toMatchObject({ total: 1000 });
    expect(await Entry.countDocuments({ deviceId })).toBe(2);
    // Other devices are not affected.
    expect(await addDurood(submission({ count: 5 }))).toMatchObject({ ok: true });
  });

  it("never lets parallel requests push a device past its daily limit", async () => {
    await updateSettings({ maxPerDevicePerDay: 100 });
    const deviceId = randomUUID();

    const results = await Promise.all(
      Array.from({ length: 20 }, () => addDurood(submission({ deviceId, count: 10 }))),
    );

    expect(results.filter((r) => r.ok)).toHaveLength(10);
    expect(await getTotals(NOW)).toMatchObject({ total: 100 });
    expect(await DeviceStat.findOne({ deviceId }).lean()).toMatchObject({ dayCount: 100 });
  });

  it("gives a device a fresh daily allowance the next Karachi day", async () => {
    await updateSettings({ maxPerDevicePerDay: 50 });
    const deviceId = randomUUID();

    await addDurood(submission({ deviceId, count: 50 }));
    expect(await addDurood(submission({ deviceId, count: 1 }))).toMatchObject({
      error: "daily_limit",
    });

    const tomorrow = new Date("2026-10-10T19:00:00Z");
    expect(
      await addDurood(submission({ deviceId, count: 50, now: tomorrow })),
    ).toMatchObject({ ok: true, totals: { today: 50, total: 100 } });
  });

  it("rate limits a single device per minute", async () => {
    const deviceId = randomUUID();
    const results = [];
    for (let i = 0; i < RATE_LIMIT_PER_DEVICE + 1; i++) {
      results.push(await addDurood(submission({ deviceId })));
    }

    expect(results.slice(0, -1).every((r) => r.ok)).toBe(true);
    expect(results.at(-1)).toEqual({ ok: false, error: "rate_limited" });

    // The next minute is a new window.
    const nextMinute = new Date(NOW.getTime() + 60_000);
    expect(await addDurood(submission({ deviceId, now: nextMinute }))).toMatchObject({
      ok: true,
    });
  });

  it("rate limits a single IP hash across devices", async () => {
    const ipHash = randomUUID();
    const results = await Promise.all(
      Array.from({ length: RATE_LIMIT_PER_IP + 5 }, () =>
        addDurood(submission({ ipHash })),
      ),
    );

    expect(results.filter((r) => r.ok)).toHaveLength(RATE_LIMIT_PER_IP);
    expect(await getTotals(NOW)).toMatchObject({ total: RATE_LIMIT_PER_IP });
  });

  it("refuses submissions while the site is paused", async () => {
    await updateSettings({ paused: true });

    expect(await addDurood(submission({ count: 5 }))).toEqual({
      ok: false,
      error: "paused",
    });
    expect(await getTotals(NOW)).toMatchObject({ total: 0 });
  });
});

import "server-only";
import { counterIds, karachiDay } from "@/lib/date";
import { RATE_LIMIT_PER_DEVICE, RATE_LIMIT_PER_IP } from "@/lib/limits";
import type { DuroodMode, SubmitErrorCode, Totals } from "@/lib/types";
import { Counter, type CounterDoc } from "@/models/counter";
import { DeviceStat } from "@/models/device-stat";
import { Entry } from "@/models/entry";
import { hitRateLimit } from "./rate-limit";
import { ready } from "./ready";
import { getSettings } from "./settings";

export type AddDuroodInput = {
  deviceId: string;
  clientId: string;
  count: number;
  mode: DuroodMode;
  ipHash: string;
  userAgentShort: string;
  now?: Date;
};

export type AddDuroodResult =
  | { ok: true; totals: Totals; duplicate: boolean }
  | { ok: false; error: SubmitErrorCode; max?: number };

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/** Current public totals for the Karachi day/month containing `now`. */
export async function getTotals(now: Date = new Date()): Promise<Totals> {
  await ready();
  const ids = {
    total: counterIds.global,
    today: counterIds.day(now),
    month: counterIds.month(now),
  };
  const docs = await Counter.find({
    _id: { $in: Object.values(ids) },
  }).lean<CounterDoc[]>();
  const byId = new Map(docs.map((d) => [d._id, d.count]));

  return {
    total: byId.get(ids.total) ?? 0,
    today: byId.get(ids.today) ?? 0,
    month: byId.get(ids.month) ?? 0,
    dayKey: karachiDay(now),
  };
}

/**
 * Reserves `count` from the device's daily allowance in one atomic step, so
 * parallel requests can never push a device past the limit.
 */
async function reserveDeviceQuota(
  deviceId: string,
  count: number,
  limit: number,
  day: string,
  now: Date,
): Promise<boolean> {
  if (count > limit) return false;

  for (let attempt = 0; attempt < 2; attempt++) {
    // Same day, enough room left.
    const sameDay = await DeviceStat.updateOne(
      { deviceId, day, dayCount: { $lte: limit - count } },
      { $inc: { dayCount: count, totalCount: count }, $set: { lastEntryAt: now } },
    );
    if (sameDay.matchedCount === 1) return true;

    // First entry of a new day: start the day's count fresh.
    const newDay = await DeviceStat.updateOne(
      { deviceId, day: { $ne: day } },
      {
        $set: { day, dayCount: count, lastEntryAt: now },
        $inc: { totalCount: count },
      },
    );
    if (newDay.matchedCount === 1) return true;

    // Brand new device. If another request created it first, loop once more.
    try {
      await DeviceStat.create({
        deviceId,
        day,
        dayCount: count,
        totalCount: count,
        lastEntryAt: now,
      });
      return true;
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }

  // The document exists for today and has no room left.
  return false;
}

async function incrementCounters(count: number, now: Date): Promise<Totals> {
  const inc = (id: string) =>
    Counter.findOneAndUpdate(
      { _id: id },
      { $inc: { count } },
      { upsert: true, returnDocument: "after" },
    ).lean<CounterDoc>();

  const [total, today, month] = await Promise.all([
    inc(counterIds.global),
    inc(counterIds.day(now)),
    inc(counterIds.month(now)),
  ]);

  return {
    total: total.count,
    today: today.count,
    month: month.count,
    dayKey: karachiDay(now),
  };
}

/**
 * Adds a submission. Order matters:
 * 1. rate limits (per device and per IP hash)
 * 2. insert the Entry; its unique clientId makes retries a no-op
 * 3. reserve the device's daily allowance (undo the Entry if it is full)
 * 4. $inc the global, day and month counters
 */
export async function addDurood(input: AddDuroodInput): Promise<AddDuroodResult> {
  const now = input.now ?? new Date();
  const day = karachiDay(now);

  await ready();
  const settings = await getSettings();

  if (settings.paused) return { ok: false, error: "paused" };
  if (input.count > settings.maxPerEntry) {
    return { ok: false, error: "entry_limit", max: settings.maxPerEntry };
  }

  const [deviceOk, ipOk] = await Promise.all([
    hitRateLimit(`dev:${input.deviceId}`, RATE_LIMIT_PER_DEVICE, now),
    hitRateLimit(`ip:${input.ipHash}`, RATE_LIMIT_PER_IP, now),
  ]);
  if (!deviceOk || !ipOk) return { ok: false, error: "rate_limited" };

  try {
    await Entry.create({
      clientId: input.clientId,
      deviceId: input.deviceId,
      count: input.count,
      mode: input.mode,
      day,
      createdAt: now,
      ipHash: input.ipHash,
      userAgentShort: input.userAgentShort,
    });
  } catch (error) {
    if (isDuplicateKey(error)) {
      // Already counted (a retry of the same submission).
      return { ok: true, totals: await getTotals(now), duplicate: true };
    }
    throw error;
  }

  const reserved = await reserveDeviceQuota(
    input.deviceId,
    input.count,
    settings.maxPerDevicePerDay,
    day,
    now,
  ).catch(async (error: unknown) => {
    await Entry.deleteOne({ clientId: input.clientId });
    throw error;
  });

  if (!reserved) {
    await Entry.deleteOne({ clientId: input.clientId });
    return { ok: false, error: "daily_limit", max: settings.maxPerDevicePerDay };
  }

  const totals = await incrementCounters(input.count, now);
  return { ok: true, totals, duplicate: false };
}

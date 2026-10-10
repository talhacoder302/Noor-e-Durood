import "server-only";
import { counterIds, karachiDay } from "@/lib/date";
import { RATE_LIMIT_PER_DEVICE, RATE_LIMIT_PER_IP } from "@/lib/limits";
import type { DuroodMode, SubmitErrorCode, Totals } from "@/lib/types";
import { Counter, type CounterDoc } from "@/models/counter";
import { Entry } from "@/models/entry";
import { User } from "@/models/user";
import { hitRateLimit } from "./rate-limit";
import { ready } from "./ready";
import { getSettings } from "./settings";

export type AddDuroodInput = {
  /** The logged-in account; submitting needs one. */
  userId: string;
  /** The account's majlis right now, stored on the entry. */
  majlisId?: string;
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
 * Reserves `count` from the user's daily allowance in one atomic step, so
 * parallel requests can never push an account past the limit. Disabled
 * accounts never match.
 */
async function reserveUserQuota(
  userId: string,
  count: number,
  limit: number,
  day: string,
  now: Date,
): Promise<"ok" | "full" | "blocked"> {
  // Bigger than a whole day's allowance: refuse before touching anything.
  if (count > limit) return "full";

  // Twice: if a parallel request starts the new day between our two updates,
  // the second round finds it with the same-day update.
  for (let attempt = 0; attempt < 2; attempt++) {
    // Same day, enough room left.
    const sameDay = await User.updateOne(
      { _id: userId, day, dayCount: { $lte: limit - count }, disabled: { $ne: true } },
      { $inc: { dayCount: count, totalCount: count }, $set: { lastEntryAt: now } },
    );
    if (sameDay.matchedCount === 1) return "ok";

    // First entry of a new day: start the day's count fresh.
    const newDay = await User.updateOne(
      { _id: userId, day: { $ne: day }, disabled: { $ne: true } },
      { $set: { day, dayCount: count, lastEntryAt: now }, $inc: { totalCount: count } },
    );
    if (newDay.matchedCount === 1) return "ok";
  }

  // Either disabled by an admin or no room left today.
  const user = await User.findById(userId, { disabled: 1 }).lean();
  return !user || user.disabled ? "blocked" : "full";
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
 * 1. rate limits (per account and per IP hash)
 * 2. insert the Entry; its unique clientId makes retries a no-op
 * 3. reserve the account's daily allowance (undo the Entry if it is full)
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

  const [userOk, ipOk] = await Promise.all([
    hitRateLimit(`user:${input.userId}`, RATE_LIMIT_PER_DEVICE, now),
    hitRateLimit(`ip:${input.ipHash}`, RATE_LIMIT_PER_IP, now),
  ]);
  if (!userOk || !ipOk) return { ok: false, error: "rate_limited" };

  try {
    await Entry.create({
      clientId: input.clientId,
      deviceId: input.deviceId,
      userId: input.userId,
      ...(input.majlisId ? { majlisId: input.majlisId } : {}),
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

  const reserved = await reserveUserQuota(
    input.userId,
    input.count,
    settings.maxPerDevicePerDay,
    day,
    now,
  ).catch(async (error: unknown) => {
    await Entry.deleteOne({ clientId: input.clientId });
    throw error;
  });

  if (reserved !== "ok") {
    await Entry.deleteOne({ clientId: input.clientId });
    return reserved === "blocked"
      ? { ok: false, error: "blocked" }
      : { ok: false, error: "daily_limit", max: settings.maxPerDevicePerDay };
  }

  const totals = await incrementCounters(input.count, now);
  return { ok: true, totals, duplicate: false };
}

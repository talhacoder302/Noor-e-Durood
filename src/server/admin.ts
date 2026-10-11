import "server-only";
import bcrypt from "bcryptjs";
import { APP_TIME_ZONE, counterIds, karachiDay, karachiMonth, lastDays } from "@/lib/date";
import { normalizePhone } from "@/lib/phone";
import { isValidPinFormat, normalizePin } from "@/lib/pin";
import type { DuroodMode, Totals } from "@/lib/types";
import { Counter, type CounterDoc } from "@/models/counter";
import { DeviceStat } from "@/models/device-stat";
import { Entry, type EntryDoc } from "@/models/entry";
import { Majlis, type MajlisDoc } from "@/models/majlis";
import { User, type UserDoc } from "@/models/user";
import { getTotals } from "./counter";
import { ready } from "./ready";
import { deleteAllSessions } from "./session";

// Admin-only reads and writes. Phone numbers and device ids appear here;
// IP hashes and PIN hashes never leave the server.

export type AdminUserRef = { id: string; name: string; phone: string; disabled: boolean };

export type AdminEntry = {
  id: string;
  count: number;
  mode: DuroodMode;
  day: string;
  createdAt: string;
  deviceId: string;
  user: AdminUserRef | null;
  majlisName: string | null;
  userAgentShort: string;
  removed: boolean;
  removedReason?: string;
};

type EntryLean = EntryDoc & { _id: { toString(): string } };

const notRemoved = { removed: { $ne: true } };

async function majlisNames(ids: (string | undefined)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!unique.length) return new Map();
  const docs = await Majlis.find({ _id: { $in: unique } }, { name: 1 }).lean<MajlisDoc[]>();
  return new Map(docs.map((m) => [m._id.toString(), m.name]));
}

/** Entries with their user and majlis filled in (two batched lookups). */
async function withRefs(rows: EntryLean[]): Promise<AdminEntry[]> {
  const userIds = [...new Set(rows.map((e) => e.userId).filter((id): id is string => Boolean(id)))];
  const [users, majalis] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } }, { name: 1, phone: 1, disabled: 1 }).lean<UserDoc[]>()
      : Promise.resolve([] as UserDoc[]),
    majlisNames(rows.map((e) => e.majlisId)),
  ]);
  const byId = new Map(users.map((u) => [u._id.toString(), u]));

  return rows.map((e) => {
    const u = e.userId ? byId.get(e.userId) : undefined;
    return {
      id: e._id.toString(),
      count: e.count,
      mode: e.mode,
      day: e.day,
      createdAt: e.createdAt.toISOString(),
      deviceId: e.deviceId,
      user: u ? { id: u._id.toString(), name: u.name ?? "", phone: u.phone, disabled: Boolean(u.disabled) } : null,
      majlisName: e.majlisId ? (majalis.get(e.majlisId) ?? null) : null,
      userAgentShort: e.userAgentShort,
      removed: Boolean(e.removed),
      removedReason: e.removedReason,
    };
  });
}

export type MajlisTotal = { id: string | null; name: string | null; count: number; users: number };

export type Dashboard = {
  totals: Totals;
  activeUsersToday: number;
  entriesToday: number;
  /** 24 values, Karachi hours 0–23. */
  perHour: number[];
  /** Current Karachi hour, so the chart opens on it. */
  currentHour: number;
  last30: { day: string; count: number }[];
  topEntries: AdminEntry[];
  users: number;
  newUsersToday: number;
  disabledUsers: number;
  /** This month, biggest first; `id: null` is "no majlis / other". */
  majlisThisMonth: MajlisTotal[];
};

export async function getDashboard(now: Date = new Date()): Promise<Dashboard> {
  await ready();
  const today = karachiDay(now);
  const month = karachiMonth(now);
  const days30 = lastDays(30, today);
  const days7 = days30.slice(-7);
  // Karachi midnight today, for "new users today".
  const startOfToday = new Date(`${today}T00:00:00+05:00`);

  const [totals, activeUsers, hours, counters, top, users, newUsersToday, disabledUsers, byMajlis] =
    await Promise.all([
      getTotals(now),
      Entry.distinct("userId", { day: today, userId: { $exists: true }, ...notRemoved }),
      Entry.aggregate<{ _id: number; count: number; entries: number }>([
        { $match: { day: today, ...notRemoved } },
        {
          $group: {
            _id: { $hour: { date: "$createdAt", timezone: APP_TIME_ZONE } },
            count: { $sum: "$count" },
            entries: { $sum: 1 },
          },
        },
      ]),
      Counter.find({ _id: { $in: days30.map((d) => `day:${d}`) } }).lean<CounterDoc[]>(),
      Entry.find({ day: { $in: days7 } }).sort({ count: -1 }).limit(10).lean<EntryLean[]>(),
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      User.countDocuments({ disabled: true }),
      Entry.aggregate<{ _id: string | null; count: number; users: string[] }>([
        { $match: { day: { $regex: `^${month}` }, userId: { $exists: true }, ...notRemoved } },
        { $group: { _id: { $ifNull: ["$majlisId", null] }, count: { $sum: "$count" }, users: { $addToSet: "$userId" } } },
        { $sort: { count: -1 } },
        { $limit: 30 },
      ]),
    ]);

  const perHour = Array.from({ length: 24 }, () => 0);
  let entriesToday = 0;
  for (const h of hours) {
    perHour[h._id] = h.count;
    entriesToday += h.entries;
  }
  const byDay = new Map(counters.map((c) => [c._id.slice(4), c.count]));
  const names = await majlisNames(byMajlis.map((m) => m._id ?? undefined));

  return {
    totals,
    activeUsersToday: activeUsers.length,
    entriesToday,
    perHour,
    currentHour:
      Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: APP_TIME_ZONE }).format(now)) % 24,
    last30: days30.map((day) => ({ day, count: byDay.get(day) ?? 0 })),
    topEntries: await withRefs(top),
    users,
    newUsersToday,
    disabledUsers,
    majlisThisMonth: byMajlis.map((m) => ({
      id: m._id,
      name: m._id ? (names.get(m._id) ?? null) : null,
      count: m.count,
      users: m.users.length,
    })),
  };
}

export type EntryFilter = {
  minCount?: number;
  /** Full device id or the start of one. */
  device?: string;
  /** A user's id (from a link in the list). */
  userId?: string;
  /** A phone number in any format. */
  phone?: string;
  /** Only entries from the last N hours. */
  hours?: number;
  showRemoved?: boolean;
  /** Pagination: entries older than this. */
  before?: Date;
};

const PAGE_SIZE = 50;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listEntries(filter: EntryFilter, now: Date = new Date()) {
  await ready();
  const query: Record<string, unknown> = {};
  const createdAt: Record<string, Date> = {};
  if (filter.hours) createdAt.$gte = new Date(now.getTime() - filter.hours * 3_600_000);
  if (filter.before) createdAt.$lt = filter.before;
  if (Object.keys(createdAt).length) query.createdAt = createdAt;
  if (filter.minCount) query.count = { $gte: filter.minCount };
  if (filter.device) query.deviceId = { $regex: `^${escapeRegex(filter.device.toLowerCase())}` };
  if (filter.userId) query.userId = filter.userId;
  if (filter.phone) {
    const phone = normalizePhone(filter.phone);
    const user = phone ? await User.findOne({ phone }, { _id: 1 }).lean<UserDoc>() : null;
    // Unknown number: match nothing rather than everything.
    query.userId = user ? user._id.toString() : "none";
  }
  if (!filter.showRemoved) Object.assign(query, notRemoved);

  const rows = await Entry.find(query)
    .sort({ createdAt: -1 })
    .limit(PAGE_SIZE + 1)
    .lean<EntryLean[]>();

  const entries = await withRefs(rows.slice(0, PAGE_SIZE));
  return {
    entries,
    nextBefore: rows.length > PAGE_SIZE ? entries[entries.length - 1].createdAt : null,
  };
}

export type RemoveResult = { ok: true; count: number } | { ok: false; error: "not_found" };

/**
 * Marks an entry removed (once only) and takes its count back off the
 * global, day and month counters and the user's totals, all with $inc.
 */
export async function removeEntry(id: string, reason: string, now: Date = new Date()): Promise<RemoveResult> {
  await ready();
  // The filter makes this a one-time switch even if two admins click at once.
  const entry = await Entry.findOneAndUpdate(
    { _id: id, removed: { $ne: true } },
    { $set: { removed: true, removedReason: reason, removedAt: now } },
  ).lean<EntryLean>();
  if (!entry) return { ok: false, error: "not_found" };

  const back = { $inc: { count: -entry.count } };
  await Promise.all([
    Counter.updateOne({ _id: counterIds.global }, back),
    Counter.updateOne({ _id: `day:${entry.day}` }, back),
    Counter.updateOne({ _id: `month:${entry.day.slice(0, 7)}` }, back),
  ]);

  // Owner's totals: the account, or (for entries from before accounts) the
  // device. If they've moved on to a later day, only the all-time total changes.
  const both = { $inc: { totalCount: -entry.count, dayCount: -entry.count } };
  const totalOnly = { $inc: { totalCount: -entry.count } };
  if (entry.userId) {
    const r = await User.updateOne({ _id: entry.userId, day: entry.day }, both);
    if (r.matchedCount === 0) await User.updateOne({ _id: entry.userId }, totalOnly);
  } else {
    const r = await DeviceStat.updateOne({ deviceId: entry.deviceId, day: entry.day }, both);
    if (r.matchedCount === 0) await DeviceStat.updateOne({ deviceId: entry.deviceId }, totalOnly);
  }
  return { ok: true, count: entry.count };
}

// Users

export type AdminUser = {
  id: string;
  phone: string;
  name: string;
  majlisName: string | null;
  majlisOther: string;
  age: number | null;
  city: string;
  totalCount: number;
  createdAt: string;
  lastLoginAt: string | null;
  disabled: boolean;
  disabledReason: string;
  locked: boolean;
  isAdmin: boolean;
};

export type UserFilter = {
  /** Phone (any format) or part of a name. */
  q?: string;
  majlisId?: string;
  disabledOnly?: boolean;
  /** Pagination: users created before this. */
  before?: Date;
};

export async function listUsers(filter: UserFilter, now: Date = new Date()) {
  await ready();
  const query: Record<string, unknown> = {};
  if (filter.q) {
    const phone = normalizePhone(filter.q);
    const digits = filter.q.replace(/\D/g, "");
    query.$or = [
      ...(phone ? [{ phone }] : []),
      { name: { $regex: escapeRegex(filter.q.trim()), $options: "i" } },
      // The last few digits, e.g. "4567" (needs at least 3 to mean anything).
      ...(digits.length >= 3 ? [{ phone: { $regex: `${digits}$` } }] : []),
    ];
  }
  if (filter.majlisId) query.majlisId = filter.majlisId;
  if (filter.disabledOnly) query.disabled = true;
  if (filter.before) query.createdAt = { $lt: filter.before };

  const rows = await User.find(query).sort({ createdAt: -1 }).limit(PAGE_SIZE + 1).lean<UserDoc[]>();
  const page = rows.slice(0, PAGE_SIZE);
  const names = await majlisNames(page.map((u) => u.majlisId));

  const users: AdminUser[] = page.map((u) => ({
    id: u._id.toString(),
    phone: u.phone,
    name: u.name ?? "",
    majlisName: u.majlisId ? (names.get(u.majlisId) ?? null) : null,
    majlisOther: u.majlisOther ?? "",
    age: u.birthYear ? now.getFullYear() - u.birthYear : null,
    city: u.city ?? "",
    totalCount: u.totalCount,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    disabled: Boolean(u.disabled),
    disabledReason: u.disabledReason ?? "",
    locked: Boolean(u.lockedUntil && u.lockedUntil > now),
    isAdmin: u.isAdmin === true,
  }));
  return { users, nextBefore: rows.length > PAGE_SIZE ? users[users.length - 1].createdAt : null };
}

export type ResetPinResult = { ok: true } | { ok: false; error: "invalid_pin" | "not_found" };

/**
 * For "forgot my PIN": the admin sets a new PIN (told to the user offline).
 * Also unlocks the account and logs it out everywhere.
 */
export async function resetUserPin(userId: string, rawPin: string): Promise<ResetPinResult> {
  const pin = normalizePin(rawPin);
  if (!isValidPinFormat(pin)) return { ok: false, error: "invalid_pin" };
  await ready();
  const result = await User.updateOne(
    { _id: userId },
    { $set: { pinHash: await bcrypt.hash(pin, 10), failedPins: 0 }, $unset: { lockedUntil: "" } },
  );
  if (result.matchedCount === 0) return { ok: false, error: "not_found" };
  await deleteAllSessions(userId);
  return { ok: true };
}

/** Admin accounts may open the panel (together with the admin password). */
export async function setUserAdmin(userId: string, isAdmin: boolean) {
  await ready();
  await User.updateOne({ _id: userId }, isAdmin ? { $set: { isAdmin: true } } : { $unset: { isAdmin: "" } });
}

/** Disabling stops logins and submissions and logs the user out everywhere. */
export async function setUserDisabled(userId: string, disabled: boolean, reason = "") {
  await ready();
  await User.updateOne(
    { _id: userId },
    disabled ? { $set: { disabled: true, disabledReason: reason } } : { $set: { disabled: false }, $unset: { disabledReason: "" } },
  );
  if (disabled) await deleteAllSessions(userId);
}

export type RecalcResult = { total: number; counters: number; corrected: number };

/**
 * Safety tool: rebuilds every Counter document from non-removed entries.
 * Overwrites with $set, so submissions arriving during the few hundred
 * milliseconds it runs could be missed. Use when traffic is low.
 */
export async function recalculateTotals(): Promise<RecalcResult> {
  await ready();
  const perDay = await Entry.aggregate<{ _id: string; count: number }>([
    { $match: notRemoved },
    { $group: { _id: "$day", count: { $sum: "$count" } } },
  ]);

  const target = new Map<string, number>([[counterIds.global, 0]]);
  for (const { _id: day, count } of perDay) {
    target.set(`day:${day}`, count);
    const month = `month:${day.slice(0, 7)}`;
    target.set(month, (target.get(month) ?? 0) + count);
    target.set(counterIds.global, (target.get(counterIds.global) ?? 0) + count);
  }

  const current = new Map(
    (await Counter.find().lean<CounterDoc[]>()).map((c) => [c._id, c.count]),
  );
  let corrected = 0;
  for (const [id, count] of target) if (current.get(id) !== count) corrected++;
  for (const id of current.keys()) if (!target.has(id)) corrected++;

  await Counter.bulkWrite(
    [...target].map(([id, count]) => ({
      updateOne: { filter: { _id: id }, update: { $set: { count } }, upsert: true },
    })),
    { ordered: false },
  );
  await Counter.deleteMany({ _id: { $nin: [...target.keys()] } });

  return { total: target.get(counterIds.global) ?? 0, counters: target.size, corrected };
}

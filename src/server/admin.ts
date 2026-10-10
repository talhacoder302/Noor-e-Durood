import "server-only";
import { APP_TIME_ZONE, counterIds, karachiDay, lastDays } from "@/lib/date";
import type { DuroodMode, Totals } from "@/lib/types";
import { Counter, type CounterDoc } from "@/models/counter";
import { DeviceStat, type DeviceStatDoc } from "@/models/device-stat";
import { Entry, type EntryDoc } from "@/models/entry";
import { getTotals } from "./counter";
import { ready } from "./ready";

// Admin-only reads and writes. Device ids appear here (shortened in the UI);
// IP hashes never leave the server.

export type AdminEntry = {
  id: string;
  count: number;
  mode: DuroodMode;
  day: string;
  createdAt: string;
  deviceId: string;
  userAgentShort: string;
  removed: boolean;
  removedReason?: string;
};

type EntryLean = EntryDoc & { _id: { toString(): string } };

function toAdminEntry(e: EntryLean): AdminEntry {
  return {
    id: e._id.toString(),
    count: e.count,
    mode: e.mode,
    day: e.day,
    createdAt: e.createdAt.toISOString(),
    deviceId: e.deviceId,
    userAgentShort: e.userAgentShort,
    removed: Boolean(e.removed),
    removedReason: e.removedReason,
  };
}

const notRemoved = { removed: { $ne: true } };

export type Dashboard = {
  totals: Totals;
  activeDevicesToday: number;
  entriesToday: number;
  /** 24 values, Karachi hours 0–23. */
  perHour: number[];
  /** Current Karachi hour, so the chart opens on it. */
  currentHour: number;
  last30: { day: string; count: number }[];
  topEntries: AdminEntry[];
  blockedDevices: number;
};

export async function getDashboard(now: Date = new Date()): Promise<Dashboard> {
  await ready();
  const today = karachiDay(now);
  const days30 = lastDays(30, karachiDay(now));
  const days7 = days30.slice(-7);

  const [totals, devices, hours, counters, top, blockedDevices] = await Promise.all([
    getTotals(now),
    Entry.distinct("deviceId", { day: today, ...notRemoved }),
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
    DeviceStat.countDocuments({ blocked: true }),
  ]);

  const perHour = Array.from({ length: 24 }, () => 0);
  let entriesToday = 0;
  for (const h of hours) {
    perHour[h._id] = h.count;
    entriesToday += h.entries;
  }
  const byDay = new Map(counters.map((c) => [c._id.slice(4), c.count]));

  return {
    totals,
    activeDevicesToday: devices.length,
    entriesToday,
    perHour,
    currentHour:
      Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: APP_TIME_ZONE }).format(now)) % 24,
    last30: days30.map((day) => ({ day, count: byDay.get(day) ?? 0 })),
    topEntries: top.map(toAdminEntry),
    blockedDevices,
  };
}

export type EntryFilter = {
  minCount?: number;
  /** Full id or the start of one (as shown shortened in the list). */
  device?: string;
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
  if (!filter.showRemoved) Object.assign(query, notRemoved);

  const rows = await Entry.find(query)
    .sort({ createdAt: -1 })
    .limit(PAGE_SIZE + 1)
    .lean<EntryLean[]>();

  const entries = rows.slice(0, PAGE_SIZE).map(toAdminEntry);
  return {
    entries,
    nextBefore: rows.length > PAGE_SIZE ? entries[entries.length - 1].createdAt : null,
  };
}

export type RemoveResult = { ok: true; count: number } | { ok: false; error: "not_found" };

/**
 * Marks an entry removed (once only) and takes its count back off the
 * global, day and month counters and the device's stats, all with $inc.
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
  const results = await Promise.all([
    Counter.updateOne({ _id: counterIds.global }, back),
    Counter.updateOne({ _id: `day:${entry.day}` }, back),
    Counter.updateOne({ _id: `month:${entry.day.slice(0, 7)}` }, back),
    DeviceStat.updateOne(
      { deviceId: entry.deviceId, day: entry.day },
      { $inc: { totalCount: -entry.count, dayCount: -entry.count } },
    ),
  ]);
  // The device has moved on to a later day: only its all-time total changes.
  if (results[3].matchedCount === 0) {
    await DeviceStat.updateOne({ deviceId: entry.deviceId }, { $inc: { totalCount: -entry.count } });
  }
  return { ok: true, count: entry.count };
}

export async function blockDevice(deviceId: string, reason: string, now: Date = new Date()) {
  await ready();
  await DeviceStat.updateOne(
    { deviceId },
    {
      $set: { blocked: true, blockedReason: reason, blockedAt: now },
      $setOnInsert: { totalCount: 0, day: karachiDay(now), dayCount: 0, lastEntryAt: now },
    },
    { upsert: true },
  );
}

export async function unblockDevice(deviceId: string) {
  await ready();
  await DeviceStat.updateOne(
    { deviceId },
    { $unset: { blocked: "", blockedReason: "", blockedAt: "" } },
  );
}

export type BlockedDevice = { deviceId: string; reason: string; blockedAt: string; totalCount: number };

export async function listBlockedDevices(): Promise<BlockedDevice[]> {
  await ready();
  const docs = await DeviceStat.find({ blocked: true }).sort({ blockedAt: -1 }).limit(200).lean<DeviceStatDoc[]>();
  return docs.map((d) => ({
    deviceId: d.deviceId,
    reason: d.blockedReason ?? "",
    blockedAt: (d.blockedAt ?? new Date(0)).toISOString(),
    totalCount: d.totalCount,
  }));
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

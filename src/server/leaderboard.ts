import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { karachiDay, karachiMonth, lastDays } from "@/lib/date";
import type { LeaderboardRow, PublicProfile } from "@/lib/types";
import { Entry } from "@/models/entry";
import { Majlis, type MajlisDoc } from "@/models/majlis";
import { User, type UserDoc } from "@/models/user";
import { ready } from "./ready";

export const LEADERBOARD_SIZE = 50;
export const LEADERBOARD_TAG = "leaderboard";

const OBJECT_ID = /^[0-9a-f]{24}$/;

// Disabled accounts and accounts with nothing sent yet never appear.
const listed = { disabled: { $ne: true }, totalCount: { $gt: 0 } };

// Only these fields leave the server. Never the phone number.
const PUBLIC_FIELDS = { name: 1, majlisId: 1, majlisOther: 1, city: 1, birthYear: 1, totalCount: 1, createdAt: 1 };

async function majlisNames(ids: (string | undefined)[]): Promise<Map<string, string>> {
  const valid = [...new Set(ids.filter((id): id is string => !!id && OBJECT_ID.test(id)))];
  if (valid.length === 0) return new Map();
  const docs = await Majlis.find({ _id: { $in: valid } }, { name: 1 }).lean<MajlisDoc[]>();
  return new Map(docs.map((m) => [m._id.toString(), m.name]));
}

const majlisOf = (u: UserDoc, names: Map<string, string>) =>
  (u.majlisId && names.get(u.majlisId)) || u.majlisOther || "";

/**
 * Top accounts by all-time count, highest first. Equal counts share a rank
 * (1, 2, 2, 4); among equals, whoever joined first is listed first.
 * With showNames off (the admin setting) rows carry only rank and count:
 * no id, name, majlis or city ever leaves the server.
 */
export async function getLeaderboard({
  showNames,
  limit = LEADERBOARD_SIZE,
}: {
  showNames: boolean;
  limit?: number;
}): Promise<LeaderboardRow[]> {
  await ready();
  const users = await User.find(listed, showNames ? PUBLIC_FIELDS : { totalCount: 1 })
    .sort({ totalCount: -1, createdAt: 1 })
    .limit(limit)
    .lean<UserDoc[]>();
  const names = showNames ? await majlisNames(users.map((u) => u.majlisId)) : new Map<string, string>();

  let rank = 0;
  return users.map((u, i) => {
    if (i === 0 || u.totalCount !== users[i - 1].totalCount) rank = i + 1;
    if (!showNames) return { id: null, rank, name: "", majlis: "", city: "", total: u.totalCount };
    return {
      id: u._id.toString(),
      rank,
      name: u.name ?? "",
      majlis: majlisOf(u, names),
      city: u.city ?? "",
      total: u.totalCount,
    };
  });
}

/**
 * Public page for one account: profile fields, rank and counts. Null if
 * unknown or disabled. Pages only call this when the admin allows names.
 */
export async function getPublicProfile(id: string, now: Date = new Date()): Promise<PublicProfile | null> {
  if (!OBJECT_ID.test(id)) return null;
  await ready();
  const u = await User.findOne({ _id: id, disabled: { $ne: true } }, PUBLIC_FIELDS).lean<UserDoc>();
  if (!u) return null;

  const today = karachiDay(now);
  const month = karachiMonth(now);
  const days = lastDays(7, today);
  // Enough history for this month and the last 7 days, whichever reaches further back.
  const from = [`${month}-01`, days[0]].sort()[0];
  const [names, ahead, perDay] = await Promise.all([
    majlisNames([u.majlisId]),
    u.totalCount > 0 ? User.countDocuments({ ...listed, totalCount: { $gt: u.totalCount } }) : 0,
    Entry.aggregate<{ _id: string; count: number }>([
      { $match: { userId: id, removed: { $ne: true }, day: { $gte: from } } },
      { $group: { _id: "$day", count: { $sum: "$count" } } },
    ]),
  ]);
  const byDay = new Map(perDay.map((d) => [d._id, d.count]));
  let monthTotal = 0;
  for (const [day, count] of byDay) if (day.startsWith(month)) monthTotal += count;

  return {
    id,
    name: u.name ?? "",
    majlis: majlisOf(u, names),
    city: u.city ?? "",
    age: u.birthYear ? now.getFullYear() - u.birthYear : null,
    joined: karachiMonth(u.createdAt),
    rank: u.totalCount > 0 ? ahead + 1 : null,
    total: u.totalCount,
    today: byDay.get(today) ?? 0,
    month: monthTotal,
    last7: days.map((day) => ({ day, count: byDay.get(day) ?? 0 })),
  };
}

// Cached for pages. Counts change all the time, so a short life is fine;
// the short expire also keeps these out of the build-time prerender.

/** showNames comes from getPublicSettings(); it is part of the cache key. */
export async function getCachedLeaderboard(showNames: boolean): Promise<LeaderboardRow[]> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 120 });
  cacheTag(LEADERBOARD_TAG);
  return getLeaderboard({ showNames });
}

export async function getCachedPublicProfile(id: string): Promise<PublicProfile | null> {
  "use cache";
  cacheLife({ stale: 30, revalidate: 30, expire: 120 });
  cacheTag(LEADERBOARD_TAG);
  return getPublicProfile(id);
}

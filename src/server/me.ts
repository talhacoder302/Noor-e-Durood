import "server-only";
import { karachiDay, karachiMonth, lastDays, weekStart } from "@/lib/date";
import type { MySummary } from "@/lib/types";
import { Entry } from "@/models/entry";
import { ready } from "./ready";

/**
 * An account's own counts, built from its entries (removed ones excluded),
 * across every phone it has used. Only ever returned to that account.
 */
export async function getMySummary(userId: string, now: Date = new Date()): Promise<MySummary> {
  await ready();
  const today = karachiDay(now);
  const month = karachiMonth(now);
  const monday = weekStart(today);

  const perDay = await Entry.aggregate<{ _id: string; count: number }>([
    { $match: { userId, removed: { $ne: true } } },
    { $group: { _id: "$day", count: { $sum: "$count" } } },
  ]);

  const byDay = new Map(perDay.map((d) => [d._id, d.count]));
  let week = 0;
  let monthTotal = 0;
  let allTime = 0;
  for (const [day, count] of byDay) {
    allTime += count;
    if (day.startsWith(month)) monthTotal += count;
    if (day >= monday && day <= today) week += count;
  }

  return {
    today: byDay.get(today) ?? 0,
    week,
    month: monthTotal,
    allTime,
    last7: lastDays(7, today).map((day) => ({ day, count: byDay.get(day) ?? 0 })),
  };
}

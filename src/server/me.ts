import "server-only";
import { karachiDay, karachiMonth, lastDays, weekStart } from "@/lib/date";
import type { MySummary } from "@/lib/types";
import { DeviceStat } from "@/models/device-stat";
import { Entry } from "@/models/entry";
import { ready } from "./ready";

/**
 * A device's own counts, built from its entries (removed ones excluded).
 * Only ever returned to that same device.
 */
export async function getMySummary(deviceId: string, now: Date = new Date()): Promise<MySummary> {
  await ready();
  const today = karachiDay(now);
  const month = karachiMonth(now);
  const monday = weekStart(today);

  const [perDay, stat] = await Promise.all([
    Entry.aggregate<{ _id: string; count: number }>([
      { $match: { deviceId, removed: { $ne: true } } },
      { $group: { _id: "$day", count: { $sum: "$count" } } },
    ]),
    DeviceStat.findOne({ deviceId }, { recoveryHash: 1 }).lean(),
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
    hasRecoveryCode: Boolean(stat?.recoveryHash),
  };
}

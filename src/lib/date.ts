// "Today" and "this month" are always Pakistan time, wherever the server runs.
export const APP_TIME_ZONE = "Asia/Karachi";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** YYYY-MM-DD in Asia/Karachi. */
export function karachiDay(date: Date = new Date()): string {
  const parts = Object.fromEntries(
    dayFormatter.formatToParts(date).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** YYYY-MM in Asia/Karachi. */
export function karachiMonth(date: Date = new Date()): string {
  return karachiDay(date).slice(0, 7);
}

/** Counter document ids, matching the data model in CLAUDE.md. */
export const counterIds = {
  global: "global",
  day: (date: Date = new Date()) => `day:${karachiDay(date)}`,
  month: (date: Date = new Date()) => `month:${karachiMonth(date)}`,
} as const;

/** Day key `n` days after `day` (negative goes back). Pure calendar math. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a day key. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

/** Monday of the Karachi week containing `day`. */
export function weekStart(day: string): string {
  return addDays(day, -((weekdayOf(day) + 6) % 7));
}

/** The last `n` Karachi days ending today, oldest first. */
export function lastDays(n: number, today: string = karachiDay()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

export function isFridayInKarachi(date: Date = new Date()): boolean {
  return weekdayOf(karachiDay(date)) === 5;
}

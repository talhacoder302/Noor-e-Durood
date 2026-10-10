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

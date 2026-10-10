import { APP_TIME_ZONE } from "@/lib/date";

/** Date and time in Pakistan time, e.g. "10 Oct, 14:05". */
export function formatKarachiTime(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** First 8 characters: enough to tell devices apart in a list. */
export const shortDevice = (deviceId: string) => deviceId.slice(0, 8);

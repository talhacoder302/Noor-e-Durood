import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getSettings } from "./settings";

export const PUBLIC_SETTINGS_TAG = "public-settings";

export type PublicSettings = {
  announcement: string;
  paused: boolean;
  fridayMessage: { ur: string; en: string };
};

/**
 * The parts of Settings that pages may show. Cached for a minute; saving
 * Settings in the admin panel expires it at once (updateTag).
 */
export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  cacheTag(PUBLIC_SETTINGS_TAG);
  const s = await getSettings();
  return {
    announcement: s.announcement.trim(),
    paused: s.paused,
    fridayMessage: { ur: s.fridayMessageUr, en: s.fridayMessageEn },
  };
}

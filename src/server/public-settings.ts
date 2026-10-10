import "server-only";
import { cacheLife } from "next/cache";
import { getSettings } from "./settings";

export type PublicSettings = {
  fridayMessage: { ur: string; en: string };
};

/** The parts of Settings that pages may show. Cached for a minute. */
export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  const s = await getSettings();
  return { fridayMessage: { ur: s.fridayMessageUr, en: s.fridayMessageEn } };
}

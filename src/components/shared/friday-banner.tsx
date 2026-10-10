import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { DEFAULT_FRIDAY_MESSAGE } from "@/lib/friday";
import { isFridayInKarachi } from "@/lib/date";
import { getPublicSettings } from "@/server/public-settings";
import { FridayBannerView } from "./friday-banner-view";

/**
 * Shown on Fridays (Pakistan time). Decided per request on the server so
 * there is no layout jump. NOOR_FORCE_FRIDAY=1 shows it any day (testing).
 */
export async function FridayBanner({ locale }: { locale: string }) {
  await connection();
  if (!isFridayInKarachi() && process.env.NOOR_FORCE_FRIDAY !== "1") return null;

  const lang = locale === "en" ? "en" : "ur";
  let message: string = DEFAULT_FRIDAY_MESSAGE[lang];
  try {
    message = (await getPublicSettings()).fridayMessage[lang];
  } catch (error) {
    unstable_rethrow(error);
    console.error("Could not load Friday message:", error);
  }
  return <FridayBannerView message={message} />;
}

import { InfoIcon, PauseCircleIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { isFridayInKarachi } from "@/lib/date";
import { DEFAULT_FRIDAY_MESSAGE } from "@/lib/friday";
import { getPublicSettings, type PublicSettings } from "@/server/public-settings";
import { FridayBannerView } from "./friday-banner-view";
import { SalawatText } from "./salawat-text";

/**
 * Notices above the home page: "paused" (from Settings), the admin's
 * announcement, and on Fridays (Pakistan time) the Friday reminder. Decided
 * per request on the server so nothing jumps after load.
 * NOOR_FORCE_FRIDAY=1 shows the Friday banner on any day (testing).
 */
export async function SiteNotices({ locale }: { locale: string }) {
  await connection();
  const t = await getTranslations("Notices");
  const lang = locale === "en" ? "en" : "ur";

  let settings: PublicSettings | null = null;
  try {
    settings = await getPublicSettings();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Could not load site notices:", error);
  }

  const friday = isFridayInKarachi() || process.env.NOOR_FORCE_FRIDAY === "1";
  if (!settings?.paused && !settings?.announcement && !friday) return null;

  return (
    <div className="flex flex-col gap-3">
      {settings?.paused && (
        <p role="status" className="flex items-start gap-3 rounded-2xl border border-border bg-muted px-4 py-3 text-sm">
          <PauseCircleIcon className="mt-1.5 size-5 shrink-0 text-gold" aria-hidden />
          {t("paused")}
        </p>
      )}
      {settings?.announcement && (
        <p role="note" className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          <InfoIcon className="mt-1.5 size-5 shrink-0" aria-hidden />
          <span className="whitespace-pre-line">
            <SalawatText>{settings.announcement}</SalawatText>
          </span>
        </p>
      )}
      {friday && <FridayBannerView message={settings?.fridayMessage[lang] ?? DEFAULT_FRIDAY_MESSAGE[lang]} />}
    </div>
  );
}

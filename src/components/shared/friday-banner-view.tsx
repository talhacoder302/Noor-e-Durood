"use client";

import { MoonStarIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { karachiDay } from "@/lib/date";
import { useLocalPref } from "@/lib/use-local-pref";
import { SalawatText } from "./salawat-text";

export function FridayBannerView({ message }: { message: string }) {
  const t = useTranslations("Friday");
  // Dismissal lasts for the rest of this Friday only.
  const [dismissedOn, setDismissedOn] = useLocalPref<string>("noor.fridayDismissed", "");
  if (dismissedOn === karachiDay()) return null;

  return (
    <aside
      role="note"
      className="relative flex items-start gap-3 rounded-2xl border border-gold/40 bg-accent/50 px-4 py-3 text-accent-foreground"
    >
      <MoonStarIcon className="mt-2 size-5 shrink-0 text-gold" aria-hidden />
      <p className="flex-1 text-sm">
        <SalawatText>{message}</SalawatText>
      </p>
      <button
        type="button"
        onClick={() => setDismissedOn(karachiDay())}
        aria-label={t("dismiss")}
        className="-me-1 grid size-9 shrink-0 place-items-center rounded-full hover:bg-accent"
      >
        <XIcon className="size-4" />
      </button>
    </aside>
  );
}

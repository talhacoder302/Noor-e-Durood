"use client";

import { Share2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { useTotals } from "@/components/counter/totals-store";
import { Button } from "@/components/ui/button";
import { formatCount, type NumberLocale } from "@/lib/format";
import { canNativeShare, nativeShare, shareLink, whatsappUrl } from "@/lib/share";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.2-1.4A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3a8.2 8.2 0 1 1 7 3.9Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3Z" />
    </svg>
  );
}

/**
 * WhatsApp + the phone's share sheet. The personal count is only included
 * when `mine` is passed, which happens only after the user chose to share it.
 */
export function ShareButtons({ mine, className }: { mine?: number; className?: string }) {
  const t = useTranslations("Share");
  const locale = useLocale() as NumberLocale;
  const totals = useTotals(null);
  const native = useSyncExternalStore(noopSubscribe, canNativeShare, () => false);

  function message() {
    const n = (v: number) => formatCount(v, locale);
    const lines = [mine === undefined ? t("intro") : t("mineIntro", { n: n(mine) })];
    if (totals) lines.push(t(mine === undefined ? "total" : "mineTotal", { n: n(totals.total) }));
    return { text: lines.join("\n"), url: shareLink(locale) };
  }

  const onWhatsApp = () => {
    const { text, url } = message();
    window.open(whatsappUrl(`${text}\n${url}`), "_blank", "noopener,noreferrer");
  };

  const onNative = async () => {
    const { text, url } = message();
    await nativeShare(text, url, t("title"));
  };

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      <Button
        type="button"
        onClick={onWhatsApp}
        className="h-12 gap-2 rounded-full bg-[#1f8f4e] px-5 text-base text-white hover:bg-[#1a7a43]"
      >
        <WhatsAppIcon className="size-5" />
        {t("whatsapp")}
      </Button>
      {native && (
        <Button type="button" variant="outline" onClick={onNative} className="h-12 gap-2 rounded-full px-5 text-base">
          <Share2Icon className="size-5" />
          {t("more")}
        </Button>
      )}
    </div>
  );
}

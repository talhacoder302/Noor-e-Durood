import { Share2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

export function SiteFooter() {
  const t = useTranslations("Footer");

  return (
    <footer className="border-t border-border/60 bg-background/70">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-4 py-6 text-center">
        <p className="text-base text-brand">{t("dua")}</p>
        <p className="text-xs text-muted-foreground">{t("privacy")}</p>
        {/* Real share sheet comes in a later module. */}
        <a
          href="#share"
          className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm text-gold underline-offset-4 hover:underline"
        >
          <Share2Icon className="size-4" />
          {t("share")}
        </a>
      </div>
    </footer>
  );
}

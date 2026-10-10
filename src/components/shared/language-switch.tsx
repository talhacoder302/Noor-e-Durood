"use client";

import { LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

export function LanguageSwitch() {
  const t = useTranslations("Header");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const target: Locale = locale === "ur" ? "en" : "ur";

  return (
    <Button asChild variant="ghost" className="h-10 gap-1.5 rounded-full px-3">
      <Link
        href={pathname}
        locale={target}
        aria-label={t("switchLanguageLabel")}
        lang={target}
      >
        <LanguagesIcon className="size-4" />
        <span className={target === "ur" ? "font-urdu leading-none" : "font-sans"}>
          {t("switchLanguage")}
        </span>
      </Link>
    </Button>
  );
}

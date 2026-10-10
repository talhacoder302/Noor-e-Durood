import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { CounterPlaceholder } from "@/components/counter/counter-placeholder";
import { ShortDurood } from "@/components/shared/short-durood";
import { SalawatText } from "@/components/shared/salawat-text";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/routing";

export default function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);

  const t = useTranslations("Hero");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pt-8 pb-12 sm:pt-12">
      <section className="flex flex-col items-center gap-4 text-center">
        <Badge
          variant="outline"
          className="border-gold/40 bg-accent/60 px-3 py-1 text-accent-foreground"
        >
          {t("eyebrow")}
        </Badge>
        <h1 className="text-2xl leading-[1.9] font-semibold text-balance text-brand sm:text-3xl">
          <SalawatText>{t("title")}</SalawatText>
        </h1>
        <p className="max-w-xl text-base text-pretty text-muted-foreground">
          <SalawatText>{t("subtitle")}</SalawatText>
        </p>
      </section>

      <CounterPlaceholder />
      <ShortDurood />
    </div>
  );
}

import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { AddDurood } from "@/components/counter/add-durood";
import { InitialCounter } from "@/components/counter/initial-counter";
import { LiveCounterSkeleton } from "@/components/counter/live-counter";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { DuroodCard } from "@/components/shared/durood-card";
import { FridayBanner } from "@/components/shared/friday-banner";
import { SalawatText } from "@/components/shared/salawat-text";
import { ShareSection } from "@/components/shared/share-section";
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
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-6 pb-12 sm:pt-10">
      <Suspense fallback={null}>
        <FridayBanner locale={locale} />
      </Suspense>

      <section className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-xl leading-[1.9] font-semibold text-balance text-brand sm:text-3xl">
          <SalawatText>{t("title")}</SalawatText>
        </h1>
        <p className="max-w-xl text-sm text-pretty text-muted-foreground sm:text-base">
          <SalawatText>{t("subtitle")}</SalawatText>
        </p>
      </section>

      <Suspense fallback={<LiveCounterSkeleton />}>
        <InitialCounter />
      </Suspense>

      <AddDurood />
      <DuroodCard />
      <ShareSection />
      <InstallPrompt />
    </div>
  );
}

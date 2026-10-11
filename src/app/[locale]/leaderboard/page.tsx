import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { LeaderboardList, LeaderboardSkeleton } from "@/components/leaderboard/leaderboard-list";
import type { Locale } from "@/i18n/routing";
import { formatCount } from "@/lib/format";
import { LEADERBOARD_SIZE } from "@/server/leaderboard";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Leaderboard" });
  return {
    title: t("metaTitle"),
    // Members' names; keep them out of search engines.
    robots: { index: false, follow: false },
    alternates: { canonical: locale === "en" ? "/en/leaderboard" : "/leaderboard" },
  };
}

export default function LeaderboardPage({ params }: Params) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  const t = useTranslations("Leaderboard");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-6 pb-12 sm:pt-10">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl leading-loose font-semibold text-brand">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle", { n: formatCount(LEADERBOARD_SIZE, locale as Locale) })}
        </p>
      </header>
      <Suspense fallback={<LeaderboardSkeleton />}>
        <LeaderboardList locale={locale as Locale} />
      </Suspense>
    </div>
  );
}

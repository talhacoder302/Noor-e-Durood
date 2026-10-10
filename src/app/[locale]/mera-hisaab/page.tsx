import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { MyCount } from "@/components/me/my-count";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Me" });
  return {
    title: t("metaTitle"),
    // Personal and empty for crawlers; nothing to index.
    robots: { index: false, follow: true },
    alternates: { canonical: locale === "en" ? "/en/mera-hisaab" : "/mera-hisaab" },
  };
}

export default function MeraHisaabPage({ params }: Params) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  const t = useTranslations("Me");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-6 pb-12 sm:pt-10">
      <h1 className="text-center text-2xl leading-loose font-semibold text-brand">{t("title")}</h1>
      <MyCount />
    </div>
  );
}

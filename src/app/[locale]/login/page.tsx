import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { title: t("pageTitle"), robots: { index: false } };
}

export default function LoginPage({ params }: Params) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  const t = useTranslations("Auth");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-6 pb-12 sm:pt-10">
      <h1 className="text-center text-2xl leading-loose font-semibold text-brand">{t("pageTitle")}</h1>
      {/* AuthForm reads ?mode and ?next, which only exist in the browser. */}
      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  );
}

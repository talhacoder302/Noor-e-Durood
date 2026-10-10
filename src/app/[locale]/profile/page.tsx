import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { ProfileView } from "@/components/auth/profile-view";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Profile" });
  return { title: t("title"), robots: { index: false } };
}

export default function ProfilePage({ params }: Params) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  const t = useTranslations("Profile");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-6 pb-12 sm:pt-10">
      <h1 className="text-center text-2xl leading-loose font-semibold text-brand">{t("title")}</h1>
      {/* ProfileView reads ?welcome and ?next in the browser. */}
      <Suspense>
        <ProfileView />
      </Suspense>
    </div>
  );
}

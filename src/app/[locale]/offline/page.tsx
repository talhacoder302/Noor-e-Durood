import type { Metadata } from "next";
import { CloudOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { OfflineTasbeeh } from "@/components/tasbeeh/offline-tasbeeh";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Offline" });
  return { title: t("title"), robots: { index: false } };
}

/**
 * Precached by the service worker and served when a page can't load
 * offline. Fully static, so the tasbeeh keeps working without internet.
 */
export default function OfflinePage({ params }: Params) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  const t = useTranslations("Offline");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-6 pb-12">
      <section className="flex flex-col items-center gap-2 text-center">
        <CloudOffIcon className="size-8 text-gold" aria-hidden />
        <h1 className="text-xl leading-[1.9] font-semibold text-brand">{t("title")}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t("body")}</p>
        <Link href="/" className="text-sm text-brand underline underline-offset-4">
          {t("retry")}
        </Link>
      </section>
      <OfflineTasbeeh />
    </div>
  );
}

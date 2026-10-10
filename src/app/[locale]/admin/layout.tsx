import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { pickMessages } from "@/i18n/client-messages";
import type { Locale } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

// Admin strings are only sent to admin pages.
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const messages = pickMessages(await getMessages(), ["Admin"]);

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 pt-6 pb-12">{children}</div>
    </NextIntlClientProvider>
  );
}

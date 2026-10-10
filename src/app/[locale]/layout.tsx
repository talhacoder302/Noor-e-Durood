import type { Metadata, Viewport } from "next";
import { Amiri, Inter, Noto_Nastaliq_Urdu } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteFooter } from "@/components/shared/site-footer";
import { SiteHeader } from "@/components/shared/site-header";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { isRtl, routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Arabic subsets only: these fonts are for Arabic and Urdu script, and the
// unicode-range keeps them from downloading on English-only text.
const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  variable: "--font-nastaliq",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type LayoutParams = { params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: LayoutParams): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "Meta" });

  return {
    title: t("title"),
    description: t("description"),
    applicationName: "Noor-e-Durood",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1811" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: LayoutParams & { children: React.ReactNode }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      suppressHydrationWarning
      className={cn(inter.variable, amiri.variable, nastaliq.variable)}
    >
      <body
        className={cn(
          "islamic-pattern flex min-h-dvh flex-col antialiased",
          locale === "ur" ? "font-urdu" : "font-sans",
        )}
      >
        <NextIntlClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <Toaster position="top-center" />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

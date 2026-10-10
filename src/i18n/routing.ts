import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ur", "en"],
  defaultLocale: "ur",
  // Urdu lives at "/" and English at "/en". We don't auto-detect from the
  // browser because most phones here report English even for Urdu readers.
  localePrefix: "as-needed",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const rtlLocales: readonly Locale[] = ["ur"];

export function isRtl(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

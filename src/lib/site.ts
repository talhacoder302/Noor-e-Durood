/** Public origin of the site, without a trailing slash. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** Home page path for a locale (Urdu lives at the root). */
export function homePath(locale: string): string {
  return locale === "en" ? "/en" : "/";
}

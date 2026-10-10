import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Only the public home pages; the personal page and offline page are noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const languages = { "ur-PK": `${base}/`, en: `${base}/en` };
  return [
    { url: `${base}/`, changeFrequency: "hourly", priority: 1, alternates: { languages } },
    { url: `${base}/en`, changeFrequency: "hourly", priority: 0.8, alternates: { languages } },
  ];
}

"use client";

import { ChartColumnIcon, HouseIcon, TrophyIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", key: "navHome", icon: HouseIcon },
  { href: "/leaderboard", key: "navLeaderboard", icon: TrophyIcon },
  { href: "/mera-hisaab", key: "myCount", icon: ChartColumnIcon },
] as const;

/** The site's main links, under the header bar on every page. */
export function MainNav() {
  return <MainNavLinks pathname={usePathname()} />;
}

/**
 * The links themselves. With no pathname nothing is highlighted: that's the
 * fallback while the path is not known yet (routes with request-time params).
 */
export function MainNavLinks({ pathname }: { pathname: string | null }) {
  const t = useTranslations("Header");
  const isActive = (href: string) =>
    pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <nav aria-label={t("navLabel")} className="mx-auto grid max-w-3xl grid-cols-3 gap-1 px-4 pb-1.5">
      {ITEMS.map(({ href, key, icon: Icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-full text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              active ? "bg-primary/10 font-semibold text-brand" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{t(key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatCount, type NumberLocale } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getCachedLeaderboard } from "@/server/leaderboard";
import { getPublicSettings } from "@/server/public-settings";
import { Avatar, RankBadge } from "./bits";

/**
 * Top accounts, highest count first. When the admin allows names, each row
 * opens that person's profile; otherwise rows are anonymous and don't open.
 */
export async function LeaderboardList({ locale }: { locale: NumberLocale }) {
  // Request time only, so the build never reads the database.
  await connection();
  const t = await getTranslations("Leaderboard");
  let rows: LeaderboardRow[] | null = null;
  try {
    const { leaderboardShowNames } = await getPublicSettings();
    rows = await getCachedLeaderboard(leaderboardShowNames);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Could not load the leaderboard:", error);
  }

  if (!rows || rows.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 py-6 text-center">
          <p className="text-sm text-muted-foreground">{rows ? t("empty") : t("error")}</p>
          <Link href="/" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
            {t("cta")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const Chevron = locale === "ur" ? ChevronLeftIcon : ChevronRightIcon;
  // Align with the page, not with each name's own script.
  const align = locale === "ur" ? "text-right" : "text-left";
  return (
    <ol className="space-y-2">
      {rows.map((row, i) => {
        const rowClass = cn(
          "flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5",
          row.rank <= 3 && "border-gold/50",
        );
        const body = (
          <>
            <RankBadge rank={row.rank} locale={locale} />
            <Avatar name={row.name} className="size-10" />
            <span className="flex min-w-0 flex-1 flex-col">
              {/* Names may be Urdu or English on either page; dir="auto" keeps each readable. */}
              <span dir="auto" className={cn("truncate font-medium", align)}>
                {row.id === null ? t("anonymous") : row.name || t("member")}
              </span>
              {(row.majlis || row.city) && (
                <span dir="auto" className={cn("truncate text-xs text-muted-foreground", align)}>
                  {[row.majlis, row.city].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
            <span className="flex shrink-0 flex-col items-end">
              <span className="num text-lg font-bold text-brand">{formatCount(row.total, locale)}</span>
              <span className="text-[11px] text-muted-foreground">{t("durood")}</span>
            </span>
          </>
        );
        return row.id === null ? (
          <li key={i} className={rowClass}>
            {body}
          </li>
        ) : (
          <li key={row.id}>
            <Link
              href={`/leaderboard/${row.id}`}
              className={cn(
                rowClass,
                "transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              )}
            >
              {body}
              <Chevron className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

"use client";

import { RefreshCwIcon, Settings2Icon, Share2Icon, UserRoundIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { LoginPrompt } from "@/components/auth/login-prompt";
import { setSessionUser, useSession } from "@/components/auth/session-store";
import { applyPolled } from "@/components/counter/totals-store";
import { ShareButtons } from "@/components/shared/share-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatCount, type NumberLocale } from "@/lib/format";
import type { MySummary, Totals } from "@/lib/types";
import { WeekChart } from "./week-chart";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; summary: MySummary };

/** The account's own numbers (all its phones). Null means the session ended. */
async function loadSummary(): Promise<MySummary | null> {
  const res = await fetch("/api/me", { cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`me ${res.status}`);
  return ((await res.json()) as { summary: MySummary }).summary;
}

function Stat({ label, value }: { label: string; value: number | null }) {
  const locale = useLocale() as NumberLocale;
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col items-center gap-1 px-3 py-4 text-center">
        <p className="text-sm text-muted-foreground">{label}</p>
        {value === null ? (
          <Skeleton className="h-8 w-20 rounded-md" />
        ) : (
          <p className="num text-2xl font-semibold text-brand">{formatCount(value, locale)}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function MyCount() {
  const t = useTranslations("Me");
  const session = useSession();
  const [state, setState] = useState<State>({ status: "loading" });
  const [sharing, setSharing] = useState(false);
  const userId = session.status === "user" ? session.user.id : null;

  const refresh = useCallback(() => {
    loadSummary().then(
      (summary) => (summary ? setState({ status: "ready", summary }) : setSessionUser(null)),
      () => setState({ status: "error" }),
    );
  }, []);

  useEffect(() => {
    if (!userId) return;
    refresh();
    // The shared total is only used inside an optional share message.
    fetch("/api/stats")
      .then((r) => (r.ok ? (r.json() as Promise<Totals>) : null))
      .then((totals) => totals && applyPolled(totals))
      .catch(() => {});
  }, [userId, refresh]);

  if (session.status === "guest") return <LoginPrompt message={t("loginToSee")} />;

  const s = state.status === "ready" ? state.summary : null;

  return (
    <div className="space-y-5">
      {session.status === "user" && (
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-2">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <UserRoundIcon className="size-4 shrink-0 text-brand" />
            <span className="truncate">{session.user.name || <span className="num">{session.user.phoneMasked}</span>}</span>
          </span>
          <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1.5 rounded-full">
            <Link href="/profile">
              <Settings2Icon className="size-4" />
              {t("settings")}
            </Link>
          </Button>
        </div>
      )}

      {state.status === "error" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">{t("error")}</p>
            <Button type="button" variant="outline" onClick={refresh} className="gap-2 rounded-full">
              <RefreshCwIcon className="size-4" />
              {t("retry")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label={t("today")} value={s?.today ?? null} />
            <Stat label={t("week")} value={s?.week ?? null} />
            <Stat label={t("month")} value={s?.month ?? null} />
            <Stat label={t("allTime")} value={s?.allTime ?? null} />
          </div>

          <Card>
            <CardContent>
              {s ? <WeekChart days={s.last7} /> : <Skeleton className="h-44 w-full rounded-lg" />}
            </CardContent>
          </Card>
        </>
      )}

      {s && s.allTime > 0 && (
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg leading-loose">
              <Share2Icon className="size-5 text-gold" />
              {t("shareTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sharing ? (
              <ShareButtons mine={s.allTime} />
            ) : (
              <Button type="button" variant="outline" onClick={() => setSharing(true)} className="h-11 w-full rounded-xl">
                {t("shareMine")}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

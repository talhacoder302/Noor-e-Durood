"use client";

import { LockIcon, RefreshCwIcon, Share2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { applyPolled } from "@/components/counter/totals-store";
import { ShareButtons } from "@/components/shared/share-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDeviceId, rememberDeviceId } from "@/lib/device-id";
import { formatCount, type NumberLocale } from "@/lib/format";
import type { MySummary, Totals } from "@/lib/types";
import { RecoveryCard } from "./recovery-card";
import { WeekChart } from "./week-chart";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; summary: MySummary };

async function loadSummary(): Promise<MySummary> {
  const deviceId = await getDeviceId();
  const res = await fetch(`/api/me?deviceId=${encodeURIComponent(deviceId)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`me ${res.status}`);
  const data = (await res.json()) as { deviceId: string; summary: MySummary };
  rememberDeviceId(data.deviceId);
  return data.summary;
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
  const [state, setState] = useState<State>({ status: "loading" });
  const [sharing, setSharing] = useState(false);

  const refresh = useCallback(() => {
    loadSummary().then(
      (summary) => setState({ status: "ready", summary }),
      () => setState({ status: "error" }),
    );
  }, []);

  useEffect(() => {
    refresh();
    // The shared total is only used inside an optional share message.
    fetch("/api/stats")
      .then((r) => (r.ok ? (r.json() as Promise<Totals>) : null))
      .then((totals) => totals && applyPolled(totals))
      .catch(() => {});
  }, [refresh]);

  const s = state.status === "ready" ? state.summary : null;

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
        <LockIcon className="mt-1.5 size-4 shrink-0 text-brand" />
        {t("private")}
      </p>

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
              <>
                <p className="text-sm text-muted-foreground">{t("shareNote")}</p>
                <Button type="button" variant="outline" onClick={() => setSharing(true)} className="h-11 w-full rounded-xl">
                  {t("shareMine")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {s && <RecoveryCard hasCode={s.hasRecoveryCode} onRestored={refresh} />}
    </div>
  );
}

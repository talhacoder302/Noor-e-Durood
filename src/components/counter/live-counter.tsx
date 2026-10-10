"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { NumberLocale } from "@/lib/format";
import type { Totals } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./animated-number";
import { NumberWords } from "./number-words";
import { applyPolled, seedTotals, useTotals } from "./totals-store";

const POLL_MS = 7_000;

function isTotals(data: unknown): data is Totals {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.total === "number" &&
    typeof d.today === "number" &&
    typeof d.month === "number" &&
    typeof d.dayKey === "string"
  );
}

/** Polls /api/stats every 7s while the tab is visible. */
function usePolling(hasInitial: boolean) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    const schedule = () => {
      clearTimeout(timer);
      if (document.visibilityState === "visible") {
        timer = setTimeout(tick, POLL_MS);
      }
    };

    async function tick() {
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch("/api/stats", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data: unknown = await res.json();
        if (!res.ok || !isTotals(data)) throw new Error("Bad stats response");
        applyPolled(data);
        setFailed(false);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setFailed(true);
      }
      schedule();
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void tick();
      } else {
        clearTimeout(timer);
        controller?.abort();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    if (hasInitial) schedule();
    else void tick();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(timer);
      controller?.abort();
    };
  }, [hasInitial]);

  return failed;
}

/** Shrinks the big number as it grows so it never overflows a 375px screen. */
function totalSizeClass(digits: number) {
  if (digits <= 7) return "text-5xl sm:text-6xl";
  if (digits <= 9) return "text-[2.6rem] sm:text-6xl";
  if (digits <= 11) return "text-4xl sm:text-5xl";
  return "text-3xl sm:text-5xl";
}

export function LiveCounter({ initial }: { initial: Totals | null }) {
  const totals = useTotals(initial);

  useEffect(() => {
    seedTotals(initial);
  }, [initial]);

  const failed = usePolling(initial !== null);
  return <CounterView totals={totals} status={failed ? "failed" : "live"} />;
}

/** Static placeholder while the first totals stream in. */
export function LiveCounterSkeleton() {
  return <CounterView totals={null} status="loading" />;
}

function CounterView({
  totals,
  status,
}: {
  totals: Totals | null;
  status: "live" | "failed" | "loading";
}) {
  const t = useTranslations("Counter");
  const locale = useLocale() as NumberLocale;

  return (
    <section aria-labelledby="total-label" className="space-y-3">
      <Card className="gap-0 overflow-hidden border-primary/20 bg-primary py-0 text-primary-foreground shadow-md">
        <CardContent className="flex flex-col items-center gap-2 px-4 py-7 text-center">
          <p id="total-label" className="text-base opacity-90">
            {t("total")}
          </p>

          {totals ? (
            <>
              <AnimatedNumber
                value={totals.total}
                locale={locale}
                className={cn(
                  "leading-tight font-bold tracking-tight",
                  totalSizeClass(String(totals.total).length),
                )}
              />
              <NumberWords
                value={totals.total}
                locale={locale}
                className="min-h-7 text-sm text-gold-soft dark:text-gold"
              />
            </>
          ) : (
            <>
              <Skeleton className="h-12 w-56 max-w-full rounded-lg bg-primary-foreground/15" />
              <Skeleton className="h-4 w-32 rounded bg-primary-foreground/10" />
            </>
          )}

          <p className="flex items-center gap-1.5 text-xs opacity-75" aria-live="polite">
            {status === "failed" ? (
              t("unavailable")
            ) : status === "loading" ? null : (
              <>
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-2 rounded-full bg-gold" />
                </span>
                {t("live")}
              </>
            )}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {(["today", "month"] as const).map((key) => (
          <Card key={key} className="gap-0 py-0">
            <CardContent className="flex flex-col items-center gap-1 px-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">{t(key)}</p>
              {totals ? (
                <AnimatedNumber
                  value={totals[key]}
                  locale={locale}
                  className="text-2xl font-semibold text-brand"
                />
              ) : (
                <Skeleton className="h-8 w-24 rounded-md" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

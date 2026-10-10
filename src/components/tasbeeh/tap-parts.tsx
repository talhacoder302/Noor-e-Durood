"use client";

import { animate } from "framer-motion/dom";
import { CheckIcon, CloudOffIcon, Loader2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCount, type NumberLocale } from "@/lib/format";
import { unsentCount } from "@/lib/tap-queue";
import { cn } from "@/lib/utils";
import { isMilestone, playClick, vibrate } from "./tap-feedback";
import { flush, tap, useTasbeeh } from "./tasbeeh-store";

// Shared by the tasbeeh card and focus mode.

// Taps closer together than this are treated as one (ghost/double touches).
const MIN_TAP_GAP_MS = 80;

export type Milestone = { n: number; id: number };

export function useTapHandler(soundOn: boolean) {
  const lastTap = useRef(0);
  const [milestone, setMilestone] = useState<Milestone | null>(null);

  useEffect(() => {
    if (!milestone) return;
    const t = setTimeout(() => setMilestone(null), 3500);
    return () => clearTimeout(t);
  }, [milestone]);

  function onTap(button: HTMLElement | null) {
    const now = performance.now();
    if (now - lastTap.current < MIN_TAP_GAP_MS) return;
    lastTap.current = now;

    const { session } = tap();
    const big = isMilestone(session);
    vibrate(big ? 70 : 15);
    if (soundOn) playClick(big);
    if (big) setMilestone({ n: session, id: now });

    if (button && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animate(button, { scale: [1, 0.95, 1] }, { duration: 0.16, ease: "easeOut" });
    }
  }

  return { onTap, milestone };
}

export function TapButton({
  count,
  label,
  onTap,
  className,
}: {
  count: number;
  label: string;
  onTap: (el: HTMLElement | null) => void;
  className?: string;
}) {
  const locale = useLocale() as NumberLocale;
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      onClick={() => onTap(ref.current)}
      className={cn(
        // touch-action: manipulation stops double-tap zoom on this button.
        "relative grid aspect-square touch-manipulation place-items-center rounded-full select-none",
        "bg-primary text-primary-foreground shadow-[0_10px_30px_-10px] shadow-primary/60",
        "ring-8 ring-gold/25 outline-none focus-visible:ring-gold/70",
        "[-webkit-tap-highlight-color:transparent]",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-3 rounded-full border border-gold/40" aria-hidden />
      <span className="num pointer-events-none text-5xl font-bold sm:text-6xl" aria-live="off">
        {formatCount(count, locale)}
      </span>
    </button>
  );
}

export function MilestoneMessage({ milestone }: { milestone: Milestone | null }) {
  const t = useTranslations("Tasbeeh");
  const locale = useLocale() as NumberLocale;
  return (
    <p className="min-h-8 text-center text-sm text-gold" aria-live="polite">
      {milestone && (
        <span key={milestone.id} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
          {t(milestone.n === 33 ? "m33" : milestone.n === 100 ? "m100" : milestone.n === 313 ? "m313" : "mThousand", {
            n: formatCount(milestone.n, locale),
          })}
        </span>
      )}
    </p>
  );
}

export function SyncRow() {
  const t = useTranslations("Tasbeeh");
  const tErr = useTranslations("Entry.errors");
  const locale = useLocale() as NumberLocale;
  const { queue, syncing, online, error, errorMax } = useTasbeeh();
  const unsent = unsentCount(queue);

  let note: string | null = null;
  if (!online) note = t("offline");
  else if (error === "daily_limit" || error === "paused" || error === "blocked") {
    note = tErr(error, { max: errorMax ? formatCount(errorMax, locale) : "" });
  } else if (error && unsent > 0) note = t("retryLater");

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex min-h-11 items-center justify-center gap-3">
        {unsent > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t.rich("pending", {
                count: formatCount(unsent, locale),
                n: (chunks) => <span className="num font-semibold text-foreground">{chunks}</span>,
              })}
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => void flush({ manual: true })}
              disabled={syncing}
              className="h-10 rounded-full px-4"
            >
              {syncing && <Loader2Icon className="size-4 animate-spin" />}
              {syncing ? t("syncing") : t("submit")}
            </Button>
          </>
        ) : queue.session > 0 ? (
          <p className="flex items-center gap-1.5 text-sm text-brand">
            <CheckIcon className="size-4" />
            {t("allSaved")}
          </p>
        ) : null}
      </div>
      {note && (
        <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
          {!online && <CloudOffIcon className="size-4 shrink-0" />}
          {note}
        </p>
      )}
    </div>
  );
}

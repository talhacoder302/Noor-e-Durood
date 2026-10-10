"use client";

import { animate } from "framer-motion/dom";
import {
  CheckIcon,
  CloudOffIcon,
  Loader2Icon,
  Maximize2Icon,
  RotateCcwIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { SHORT_DUROOD } from "@/lib/durood";
import { formatCount, type NumberLocale } from "@/lib/format";
import { unsentCount } from "@/lib/tap-queue";
import { useLocalPref } from "@/lib/use-local-pref";
import { cn } from "@/lib/utils";
import { isMilestone, playClick, vibrate } from "./tap-feedback";
import { flush, resetSession, tap, useTasbeeh } from "./tasbeeh-store";

// Taps closer together than this are treated as one (ghost/double touches).
const MIN_TAP_GAP_MS = 80;

type Milestone = { n: number; id: number };

function useTapHandler(soundOn: boolean) {
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

function TapButton({
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

function MilestoneMessage({ milestone }: { milestone: Milestone | null }) {
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

function SyncRow() {
  const t = useTranslations("Tasbeeh");
  const tErr = useTranslations("Entry.errors");
  const locale = useLocale() as NumberLocale;
  const { queue, syncing, online, error, errorMax } = useTasbeeh();
  const unsent = unsentCount(queue);

  let note: string | null = null;
  if (!online) note = t("offline");
  else if (error === "daily_limit" || error === "paused") {
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

function ResetButton() {
  const t = useTranslations("Tasbeeh");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-10 gap-1.5 rounded-full">
          <RotateCcwIcon className="size-4" />
          {t("reset")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="leading-loose">{t("resetTitle")}</DialogTitle>
          <DialogDescription>{t("resetBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("cancel")}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="button" onClick={resetSession}>
              {t("resetConfirm")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Keeps the screen on while focus mode is open (where supported). */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) void next.release();
        else lock = next;
      } catch {
        // Denied (battery saver etc.).
      }
    };
    // The lock is dropped whenever the tab is hidden; take it again on return.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release();
    };
  }, [active]);
}

function FocusMode({
  onClose,
  onTap,
  milestone,
}: {
  onClose: () => void;
  onTap: (el: HTMLElement | null) => void;
  milestone: Milestone | null;
}) {
  const t = useTranslations("Tasbeeh");
  const { queue } = useTasbeeh();
  useWakeLock(true);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("focus")}
      className="islamic-pattern fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background px-6"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label={t("exitFocus")}
        className="absolute top-4 end-4 size-11 rounded-full"
      >
        <XIcon className="size-6" />
      </Button>
      <p lang="ar" dir="rtl" className="arabic-text text-center text-2xl text-brand">
        {SHORT_DUROOD}
      </p>
      <TapButton
        count={queue.session}
        label={t("tapLabel")}
        onTap={onTap}
        className="w-[min(80vw,24rem)]"
      />
      <MilestoneMessage milestone={milestone} />
      <SyncRow />
    </div>,
    document.body,
  );
}

export function TasbeehPanel() {
  const t = useTranslations("Tasbeeh");
  const { queue } = useTasbeeh();
  const [sound, setSound] = useLocalPref<"on" | "off">("noor.tapSound", "off");
  const [focus, setFocus] = useState(false);
  const { onTap, milestone } = useTapHandler(sound === "on");

  const enterFocus = () => {
    setFocus(true);
    // Hides the browser bars on Android; not available everywhere.
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const exitFocus = () => {
    setFocus(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  };

  return (
    <Card className="gap-0 py-5">
      <CardContent className="flex flex-col items-center gap-3 px-4">
        <p lang="ar" dir="rtl" className="arabic-text text-center text-2xl text-brand">
          {SHORT_DUROOD}
        </p>
        <p className="text-sm text-muted-foreground">{t("session")}</p>

        <TapButton
          count={queue.session}
          label={t("tapLabel")}
          onTap={onTap}
          className="w-[min(68vw,18rem)]"
        />
        <p className="text-xs text-muted-foreground">{t("hint")}</p>

        <MilestoneMessage milestone={focus ? null : milestone} />
        <SyncRow />

        <div className="mt-1 flex w-full flex-wrap items-center justify-center gap-1 border-t pt-3">
          <label className="flex h-10 items-center gap-2 rounded-full px-3 text-sm">
            {sound === "on" ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />}
            {t("sound")}
            <Switch
              checked={sound === "on"}
              onCheckedChange={(on) => setSound(on ? "on" : "off")}
              aria-label={t("sound")}
            />
          </label>
          <Button type="button" variant="ghost" size="sm" onClick={enterFocus} className="h-10 gap-1.5 rounded-full">
            <Maximize2Icon className="size-4" />
            {t("focus")}
          </Button>
          <ResetButton />
        </div>
      </CardContent>

      {focus && <FocusMode onClose={exitFocus} onTap={onTap} milestone={milestone} />}
    </Card>
  );
}

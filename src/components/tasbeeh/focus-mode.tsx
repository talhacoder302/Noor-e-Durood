"use client";

import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { SHORT_DUROOD } from "@/lib/durood";
import { MilestoneMessage, SyncRow, TapButton, type Milestone } from "./tap-parts";
import { useTasbeeh } from "./tasbeeh-store";

// Loaded only when focus mode is opened (next/dynamic in tasbeeh-panel).

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

export function FocusMode({
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

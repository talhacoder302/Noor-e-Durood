"use client";

import { Maximize2Icon, RotateCcwIcon, Volume2Icon, VolumeXIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SHORT_DUROOD } from "@/lib/durood";
import { useLocalPref } from "@/lib/use-local-pref";
import { MilestoneMessage, SyncRow, TapButton, useTapHandler } from "./tap-parts";
import { useTasbeeh } from "./tasbeeh-store";

// Focus mode and the reset dialog are only downloaded when opened, keeping
// them out of the first page load on slow phones.
const FocusMode = dynamic(() => import("./focus-mode").then((m) => m.FocusMode), { ssr: false });
const ResetDialog = dynamic(() => import("./reset-dialog").then((m) => m.ResetDialog), { ssr: false });

export function TasbeehPanel() {
  const t = useTranslations("Tasbeeh");
  const { queue } = useTasbeeh();
  const [sound, setSound] = useLocalPref<"on" | "off">("noor.tapSound", "off");
  const [focus, setFocus] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setResetOpen(true)}
            className="h-10 gap-1.5 rounded-full"
          >
            <RotateCcwIcon className="size-4" />
            {t("reset")}
          </Button>
        </div>
      </CardContent>

      {resetOpen && <ResetDialog open={resetOpen} onOpenChange={setResetOpen} />}
      {focus && <FocusMode onClose={exitFocus} onTap={onTap} milestone={milestone} />}
    </Card>
  );
}

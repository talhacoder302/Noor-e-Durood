"use client";

import { DownloadIcon, ShareIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { canPromptInstall, isIosSafari, isStandalone, promptInstall, subscribeInstall } from "./install-store";

type Mode = "none" | "prompt" | "ios";

function currentMode(): Mode {
  if (isStandalone()) return "none";
  if (canPromptInstall()) return "prompt";
  return isIosSafari() ? "ios" : "none";
}

/** "Install app" card. Hidden when installed or when the browser can't install. */
export function InstallPrompt() {
  const t = useTranslations("Install");
  const mode = useSyncExternalStore(subscribeInstall, currentMode, () => "none" as Mode);

  if (mode === "none") return null;

  return (
    <Card className="gap-0 border-gold/30 py-4">
      <CardContent className="flex items-center gap-3">
        <Image src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t("title")}</p>
          <p className="text-xs text-muted-foreground">
            {mode === "ios" ? (
              <>
                {t("iosHintBefore")} <ShareIcon className="inline size-3.5 align-[-2px]" /> {t("iosHintAfter")}
              </>
            ) : (
              t("sub")
            )}
          </p>
        </div>
        {mode === "prompt" && (
          <Button type="button" onClick={() => void promptInstall()} className="h-10 shrink-0 gap-1.5 rounded-full">
            <DownloadIcon className="size-4" />
            {t("button")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

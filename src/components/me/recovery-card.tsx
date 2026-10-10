"use client";

import { CopyIcon, KeyRoundIcon, Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { getDeviceId, rememberDeviceId } from "@/lib/device-id";
import { formatRecoveryCode, isRecoveryCode, normalizeRecoveryCode } from "@/lib/recovery-code";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/**
 * Optional, no login: make a code here, type it on another phone, and both
 * phones share one personal count from then on.
 */
export function RecoveryCard({
  hasCode,
  onRestored,
}: {
  hasCode: boolean;
  onRestored: () => void;
}) {
  const t = useTranslations("Recovery");
  const [code, setCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [input, setInput] = useState("");
  const [restoring, setRestoring] = useState(false);

  async function create() {
    setCreating(true);
    try {
      const { status, data } = await postJson("/api/recovery", { deviceId: await getDeviceId() });
      if (status === 200 && typeof data.code === "string") {
        setCode(data.code);
      } else {
        toast.error(t(status === 429 ? "errors.rate_limited" : "errors.server"));
      }
    } catch {
      toast.error(t("errors.network"));
    } finally {
      setCreating(false);
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(formatRecoveryCode(code));
      toast.success(t("copied"));
    } catch {
      // Clipboard blocked: the code is on screen to write down.
    }
  }

  async function restore(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeRecoveryCode(input);
    if (!isRecoveryCode(normalized)) {
      toast.error(t("errors.invalid"));
      return;
    }
    setRestoring(true);
    try {
      const { status, data } = await postJson("/api/recovery/restore", {
        deviceId: await getDeviceId(),
        code: normalized,
      });
      if (status === 200 && typeof data.deviceId === "string") {
        rememberDeviceId(data.deviceId);
        setInput("");
        toast.success(t("restored"));
        onRestored();
      } else {
        const key = status === 404 ? "not_found" : status === 429 ? "rate_limited" : status === 400 ? "invalid" : "server";
        toast.error(t(`errors.${key}`));
      }
    } catch {
      toast.error(t("errors.network"));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg leading-loose">
          <KeyRoundIcon className="size-5 text-gold" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("intro")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          {code ? (
            <div className="space-y-3 rounded-xl border border-gold/40 bg-accent/40 p-4 text-center">
              <p className="num text-3xl font-bold tracking-[0.2em] text-brand" dir="ltr">
                {formatRecoveryCode(code)}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={copy} className="h-10 gap-1.5 rounded-full">
                <CopyIcon className="size-4" />
                {t("copy")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("saveIt")}</p>
            </div>
          ) : (
            <>
              {hasCode && <p className="text-xs text-muted-foreground">{t("hasCode")}</p>}
              <Button type="button" onClick={create} disabled={creating} className="h-11 w-full rounded-xl">
                {creating && <Loader2Icon className="size-4 animate-spin" />}
                {hasCode ? t("createNew") : t("create")}
              </Button>
            </>
          )}
        </div>

        <Separator />

        <form onSubmit={restore} className="space-y-3">
          <label htmlFor="recovery-code" className="block text-sm font-medium">
            {t("haveCode")}
          </label>
          <div className="flex gap-2">
            <Input
              id="recovery-code"
              dir="ltr"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="ABCD-EFGH"
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 16))}
              className="num h-11 rounded-xl text-center text-lg tracking-widest"
            />
            <Button type="submit" disabled={restoring || !input} className="h-11 rounded-xl px-5">
              {restoring && <Loader2Icon className="size-4 animate-spin" />}
              {t("restore")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("restoreNote")}</p>
        </form>
      </CardContent>
    </Card>
  );
}

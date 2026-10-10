"use client";

import { KeyRoundIcon, Loader2Icon, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isValidPinFormat, isWeakPin, normalizePin, PIN_LENGTH } from "@/lib/pin";
import type { PublicUser } from "@/lib/types";
import { setSessionUser } from "./session-store";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as { error?: string } };
}

function PinInput({
  value,
  onChange,
  label,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoComplete: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm">{label}</span>
      <Input
        type="password"
        inputMode="numeric"
        autoComplete={autoComplete}
        dir="ltr"
        maxLength={PIN_LENGTH}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, PIN_LENGTH))}
        className="num h-11 text-center text-xl tracking-[0.5em]"
        required
      />
    </label>
  );
}

function ChangePin() {
  const t = useTranslations("Auth");
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = normalizePin(newPin);
    if (!isValidPinFormat(next)) return void toast.error(t("errors.invalid_pin"));
    if (isWeakPin(next)) return void toast.error(t("errors.weak_pin"));
    if (next !== normalizePin(newPin2)) return void toast.error(t("errors.pin_mismatch"));

    setPending(true);
    try {
      const { ok, data } = await postJson("/api/auth/pin", { oldPin: normalizePin(oldPin), newPin: next });
      if (ok) {
        toast.success(t("pinChanged"));
        setOldPin("");
        setNewPin("");
        setNewPin2("");
      } else {
        const key = data.error === "wrong" ? "old_pin_wrong" : data.error === "weak_pin" || data.error === "invalid_pin" ? data.error : "server";
        toast.error(t(`errors.${key}`));
      }
    } catch {
      toast.error(t("errors.network"));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm font-medium">{t("changePin")}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <PinInput value={oldPin} onChange={setOldPin} label={t("oldPin")} autoComplete="current-password" />
        <PinInput value={newPin} onChange={setNewPin} label={t("newPin")} autoComplete="new-password" />
        <PinInput value={newPin2} onChange={setNewPin2} label={t("pinConfirm")} autoComplete="new-password" />
      </div>
      <Button type="submit" variant="outline" disabled={pending} className="h-11 w-full sm:w-auto">
        {pending && <Loader2Icon className="size-4 animate-spin" />}
        {t("changePin")}
      </Button>
    </form>
  );
}

/** PIN change and logging out. */
export function AccountPanel({ user }: { user: PublicUser }) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const [pending, setPending] = useState<"one" | "all" | null>(null);

  async function logout(all: boolean) {
    setPending(all ? "all" : "one");
    try {
      await postJson("/api/auth/logout", { all });
      setSessionUser(null);
      toast.success(t(all ? "loggedOutAll" : "loggedOut"));
      router.replace(locale === "en" ? "/en" : "/");
    } catch {
      toast.error(t("errors.network"));
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg leading-loose">
          <KeyRoundIcon className="size-5 text-gold" />
          {t("accountTitle")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("loggedInAs")}{" "}
          <span className="num font-medium text-foreground">{user.phoneMasked}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <ChangePin />
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => logout(false)}
            disabled={pending !== null}
            className="gap-1.5"
          >
            {pending === "one" ? <Loader2Icon className="size-4 animate-spin" /> : <LogOutIcon className="size-4" />}
            {t("logout")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => logout(true)} disabled={pending !== null} className="gap-1.5">
            {pending === "all" && <Loader2Icon className="size-4 animate-spin" />}
            {t("logoutAll")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

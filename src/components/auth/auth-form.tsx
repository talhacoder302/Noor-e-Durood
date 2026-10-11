"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { normalizePhone } from "@/lib/phone";
import { isValidPinFormat, isWeakPin, normalizePin } from "@/lib/pin";
import type { PublicUser } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PinInput } from "./pin-input";
import { safeNext, setSessionUser } from "./session-store";

type Mode = "login" | "signup";

const ERROR_KEYS = new Set([
  "invalid_phone",
  "invalid_pin",
  "weak_pin",
  "phone_taken",
  "wrong",
  "locked",
  "disabled",
  "rate_limited",
]);

/** Log in or create an account: phone number + 4-digit PIN, nothing else. */
export function AuthForm() {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (message: string) => {
    setError(message);
    toast.error(message);
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const cleanPin = normalizePin(pin);

    // Same checks as the server, so most mistakes show without a round trip.
    if (!normalizePhone(phone)) return fail(t("errors.invalid_phone"));
    if (!isValidPinFormat(cleanPin)) return fail(t("errors.invalid_pin"));
    if (mode === "signup") {
      if (isWeakPin(cleanPin)) return fail(t("errors.weak_pin"));
      if (cleanPin !== normalizePin(pin2)) return fail(t("errors.pin_mismatch"));
    }

    setPending(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin: cleanPin }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        user?: PublicUser;
        error?: string;
        retryAfterMinutes?: number;
      };
      if (res.ok && data.user) {
        setSessionUser(data.user);
        toast.success(mode === "signup" ? t("welcomeNew") : t("welcomeBack"));
        // New accounts go on to the (optional) profile; the page they came from is kept.
        const next = safeNext(params.get("next"));
        const profile = locale === "en" ? "/en/profile" : "/profile";
        router.replace(mode === "signup" ? `${profile}?welcome=1&next=${encodeURIComponent(next)}` : next);
        return;
      }
      const key = data.error && ERROR_KEYS.has(data.error) ? data.error : "server";
      fail(t(`errors.${key}`, { minutes: data.retryAfterMinutes ?? 15 }));
    } catch {
      fail(t("errors.network"));
    } finally {
      setPending(false);
    }
  }

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  return (
    <Card className="mx-auto w-full max-w-sm gap-4 py-5">
      <CardContent className="space-y-5 px-5">
        <div className="grid grid-cols-2 rounded-full bg-muted p-1" role="tablist">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchTo(m)}
              className={cn(
                "h-10 rounded-full text-sm font-medium transition-colors",
                mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {m === "login" ? t("loginTab") : t("signupTab")}
            </button>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? t("loginIntro") : t("signupIntro")}
        </p>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t("phone")}</span>
            <Input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder="03001234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="num h-12 text-center text-lg"
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t("pin")}</span>
            <PinInput
              name="pin"
              value={pin}
              onChange={setPin}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          {mode === "signup" && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">{t("pinConfirm")}</span>
              <PinInput name="pin2" value={pin2} onChange={setPin2} autoComplete="new-password" />
            </label>
          )}

          {error && (
            <p role="alert" className="text-center text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl text-base">
            {pending && <Loader2Icon className="size-4 animate-spin" />}
            {mode === "login" ? t("loginButton") : t("signupButton")}
          </Button>
        </form>

        {mode === "login" ? (
          <p className="text-center text-xs text-muted-foreground">{t("forgotPin")}</p>
        ) : (
          <p className="text-center text-xs text-muted-foreground">{t("pinHint")}</p>
        )}
      </CardContent>
    </Card>
  );
}

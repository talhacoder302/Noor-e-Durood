"use client";

import { Loader2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDeviceId, rememberDeviceId } from "@/lib/device-id";
import { formatCount, normalizeDigits, type NumberLocale } from "@/lib/format";
import { submitDurood } from "@/lib/submit-durood";
import { randomUuid } from "@/lib/uuid";
import {
  addOptimistic,
  applyConfirmed,
  rollbackOptimistic,
} from "./totals-store";

const QUICK_ADDS = [11, 33, 100, 313, 1000] as const;
const MAX_DIGITS = 7;

export function NumberEntry() {
  const t = useTranslations("Entry");
  const locale = useLocale() as NumberLocale;
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  // Create the anonymous device id (and its cookie) on first visit.
  useEffect(() => {
    void getDeviceId();
  }, []);

  const setDigits = (raw: string) =>
    setValue(normalizeDigits(raw).replace(/^0+/, "").slice(0, MAX_DIGITS));

  const quickAdd = (n: number) =>
    setDigits(String((Number(value) || 0) + n));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;

    const count = Number(value);
    if (!Number.isInteger(count) || count < 1) {
      toast.error(t("errors.invalid"));
      return;
    }

    setPending(true);
    addOptimistic(count);

    try {
      const deviceId = await getDeviceId();
      const result = await submitDurood({
        deviceId,
        clientId: randomUuid(),
        count,
        mode: "number",
      });

      if (result.ok) {
        rememberDeviceId(result.deviceId);
        applyConfirmed(result.totals);
        setValue("");
        toast.success(t("success"));
      } else {
        rollbackOptimistic(count);
        toast.error(
          t(`errors.${result.error}`, {
            max: result.max ? formatCount(result.max, locale) : "",
          }),
        );
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="gap-4">
      <CardHeader className="text-center">
        <CardTitle className="text-lg leading-loose font-semibold text-brand">
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label htmlFor="durood-count" className="sr-only">
            {t("label")}
          </label>
          <Input
            id="durood-count"
            name="count"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            dir="ltr"
            placeholder={t("placeholder")}
            value={value}
            onChange={(e) => setDigits(e.target.value)}
            disabled={pending}
            className="num h-14 rounded-xl text-center text-2xl font-semibold md:text-2xl"
          />

          <div className="grid grid-cols-5 gap-2" role="group" aria-label={t("quickLabel")}>
            {QUICK_ADDS.map((n) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                onClick={() => quickAdd(n)}
                disabled={pending}
                aria-label={t("quickAdd", { n })}
                className="num h-11 rounded-xl px-0 text-sm font-medium"
              >
                +{n}
              </Button>
            ))}
          </div>

          <Button
            type="submit"
            disabled={pending || !value}
            className="h-13 rounded-xl text-lg"
          >
            {pending && <Loader2Icon className="size-5 animate-spin" />}
            {pending ? t("submitting") : t("submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

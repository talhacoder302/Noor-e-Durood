"use client";

import { Loader2Icon, UserRoundPenIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { normalizeDigits } from "@/lib/format";
import type { PublicUser } from "@/lib/types";
import { setSessionUser } from "./session-store";

type MajlisOption = { id: string; name: string; nameEn: string; city: string };

const OTHER = "other";

const selectClass =
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Optional profile: name, majlis (from the admin's list or "other"), age, city. */
export function ProfileForm({ user, onSaved }: { user: PublicUser; onSaved?: () => void }) {
  const t = useTranslations("Profile");
  const locale = useLocale();
  const [majalis, setMajalis] = useState<MajlisOption[] | null>(null);
  const [name, setName] = useState(user.name);
  const [majlis, setMajlis] = useState(user.majlisId ?? (user.majlisOther ? OTHER : ""));
  const [majlisOther, setMajlisOther] = useState(user.majlisOther);
  const [age, setAge] = useState(user.age ? String(user.age) : "");
  const [city, setCity] = useState(user.city);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/majalis")
      .then((r) => (r.ok ? (r.json() as Promise<{ majalis: MajlisOption[] }>) : { majalis: [] }))
      .then((d) => alive && setMajalis(d.majalis))
      .catch(() => alive && setMajalis([]));
    return () => {
      alive = false;
    };
  }, []);

  const label = (m: MajlisOption) => {
    const n = locale === "en" && m.nameEn ? m.nameEn : m.name;
    return m.city ? `${n} (${m.city})` : n;
  };

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          majlis,
          majlisOther: majlis === OTHER ? majlisOther : "",
          age: age === "" ? "" : Number(age),
          city,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { user?: PublicUser; error?: string; field?: string };
      if (res.ok && data.user) {
        setSessionUser(data.user);
        toast.success(t("saved"));
        onSaved?.();
      } else if (data.error === "login_required") {
        setSessionUser(null);
      } else {
        toast.error(data.field ? t("invalidField", { field: t(`fields.${data.field}`) }) : t("saveFailed"));
      }
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg leading-loose">
          <UserRoundPenIcon className="size-5 text-gold" />
          {t("formTitle")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t("optional")}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t("fields.name")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" className="h-11" />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">{t("fields.majlis")}</span>
            <select
              value={majlis}
              onChange={(e) => setMajlis(e.target.value)}
              className={selectClass}
              disabled={majalis === null}
            >
              <option value="">{majalis === null ? t("loadingMajalis") : t("chooseMajlis")}</option>
              {majalis?.map((m) => (
                <option key={m.id} value={m.id}>
                  {label(m)}
                </option>
              ))}
              <option value={OTHER}>{t("otherMajlis")}</option>
            </select>
          </label>

          {majlis === OTHER && (
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">{t("fields.majlisOther")}</span>
              <Input value={majlisOther} onChange={(e) => setMajlisOther(e.target.value)} maxLength={80} className="h-11" />
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">{t("fields.age")}</span>
              <Input
                inputMode="numeric"
                dir="ltr"
                value={age}
                onChange={(e) => setAge(normalizeDigits(e.target.value).slice(0, 3))}
                className="num h-11 text-center"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">{t("fields.city")}</span>
              <Input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} autoComplete="address-level2" className="h-11" />
            </label>
          </div>

          <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
            {pending && <Loader2Icon className="size-4 animate-spin" />}
            {t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

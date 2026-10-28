import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { z } from "zod";
import { AdminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSkeleton } from "@/components/admin/admin-skeleton";
import { EntryCard } from "@/components/admin/entry-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { NumberLocale } from "@/lib/format";
import { listEntries } from "@/server/admin";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

const HOURS = [1, 6, 24, 168] as const;

// Empty form fields arrive as "" and mean "no filter".
const blank = (v: unknown) => (v === "" || Array.isArray(v) ? undefined : v);
const filterSchema = z.object({
  min: z.preprocess(blank, z.coerce.number().int().min(1).max(1e9).optional()),
  device: z.preprocess(blank, z.string().regex(/^[0-9a-fA-F-]{1,36}$/).optional()),
  user: z.preprocess(blank, z.string().regex(/^[0-9a-f]{24}$/).optional()),
  phone: z.preprocess(blank, z.string().trim().max(32).optional()),
  hours: z.preprocess(blank, z.coerce.number().int().refine((h) => (HOURS as readonly number[]).includes(h)).optional()),
  removed: z.preprocess(blank, z.literal("1").optional()),
  before: z.preprocess(blank, z.iso.datetime().optional()),
});

async function Entries({ searchParams, locale }: { searchParams: Promise<SearchParams>; locale: NumberLocale }) {
  const t = await getTranslations("Admin");
  const parsed = filterSchema.safeParse(await searchParams);
  const f = parsed.success ? parsed.data : {};
  const { entries, nextBefore } = await listEntries({
    minCount: f.min,
    device: f.device,
    userId: f.user,
    phone: f.phone,
    hours: f.hours,
    showRemoved: f.removed === "1",
    before: f.before ? new Date(f.before) : undefined,
  });

  const query = Object.fromEntries(
    Object.entries({ min: f.min, device: f.device, user: f.user, phone: f.phone, hours: f.hours, removed: f.removed }).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;

  return (
    <div className="space-y-4">
      <form method="get" className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 sm:grid-cols-5">
        <label className="space-y-1 text-xs">
          <span>{t("filterMin")}</span>
          <Input name="min" type="number" min={1} defaultValue={f.min} dir="ltr" className="h-9" />
        </label>
        <label className="space-y-1 text-xs">
          <span>{t("filterPhone")}</span>
          <Input name="phone" type="tel" defaultValue={f.phone} dir="ltr" className="h-9" placeholder="03250062540" />
        </label>
        {/* Kept when coming from a link (a user's or an old device's entries). */}
        {f.user && <input type="hidden" name="user" value={f.user} />}
        {f.device && <input type="hidden" name="device" value={f.device} />}
        <label className="space-y-1 text-xs">
          <span>{t("filterTime")}</span>
          <select
            name="hours"
            defaultValue={f.hours ?? ""}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">{t("anyTime")}</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {t("lastHours", { h })}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs">
          <input type="checkbox" name="removed" value="1" defaultChecked={f.removed === "1"} className="size-4" />
          {t("showRemoved")}
        </label>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
          <Button type="submit" size="sm" className="h-9 flex-1">
            {t("apply")}
          </Button>
          <Button asChild type="button" variant="ghost" size="sm" className="h-9">
            <Link href="/admin/entries">{t("clear")}</Link>
          </Button>
        </div>
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noEntries")}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <EntryCard key={e.id} entry={e} locale={locale} />
          ))}
        </ul>
      )}

      {nextBefore && (
        <Button asChild variant="outline" className="w-full">
          <Link href={{ pathname: "/admin/entries", query: { ...query, before: nextBefore } }}>{t("older")}</Link>
        </Button>
      )}
    </div>
  );
}

export default function AdminEntriesPage({ params, searchParams }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminGate>
        <AdminNav current="/admin/entries" />
        <Entries searchParams={searchParams} locale={locale as NumberLocale} />
      </AdminGate>
    </Suspense>
  );
}

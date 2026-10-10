import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { z } from "zod";
import { enableUserAction } from "@/app/[locale]/admin/actions";
import { AdminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSkeleton } from "@/components/admin/admin-skeleton";
import { DisableUserButton, ResetPinButton } from "@/components/admin/entry-actions";
import { formatKarachiTime } from "@/components/admin/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatCount, type NumberLocale } from "@/lib/format";
import { listUsers } from "@/server/admin";
import { listAllMajalis } from "@/server/majalis";

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

const blank = (v: unknown) => (v === "" || Array.isArray(v) ? undefined : v);
const filterSchema = z.object({
  q: z.preprocess(blank, z.string().trim().max(60).optional()),
  majlis: z.preprocess(blank, z.string().regex(/^[0-9a-f]{24}$/).optional()),
  disabled: z.preprocess(blank, z.literal("1").optional()),
  before: z.preprocess(blank, z.iso.datetime().optional()),
});

async function Users({ searchParams, locale }: { searchParams: Promise<SearchParams>; locale: NumberLocale }) {
  const t = await getTranslations("Admin");
  const parsed = filterSchema.safeParse(await searchParams);
  const f = parsed.success ? parsed.data : {};
  const [{ users, nextBefore }, majalis] = await Promise.all([
    listUsers({
      q: f.q,
      majlisId: f.majlis,
      disabledOnly: f.disabled === "1",
      before: f.before ? new Date(f.before) : undefined,
    }),
    listAllMajalis(),
  ]);
  const query = Object.fromEntries(
    Object.entries({ q: f.q, majlis: f.majlis, disabled: f.disabled }).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;

  return (
    <div className="space-y-4">
      <form method="get" className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 sm:grid-cols-4">
        <label className="col-span-2 space-y-1 text-xs sm:col-span-1">
          <span>{t("searchUsers")}</span>
          <Input name="q" defaultValue={f.q} className="h-9" placeholder="0300… / name" />
        </label>
        <label className="space-y-1 text-xs">
          <span>{t("majlis")}</span>
          <select
            name="majlis"
            defaultValue={f.majlis ?? ""}
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">{t("allMajalis")}</option>
            {majalis.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-xs">
          <input type="checkbox" name="disabled" value="1" defaultChecked={f.disabled === "1"} className="size-4" />
          {t("disabledOnly")}
        </label>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
          <Button type="submit" size="sm" className="h-9 flex-1">
            {t("apply")}
          </Button>
          <Button asChild type="button" variant="ghost" size="sm" className="h-9">
            <Link href="/admin/users">{t("clear")}</Link>
          </Button>
        </div>
      </form>

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noUsers")}</p>
      ) : (
        <ul className="space-y-2">
          {users.map((u) => {
            const label = u.name || u.phone;
            return (
              <li key={u.id} className="space-y-2 rounded-xl border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{u.name || "—"}</span>
                  <span className="num text-sm text-muted-foreground" dir="ltr">
                    {u.phone}
                  </span>
                  {u.disabled && <Badge variant="destructive">{t("disabledBadge")}</Badge>}
                  {u.locked && <Badge variant="outline">{t("lockedBadge")}</Badge>}
                  <span className="num ms-auto text-lg font-bold text-brand">{formatCount(u.totalCount, locale)}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{u.majlisName ?? (u.majlisOther ? `${u.majlisOther} (${t("otherShort")})` : t("noMajlis"))}</span>
                  {u.age !== null && <span>{t("ageLabel", { age: u.age })}</span>}
                  {u.city && <span>{u.city}</span>}
                  <span className="num">{t("joined", { date: formatKarachiTime(u.createdAt, locale) })}</span>
                  {u.lastLoginAt && <span className="num">{t("lastLogin", { date: formatKarachiTime(u.lastLoginAt, locale) })}</span>}
                </div>
                {u.disabled && u.disabledReason && (
                  <p className="text-xs text-muted-foreground">{t("reasonLabel", { reason: u.disabledReason })}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={{ pathname: "/admin/entries", query: { user: u.id } }}>{t("viewEntries")}</Link>
                  </Button>
                  <ResetPinButton userId={u.id} label={label} />
                  {u.disabled ? (
                    <form action={enableUserAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <Button type="submit" variant="outline" size="sm">
                        {t("enableUser")}
                      </Button>
                    </form>
                  ) : (
                    <DisableUserButton userId={u.id} label={label} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {nextBefore && (
        <Button asChild variant="outline" className="w-full">
          <Link href={{ pathname: "/admin/users", query: { ...query, before: nextBefore } }}>{t("older")}</Link>
        </Button>
      )}
    </div>
  );
}

export default function AdminUsersPage({ params, searchParams }: Props) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminGate>
        <AdminNav current="/admin/users" />
        <Users searchParams={searchParams} locale={locale as NumberLocale} />
      </AdminGate>
    </Suspense>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSkeleton } from "@/components/admin/admin-skeleton";
import { BarChart } from "@/components/admin/bar-chart";
import { EntryCard } from "@/components/admin/entry-card";
import { Card, CardContent } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { formatCount, type NumberLocale } from "@/lib/format";
import { getDashboard } from "@/server/admin";

type Params = { params: Promise<{ locale: string }> };

function Stat({ label, value, locale }: { label: string; value: number; locale: NumberLocale }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col gap-1 px-4 py-3">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="num text-xl font-semibold text-brand">{formatCount(value, locale)}</span>
      </CardContent>
    </Card>
  );
}

async function Dashboard({ locale }: { locale: NumberLocale }) {
  const t = await getTranslations("Admin");
  const d = await getDashboard();
  const dayLabel = (day: string) => day.slice(8);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label={t("total")} value={d.totals.total} locale={locale} />
        <Stat label={t("today")} value={d.totals.today} locale={locale} />
        <Stat label={t("month")} value={d.totals.month} locale={locale} />
        <Stat label={t("entriesToday")} value={d.entriesToday} locale={locale} />
        <Stat label={t("users")} value={d.users} locale={locale} />
        <Stat label={t("newUsersToday")} value={d.newUsersToday} locale={locale} />
        <Stat label={t("activeUsers")} value={d.activeUsersToday} locale={locale} />
        <Stat label={t("disabledUsers")} value={d.disabledUsers} locale={locale} />
      </div>

      <Card>
        <CardContent>
          <BarChart
            title={t("perHour")}
            bars={d.perHour.map((value, h) => ({ key: String(h), label: String(h).padStart(2, "0"), value }))}
            defaultIndex={d.currentHour}
            labelEvery={3}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <BarChart
            title={t("last30")}
            bars={d.last30.map((x) => ({ key: x.day, label: dayLabel(x.day), value: x.count }))}
            labelEvery={5}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg leading-loose font-semibold">{t("majlisThisMonth")}</h2>
        {d.majlisThisMonth.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noEntries")}</p>
        ) : (
          <Card className="gap-0 py-0">
            <CardContent className="px-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-start font-medium">{t("majlis")}</th>
                    <th className="px-4 py-2 text-end font-medium">{t("usersCol")}</th>
                    <th className="px-4 py-2 text-end font-medium">{t("durood")}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.majlisThisMonth.map((m) => (
                    <tr key={m.id ?? "none"} className="border-b last:border-0">
                      <td className="px-4 py-2">{m.name ?? t("noMajlis")}</td>
                      <td className="num px-4 py-2 text-end">{formatCount(m.users, locale)}</td>
                      <td className="num px-4 py-2 text-end font-semibold">{formatCount(m.count, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg leading-loose font-semibold">{t("topEntries")}</h2>
        {d.topEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noEntries")}</p>
        ) : (
          <ul className="space-y-2">
            {d.topEntries.map((e) => (
              <EntryCard key={e.id} entry={e} locale={locale} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function AdminPage({ params }: Params) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminGate>
        <AdminNav current="/admin" />
        <Dashboard locale={locale as NumberLocale} />
      </AdminGate>
    </Suspense>
  );
}

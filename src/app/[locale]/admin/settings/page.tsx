import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { unblockDeviceAction } from "@/app/[locale]/admin/actions";
import { AdminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSkeleton } from "@/components/admin/admin-skeleton";
import { formatKarachiTime, shortDevice } from "@/components/admin/format";
import { RecalcButton } from "@/components/admin/recalc-button";
import { SettingsForm } from "@/components/admin/settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { listBlockedDevices } from "@/server/admin";
import { getSettings } from "@/server/settings";

type Params = { params: Promise<{ locale: string }> };

async function SettingsView({ locale }: { locale: string }) {
  const t = await getTranslations("Admin");
  const [settings, blocked] = await Promise.all([getSettings(), listBlockedDevices()]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg leading-loose">{t("settingsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm values={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg leading-loose">{t("blockedTitle")}</CardTitle>
          <CardDescription>{t("blockedHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {blocked.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noBlocked")}</p>
          ) : (
            <ul className="divide-y">
              {blocked.map((b) => (
                <li key={b.deviceId} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                  <span className="num rounded bg-muted px-1.5 py-0.5" dir="ltr">
                    {shortDevice(b.deviceId)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{b.reason}</span>
                  <span className="num text-xs text-muted-foreground">{formatKarachiTime(b.blockedAt, locale)}</span>
                  <form action={unblockDeviceAction}>
                    <input type="hidden" name="deviceId" value={b.deviceId} />
                    <Button type="submit" variant="ghost" size="sm">
                      {t("unblock")}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg leading-loose">{t("recalcTitle")}</CardTitle>
          <CardDescription>{t("recalcHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RecalcButton />
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminSettingsPage({ params }: Params) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminGate>
        <AdminNav current="/admin/settings" />
        <SettingsView locale={locale} />
      </AdminGate>
    </Suspense>
  );
}

import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSkeleton } from "@/components/admin/admin-skeleton";
import { RecalcButton } from "@/components/admin/recalc-button";
import { SettingsForm } from "@/components/admin/settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { getSettings } from "@/server/settings";

type Params = { params: Promise<{ locale: string }> };

async function SettingsView() {
  const t = await getTranslations("Admin");
  const settings = await getSettings();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg leading-loose">{t("settingsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* React resets a form after its action finishes, and the switches reset
              to the value they mounted with (not the new one). Remounting on every
              saved change starts the form from what's actually stored. */}
          <SettingsForm key={JSON.stringify(settings)} values={settings} />
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
        <SettingsView />
      </AdminGate>
    </Suspense>
  );
}

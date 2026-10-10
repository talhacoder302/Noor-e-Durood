import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { AdminGate } from "@/components/admin/admin-gate";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSkeleton } from "@/components/admin/admin-skeleton";
import { CreateMajlisForm, EditMajlisRow } from "@/components/admin/majlis-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Locale } from "@/i18n/routing";
import { listAllMajalis } from "@/server/majalis";

type Params = { params: Promise<{ locale: string }> };

async function Majalis() {
  const t = await getTranslations("Admin");
  const majalis = await listAllMajalis();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg leading-loose">{t("addMajlis")}</CardTitle>
          <CardDescription>{t("majalisHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateMajlisForm />
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="text-lg leading-loose font-semibold">{t("majalisList")}</h2>
        {majalis.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noMajalis")}</p>
        ) : (
          majalis.map((m) => <EditMajlisRow key={m.id} m={m} />)
        )}
      </section>
    </div>
  );
}

export default function AdminMajalisPage({ params }: Params) {
  const { locale } = use(params);
  setRequestLocale(locale as Locale);
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <AdminGate>
        <AdminNav current="/admin/majalis" />
        <Majalis />
      </AdminGate>
    </Suspense>
  );
}

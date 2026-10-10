"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isRtl, type Locale } from "@/i18n/routing";
import { DUROOD_IBRAHIMI, SHORT_DUROOD } from "@/lib/durood";
import { SalawatText } from "./salawat-text";

function Arabic({ children }: { children: string }) {
  return (
    <p lang="ar" dir="rtl" className="arabic-text text-center text-[1.65rem] text-brand sm:text-3xl">
      {children}
    </p>
  );
}

function Translation({ children }: { children: string }) {
  return (
    <p className="text-center text-sm text-muted-foreground">
      <SalawatText>{children}</SalawatText>
    </p>
  );
}

/** Durood texts to read while reciting, with a toggle between the two. */
export function DuroodCard() {
  const t = useTranslations("Durood");
  const locale = useLocale() as Locale;

  return (
    <Card className="gap-0 border-gold/30 bg-card/85 py-5">
      <CardContent className="px-4 sm:px-6">
        <Tabs defaultValue="short" dir={isRtl(locale) ? "rtl" : "ltr"} className="gap-4">
          <TabsList className="mx-auto grid h-11 w-full max-w-xs grid-cols-2 rounded-full">
            <TabsTrigger value="short" className="rounded-full">
              {t("short")}
            </TabsTrigger>
            <TabsTrigger value="ibrahimi" className="rounded-full">
              {t("ibrahimi")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="short" className="space-y-3">
            <Arabic>{SHORT_DUROOD}</Arabic>
            <Translation>{t("shortTranslation")}</Translation>
          </TabsContent>

          <TabsContent value="ibrahimi" className="space-y-3">
            <Arabic>{DUROOD_IBRAHIMI[0]}</Arabic>
            <Translation>{t("ibrahimiTranslation1")}</Translation>
            <Separator className="mx-auto max-w-24 bg-gold/30" />
            <Arabic>{DUROOD_IBRAHIMI[1]}</Arabic>
            <Translation>{t("ibrahimiTranslation2")}</Translation>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

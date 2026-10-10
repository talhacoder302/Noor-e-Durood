"use client";

import { HandIcon, KeyboardIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TasbeehPanel } from "@/components/tasbeeh/tasbeeh-panel";
import { startTasbeehSync } from "@/components/tasbeeh/tasbeeh-store";
import { isRtl, type Locale } from "@/i18n/routing";
import { useLocalPref } from "@/lib/use-local-pref";
import dynamic from "next/dynamic";

// The number form is only downloaded once its tab is opened.
const NumberEntry = dynamic(() => import("./number-entry").then((m) => m.NumberEntry));

type Mode = "tap" | "number";

// Phones start on tasbeeh; a desktop with a mouse starts on typing a number.
// After that, whichever tab the visitor chose last is remembered.
const desktopDefault = (): Mode =>
  window.matchMedia("(min-width: 768px) and (pointer: fine)").matches ? "number" : "tap";

export function AddDurood() {
  const t = useTranslations("Add");
  const locale = useLocale() as Locale;
  const [mode, setMode] = useLocalPref<Mode>("noor.addMode", "tap", desktopDefault);

  // Lives here, not in the tasbeeh tab, so unsent taps keep syncing (and the
  // unload beacon stays armed) while the number tab is open.
  useEffect(() => startTasbeehSync(), []);

  return (
    <Tabs
      value={mode}
      onValueChange={(v) => setMode(v as Mode)}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className="gap-3"
    >
      <TabsList aria-label={t("label")} className="mx-auto grid h-12 w-full max-w-sm grid-cols-2 rounded-full">
        <TabsTrigger value="tap" className="gap-1.5 rounded-full text-base">
          <HandIcon className="size-4" />
          {t("tap")}
        </TabsTrigger>
        <TabsTrigger value="number" className="gap-1.5 rounded-full text-base">
          <KeyboardIcon className="size-4" />
          {t("number")}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tap">
        <TasbeehPanel />
      </TabsContent>
      <TabsContent value="number">
        <NumberEntry />
      </TabsContent>
    </Tabs>
  );
}

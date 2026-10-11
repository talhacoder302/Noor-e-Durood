"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { toast } from "sonner";
import { saveSettingsAction, type ActionState } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export type SettingsValues = {
  maxPerEntry: number;
  maxPerDevicePerDay: number;
  announcement: string;
  fridayMessageUr: string;
  fridayMessageEn: string;
  paused: boolean;
  leaderboardShowNames: boolean;
};

const textareaClass =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Switch with an "On" / "Off" word beside it, so its state is obvious. */
function OnOffSwitch({ name, defaultChecked }: { name: string; defaultChecked: boolean }) {
  const t = useTranslations("Admin");
  return (
    <span className="flex shrink-0 items-center gap-2">
      <Switch name={name} defaultChecked={defaultChecked} />
      <span className="w-6 text-xs text-muted-foreground peer-data-[state=checked]:hidden">{t("switchOff")}</span>
      <span className="hidden w-6 text-xs font-medium text-brand peer-data-[state=checked]:inline">{t("switchOn")}</span>
    </span>
  );
}

export function SettingsForm({ values }: { values: SettingsValues }) {
  const t = useTranslations("Admin");
  const [, action, pending] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await saveSettingsAction(prev, form);
    if (result.status === "ok") toast.success(t("saved"));
    else toast.error(t("invalidField", { field: result.detail ?? "" }));
    return result;
  }, { status: "idle" } as ActionState);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{t("maxPerEntry")}</span>
          <Input name="maxPerEntry" type="number" min={1} required defaultValue={values.maxPerEntry} dir="ltr" />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="font-medium">{t("maxPerDevicePerDay")}</span>
          <Input
            name="maxPerDevicePerDay"
            type="number"
            min={1}
            required
            defaultValue={values.maxPerDevicePerDay}
            dir="ltr"
          />
        </label>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
        <span>
          <span className="block font-medium">{t("paused")}</span>
          <span className="text-xs text-muted-foreground">{t("pausedHint")}</span>
        </span>
        <OnOffSwitch name="paused" defaultChecked={values.paused} />
      </label>

      <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
        <span>
          <span className="block font-medium">{t("leaderboardShowNames")}</span>
          <span className="text-xs text-muted-foreground">{t("leaderboardShowNamesHint")}</span>
        </span>
        <OnOffSwitch name="leaderboardShowNames" defaultChecked={values.leaderboardShowNames} />
      </label>

      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">{t("announcement")}</span>
        <textarea name="announcement" rows={2} maxLength={500} defaultValue={values.announcement} className={textareaClass} />
        <span className="text-xs text-muted-foreground">{t("announcementHint")}</span>
      </label>

      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">{t("fridayUr")}</span>
        <textarea
          name="fridayMessageUr"
          rows={3}
          maxLength={800}
          dir="rtl"
          lang="ur"
          defaultValue={values.fridayMessageUr}
          className={`${textareaClass} font-urdu leading-loose`}
        />
      </label>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">{t("fridayEn")}</span>
        <textarea
          name="fridayMessageEn"
          rows={3}
          maxLength={800}
          dir="ltr"
          lang="en"
          defaultValue={values.fridayMessageEn}
          className={`${textareaClass} font-sans`}
        />
        <span className="text-xs text-muted-foreground">{t("fridayHint")}</span>
      </label>

      <Button type="submit" disabled={pending} className="h-11 w-full sm:w-auto">
        {pending && <Loader2Icon className="size-4 animate-spin" />}
        {t("save")}
      </Button>
    </form>
  );
}

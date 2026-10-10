"use client";

import { Loader2Icon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useRef } from "react";
import { toast } from "sonner";
import { createMajlisAction, updateMajlisAction, type ActionState } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { AdminMajlis } from "@/server/majalis";

const IDLE: ActionState = { status: "idle" };

function useToastAction(
  action: (prev: ActionState, form: FormData) => Promise<ActionState>,
  success: string,
  onOk?: () => void,
) {
  const t = useTranslations("Admin");
  return useActionState(async (prev: ActionState, form: FormData) => {
    const result = await action(prev, form);
    if (result.status === "ok") {
      toast.success(success);
      onOk?.();
    } else {
      toast.error(t("invalidField", { field: result.detail ?? "" }));
    }
    return result;
  }, IDLE);
}

function Fields({ m }: { m?: AdminMajlis }) {
  const t = useTranslations("Admin");
  return (
    <>
      <label className="space-y-1 text-xs sm:col-span-2">
        <span>{t("majlisName")}</span>
        <Input name="name" required minLength={2} maxLength={80} defaultValue={m?.name} className="h-9" />
      </label>
      <label className="space-y-1 text-xs">
        <span>{t("majlisNameEn")}</span>
        <Input name="nameEn" maxLength={80} defaultValue={m?.nameEn} dir="ltr" className="h-9" />
      </label>
      <label className="space-y-1 text-xs">
        <span>{t("majlisCity")}</span>
        <Input name="city" maxLength={60} defaultValue={m?.city} className="h-9" />
      </label>
      <label className="space-y-1 text-xs">
        <span>{t("majlisOrder")}</span>
        <Input name="order" type="number" min={0} max={9999} defaultValue={m?.order ?? 0} dir="ltr" className="h-9" />
      </label>
    </>
  );
}

export function CreateMajlisForm() {
  const t = useTranslations("Admin");
  const form = useRef<HTMLFormElement>(null);
  const [, action, pending] = useToastAction(createMajlisAction, t("majlisAdded"), () => form.current?.reset());

  return (
    <form ref={form} action={action} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
      <Fields />
      <div className="col-span-2 flex items-end sm:col-span-1">
        <Button type="submit" size="sm" disabled={pending} className="h-9 w-full gap-1.5">
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
          {t("addMajlis")}
        </Button>
      </div>
    </form>
  );
}

export function EditMajlisRow({ m }: { m: AdminMajlis }) {
  const t = useTranslations("Admin");
  const [, action, pending] = useToastAction(updateMajlisAction, t("saved"));

  return (
    <form action={action} className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 sm:grid-cols-6">
      <input type="hidden" name="id" value={m.id} />
      <Fields m={m} />
      <div className="col-span-2 flex items-end justify-between gap-2 sm:col-span-1">
        <label className="flex h-9 items-center gap-1.5 text-xs">
          <Switch name="active" defaultChecked={m.active} />
          {t("majlisActive")}
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={pending} className="h-9">
          {pending && <Loader2Icon className="size-4 animate-spin" />}
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

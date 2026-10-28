"use client";

import { BanIcon, KeyRoundIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import {
  disableUserAction,
  removeEntryAction,
  resetPinAction,
  type ActionState,
} from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const IDLE: ActionState = { status: "idle" };

const ERROR_KEYS: Record<string, string> = {
  already_removed: "alreadyRemoved",
  invalid_pin: "invalidPin",
};

/** A small dialog with one text field (a reason or a new PIN) and a confirm button. */
function FieldDialog({
  trigger,
  title,
  description,
  confirm,
  hidden,
  action,
  successMessage,
  field = { name: "reason", minLength: 3, maxLength: 200 },
  destructive = true,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirm: string;
  hidden: Record<string, string>;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  successMessage: string;
  field?: { name: string; minLength: number; maxLength: number; numeric?: boolean; placeholder?: string };
  destructive?: boolean;
}) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [, formAction, pending] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await action(prev, form);
    if (result.status === "ok") {
      toast.success(successMessage);
      setOpen(false);
    } else if (result.status === "error") {
      toast.error(t(ERROR_KEYS[result.code ?? ""] ?? "invalidInput"));
    }
    return result;
  }, IDLE);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="leading-loose">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          {Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <Input
            name={field.name}
            required
            minLength={field.minLength}
            maxLength={field.maxLength}
            inputMode={field.numeric ? "numeric" : undefined}
            dir={field.numeric ? "ltr" : undefined}
            className={field.numeric ? "num text-center text-xl tracking-[0.5em]" : undefined}
            placeholder={field.placeholder ?? t("reasonPlaceholder")}
          />
          <DialogFooter>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
              {pending && <Loader2Icon className="size-4 animate-spin" />}
              {confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveEntryButton({ id, count }: { id: string; count: string }) {
  const t = useTranslations("Admin");
  return (
    <FieldDialog
      trigger={
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Trash2Icon className="size-4" />
          {t("remove")}
        </Button>
      }
      title={t("removeTitle")}
      description={t("removeBody", { count })}
      confirm={t("removeConfirm")}
      hidden={{ id }}
      action={removeEntryAction}
      successMessage={t("removed")}
    />
  );
}

export function DisableUserButton({ userId, label }: { userId: string; label: string }) {
  const t = useTranslations("Admin");
  return (
    <FieldDialog
      trigger={
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <BanIcon className="size-4" />
          {t("disableUser")}
        </Button>
      }
      title={t("disableTitle")}
      description={t("disableBody", { user: label })}
      confirm={t("disableConfirm")}
      hidden={{ userId }}
      action={disableUserAction}
      successMessage={t("userDisabled")}
    />
  );
}

export function ResetPinButton({ userId, label }: { userId: string; label: string }) {
  const t = useTranslations("Admin");
  return (
    <FieldDialog
      trigger={
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <KeyRoundIcon className="size-4" />
          {t("resetPin")}
        </Button>
      }
      title={t("resetPinTitle")}
      description={t("resetPinBody", { user: label })}
      confirm={t("resetPinConfirm")}
      hidden={{ userId }}
      action={resetPinAction}
      successMessage={t("pinReset")}
      field={{ name: "pin", minLength: 4, maxLength: 4, numeric: true, placeholder: "XXXX" }}
      destructive={false}
    />
  );
}

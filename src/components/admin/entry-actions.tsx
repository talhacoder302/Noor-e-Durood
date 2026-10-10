"use client";

import { BanIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { blockDeviceAction, removeEntryAction, type ActionState } from "@/app/[locale]/admin/actions";
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

function ReasonDialog({
  trigger,
  title,
  description,
  confirm,
  hidden,
  action,
  successMessage,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirm: string;
  hidden: Record<string, string>;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  successMessage: string;
}) {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [, formAction, pending] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await action(prev, form);
    if (result.status === "ok") {
      toast.success(successMessage);
      setOpen(false);
    } else if (result.status === "error") {
      toast.error(t(result.code === "already_removed" ? "alreadyRemoved" : "invalidInput"));
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
          <Input name="reason" required minLength={3} maxLength={200} placeholder={t("reasonPlaceholder")} />
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending && <Loader2Icon className="size-4 animate-spin" />}
              {confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EntryActions({ id, deviceId, count }: { id: string; deviceId: string; count: string }) {
  const t = useTranslations("Admin");
  return (
    <div className="flex flex-wrap gap-2">
      <ReasonDialog
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
      <BlockButton deviceId={deviceId} />
    </div>
  );
}

export function BlockButton({ deviceId }: { deviceId: string }) {
  const t = useTranslations("Admin");
  return (
    <ReasonDialog
      trigger={
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <BanIcon className="size-4" />
          {t("block")}
        </Button>
      }
      title={t("blockTitle")}
      description={t("blockBody", { device: deviceId.slice(0, 8) })}
      confirm={t("blockConfirm")}
      hidden={{ deviceId }}
      action={blockDeviceAction}
      successMessage={t("blocked")}
    />
  );
}

"use client";

import { Loader2Icon, RefreshCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { recalculateAction } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Rebuilds all counters from entries, after a confirmation. */
export function RecalcButton() {
  const t = useTranslations("Admin");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      try {
        const r = await recalculateAction();
        toast.success(t("recalcDone", { corrected: r.corrected, counters: r.counters }));
        setOpen(false);
      } catch {
        toast.error(t("recalcFailed"));
      }
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <RefreshCcwIcon className="size-4" />
          {t("recalc")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="leading-loose">{t("recalcTitle")}</DialogTitle>
          <DialogDescription>{t("recalcBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" onClick={run} disabled={pending}>
            {pending && <Loader2Icon className="size-4 animate-spin" />}
            {t("recalcConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

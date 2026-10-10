"use client";

import { Loader2Icon, LockKeyholeIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { loginAction, type ActionState } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const t = useTranslations("Admin");
  const [state, action, pending] = useActionState<ActionState, FormData>(loginAction, { status: "idle" });

  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg leading-loose">
          <LockKeyholeIcon className="size-5 text-gold" />
          {t("loginTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <label htmlFor="admin-password" className="sr-only">
            {t("password")}
          </label>
          <Input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={t("password")}
            required
            dir="ltr"
            className="h-11"
          />
          {state.status === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {t(state.code === "rate_limited" ? "loginRateLimited" : "loginWrong")}
            </p>
          )}
          <Button type="submit" disabled={pending} className="h-11 w-full">
            {pending && <Loader2Icon className="size-4 animate-spin" />}
            {t("login")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

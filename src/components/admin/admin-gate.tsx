import { ShieldAlertIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getAdminAccess } from "@/server/admin-auth";
import { LoginForm } from "./login-form";

/**
 * Renders children only for an admin: a logged-in admin account plus the admin
 * password. Otherwise it shows the step that's missing.
 */
export async function AdminGate({ children }: { children: ReactNode }) {
  const access = await getAdminAccess();
  const t = await getTranslations("Admin");

  if (access.ok) {
    return (
      <>
        {access.setup && (
          <p className="mx-auto mb-4 max-w-3xl rounded-xl border border-gold/50 bg-gold/10 p-3 text-sm leading-loose">
            {t("setupNotice")}{" "}
            <Link href="/admin/users" className="font-medium text-brand underline underline-offset-4">
              {t("navUsers")}
            </Link>
          </p>
        )}
        {children}
      </>
    );
  }

  if (access.need === "password") return <LoginForm />;

  // Admin accounts exist, and this browser isn't logged in with one.
  const locale = await getLocale();
  const next = locale === "en" ? "/en/admin" : "/admin";
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg leading-loose">
          <ShieldAlertIcon className="size-5 text-gold" />
          {t("accountTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{access.user ? t("notAdminAccount") : t("loginWithAdminAccount")}</p>
        {!access.user && (
          <Button asChild className="h-11 w-full">
            <Link href={{ pathname: "/login", query: { next } }}>{t("loginWithAccount")}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

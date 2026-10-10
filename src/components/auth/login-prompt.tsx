"use client";

import { LogInIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/** Login/sign-up links that come back to this page afterwards. */
export function useLoginHrefs() {
  // The page is static, so the current URL is read in the browser only.
  const here = useSyncExternalStore(
    noopSubscribe,
    () => window.location.pathname + window.location.search,
    () => "/",
  );
  const prefix = here.startsWith("/en") ? "/en" : "";
  const next = encodeURIComponent(here);
  return {
    login: `${prefix}/login?next=${next}`,
    signup: `${prefix}/login?mode=signup&next=${next}`,
  };
}

export function LoginPrompt({ message, compact = false }: { message: string; compact?: boolean }) {
  const t = useTranslations("Auth");
  const hrefs = useLoginHrefs();

  return (
    <div className={cn("flex flex-col items-center gap-3 text-center", !compact && "rounded-xl bg-muted/60 px-4 py-5")}>
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild className="h-11 gap-1.5 rounded-full px-5">
          <Link href={hrefs.login}>
            <LogInIcon className="size-4" />
            {t("loginButton")}
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11 gap-1.5 rounded-full px-5">
          <Link href={hrefs.signup}>
            <UserPlusIcon className="size-4" />
            {t("signupButton")}
          </Link>
        </Button>
      </div>
    </div>
  );
}

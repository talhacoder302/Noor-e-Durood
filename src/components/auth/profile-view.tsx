"use client";

import { PartyPopperIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountPanel } from "./account-panel";
import { LoginPrompt } from "./login-prompt";
import { ProfileForm } from "./profile-form";
import { safeNext, useSession } from "./session-store";

/** The /profile page body: needs a logged-in user. */
export function ProfileView() {
  const t = useTranslations("Profile");
  const tAuth = useTranslations("Auth");
  const session = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const welcome = params.get("welcome") === "1";
  const next = safeNext(params.get("next"));

  if (session.status === "loading") return <Skeleton className="h-64 w-full rounded-xl" />;
  if (session.status !== "user") return <LoginPrompt message={tAuth("loginToProfile")} />;

  return (
    <div className="space-y-5">
      {welcome && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-gold/40 bg-accent/50 px-4 py-4 text-center">
          <PartyPopperIcon className="size-6 text-gold" aria-hidden />
          <p className="text-sm">{t("welcome")}</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => router.replace(next)}>
            {t("later")}
          </Button>
        </div>
      )}
      {/* After a fresh sign-up, saving goes back to where the user was. */}
      <ProfileForm user={session.user} onSaved={welcome ? () => router.replace(next) : undefined} />
      <AccountPanel user={session.user} />
    </div>
  );
}

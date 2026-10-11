"use client";

import { LogInIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useSession } from "./session-store";

const pill =
  "inline-flex h-10 items-center gap-1.5 rounded-full px-2.5 text-sm hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * Header account button. Guests get "Log in"; a logged-in user goes to their
 * count (میرا حساب), which links on to profile settings.
 */
export function UserButton() {
  const t = useTranslations("Header");
  const session = useSession();

  if (session.status === "loading") {
    // Same size as the real button so the header doesn't jump.
    return <span className="inline-block h-10 w-10" aria-hidden />;
  }

  if (session.status !== "user") {
    return (
      <Link href="/login" className={cn(pill, "text-brand")} title={t("login")}>
        <LogInIcon className="size-5" />
        <span className="max-w-24 truncate">{t("login")}</span>
      </Link>
    );
  }

  const label = session.user.name || session.user.phoneMasked;
  return (
    <>
      {session.user.isAdmin && (
        <Link href="/admin" className={cn(pill, "text-gold")} aria-label={t("admin")} title={t("admin")}>
          <ShieldCheckIcon className="size-5" />
          <span className="hidden sm:inline">{t("admin")}</span>
        </Link>
      )}
      <Link href="/mera-hisaab" className={pill} aria-label={t("myCount")} title={label}>
        <UserRoundIcon className="size-5 text-brand" />
        <span className="hidden max-w-28 truncate sm:inline">{label}</span>
      </Link>
    </>
  );
}

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { logoutAction } from "@/app/[locale]/admin/actions";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", key: "navDashboard" },
  { href: "/admin/entries", key: "navEntries" },
  { href: "/admin/users", key: "navUsers" },
  { href: "/admin/majalis", key: "navMajalis" },
  { href: "/admin/settings", key: "navSettings" },
] as const;

export function AdminNav({ current }: { current: (typeof ITEMS)[number]["href"] }) {
  const t = useTranslations("Admin");
  return (
    <nav className="flex flex-wrap items-center gap-1 rounded-full border bg-card p-1">
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={current === item.href ? "page" : undefined}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm",
            current === item.href ? "bg-primary text-primary-foreground" : "hover:bg-accent",
          )}
        >
          {t(item.key)}
        </Link>
      ))}
      <form action={logoutAction} className="ms-auto">
        <Button type="submit" variant="ghost" size="sm" className="gap-1.5 rounded-full" aria-label={t("logout")}>
          <LogOutIcon className="size-4" />
          <span className="hidden sm:inline">{t("logout")}</span>
        </Button>
      </form>
    </nav>
  );
}

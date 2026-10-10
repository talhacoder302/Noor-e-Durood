import { useTranslations } from "next-intl";
import { UserButton } from "@/components/auth/user-button";
import { Link } from "@/i18n/navigation";
import { LanguageSwitch } from "./language-switch";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const t = useTranslations("Header");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
        <Link
          href="/"
          aria-label={t("home")}
          className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <LogoMark />
          <span className="flex min-w-0 flex-col leading-tight">
            <span lang="ur" className="font-urdu text-lg leading-loose text-brand">
              نورِ درود
            </span>
            {/* Hidden on narrow phones, where the header also holds the login button. */}
            <span
              lang="en"
              className="hidden font-sans text-[11px] font-medium tracking-wide whitespace-nowrap text-muted-foreground min-[400px]:block"
            >
              Noor-e-Durood
            </span>
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-0.5">
          <UserButton />
          <LanguageSwitch />
          <ThemeToggle label={t("toggleTheme")} />
        </nav>
      </div>
    </header>
  );
}

/** Small eight-point star in gold on green, echoing the background pattern. */
function LogoMark() {
  return (
    <span
      aria-hidden
      className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-gold shadow-sm"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M12 2.5 14.6 6l4.3-.9-.9 4.3L21.5 12 18 14.6l.9 4.3-4.3-.9L12 21.5 9.4 18l-4.3.9.9-4.3L2.5 12 6 9.4l-.9-4.3 4.3.9Z" />
      </svg>
    </span>
  );
}

import { ArrowLeftIcon, ArrowRightIcon, CalendarIcon, CakeIcon, MapPinIcon, UsersRoundIcon } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { WeekChart } from "@/components/me/week-chart";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { countInWords, formatCount, type NumberLocale } from "@/lib/format";
import type { PublicProfile } from "@/lib/types";
import { getCachedPublicProfile } from "@/server/leaderboard";
import { Avatar, RankBadge } from "./bits";

function monthName(month: string, locale: NumberLocale) {
  return new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function Stat({ label, value, locale }: { label: string; value: number; locale: NumberLocale }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col items-center gap-1 px-3 py-4 text-center">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="num text-2xl font-semibold text-brand">{formatCount(value, locale)}</p>
      </CardContent>
    </Card>
  );
}

function Detail({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-gold">{icon}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="ms-auto text-end font-medium">{children}</span>
    </div>
  );
}

/** One person's public page: profile fields, rank and counts. Never the phone number. */
export async function PublicProfileView({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: rawLocale, id } = await params;
  const locale = rawLocale as Locale;
  setRequestLocale(locale);
  // Request time only, so the build never reads the database.
  await connection();
  const t = await getTranslations("Leaderboard");

  let profile: PublicProfile | null = null;
  let failed = false;
  try {
    profile = await getCachedPublicProfile(id);
  } catch (error) {
    unstable_rethrow(error);
    console.error("Could not load a public profile:", error);
    failed = true;
  }

  const Back = locale === "ur" ? ArrowRightIcon : ArrowLeftIcon;
  const back = (
    <Link
      href="/leaderboard"
      className="inline-flex h-10 items-center gap-1.5 self-start rounded-full px-3 text-sm text-brand hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <Back className="size-4" />
      {t("back")}
    </Link>
  );

  if (!profile) {
    return (
      <>
        {back}
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {failed ? t("error") : t("notFound")}
          </CardContent>
        </Card>
      </>
    );
  }

  const p = profile;
  const details = [
    p.majlis && { icon: <UsersRoundIcon className="size-5" />, label: t("majlis"), value: p.majlis },
    p.city && { icon: <MapPinIcon className="size-5" />, label: t("city"), value: p.city },
    p.age && {
      icon: <CakeIcon className="size-5" />,
      label: t("age"),
      value: t("ageYears", { n: formatCount(p.age, locale) }),
    },
    { icon: <CalendarIcon className="size-5" />, label: t("joined"), value: monthName(p.joined, locale) },
  ].filter((d) => !!d);

  return (
    <>
      {back}

      <section className="flex flex-col items-center gap-2 text-center">
        <Avatar name={p.name} className="size-20 text-3xl" />
        <h1 className="text-2xl leading-loose font-semibold text-brand">{p.name || t("member")}</h1>
        {p.rank && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {t("rankLabel")}
            <RankBadge rank={p.rank} locale={locale} />
          </p>
        )}
      </section>

      <Card className="gap-1 py-4">
        <CardContent className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm text-muted-foreground">{t("total")}</p>
          <p className="num text-4xl font-bold text-brand">{formatCount(p.total, locale)}</p>
          {p.total >= 1000 && <p className="text-sm text-muted-foreground">{countInWords(p.total, locale)}</p>}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Stat label={t("today")} value={p.today} locale={locale} />
        <Stat label={t("month")} value={p.month} locale={locale} />
      </div>

      <Card className="py-4">
        <CardContent>
          <WeekChart days={p.last7} />
        </CardContent>
      </Card>

      <Card className="py-2">
        <CardContent className="divide-y">
          {details.map((d) => (
            <Detail key={d.label} icon={d.icon} label={d.label}>
              {d.value}
            </Detail>
          ))}
        </CardContent>
      </Card>

      <Link
        href="/"
        className="self-center text-sm font-medium text-brand underline-offset-4 hover:underline"
      >
        {t("cta")}
      </Link>
    </>
  );
}

export function PublicProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4" aria-hidden>
      <Skeleton className="size-20 rounded-full" />
      <Skeleton className="h-8 w-40 rounded-md" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid w-full grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-52 w-full rounded-xl" />
    </div>
  );
}

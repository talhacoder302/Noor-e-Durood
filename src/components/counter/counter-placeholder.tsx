import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Stand-in for the live counter (Module 1). Same layout so nothing jumps
// when the real numbers arrive.
export function CounterPlaceholder() {
  const t = useTranslations("Counter");

  return (
    <section aria-label={t("total")} className="space-y-3">
      <Card className="gap-0 overflow-hidden border-primary/20 bg-primary py-0 text-primary-foreground shadow-md">
        <CardContent className="flex flex-col items-center gap-3 px-5 py-7 text-center">
          <p className="text-sm opacity-85">{t("total")}</p>
          <Skeleton className="h-12 w-56 max-w-full rounded-lg bg-primary-foreground/15 sm:h-14 sm:w-72" />
          <Skeleton className="h-4 w-32 rounded bg-primary-foreground/10" />
          <p className="text-xs opacity-75">{t("comingSoon")}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {(["today", "month"] as const).map((key) => (
          <Card key={key} className="gap-0 py-0">
            <CardContent className="flex flex-col items-center gap-2 px-3 py-4 text-center">
              <p className="text-xs text-muted-foreground">{t(key)}</p>
              <Skeleton className="h-7 w-24 rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

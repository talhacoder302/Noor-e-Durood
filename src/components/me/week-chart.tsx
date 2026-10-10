"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { formatCount, type NumberLocale } from "@/lib/format";
import { cn } from "@/lib/utils";

type Day = { day: string; count: number };

const PLOT_HEIGHT = 128; // px

function weekdayName(day: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : "en-GB", {
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/**
 * Seven bars, one per day, oldest first (in Urdu that reads right to left).
 * One series: one colour, no legend. The selected day (today by default)
 * shows its value; tap or hover another bar to see that day.
 */
export function WeekChart({ days }: { days: Day[] }) {
  const t = useTranslations("Me");
  const locale = useLocale() as NumberLocale;
  const [selected, setSelected] = useState(days.length - 1);
  const max = Math.max(1, ...days.map((d) => d.count));
  const current = days[selected];

  return (
    <figure className="space-y-3">
      <figcaption className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{t("last7")}</span>
        <span className="text-muted-foreground">
          {selected === days.length - 1 ? t("today") : weekdayName(current.day, locale)}:{" "}
          <span className="num font-semibold text-foreground">{formatCount(current.count, locale)}</span>
        </span>
      </figcaption>

      <div
        className="grid grid-cols-7 items-end gap-1.5 border-b border-border"
        style={{ height: PLOT_HEIGHT }}
        aria-hidden
      >
        {days.map((d, i) => {
          // A non-zero day always shows at least a sliver.
          const h = d.count === 0 ? 0 : Math.max(4, Math.round((d.count / max) * PLOT_HEIGHT));
          return (
            <button
              key={d.day}
              type="button"
              tabIndex={-1}
              onClick={() => setSelected(i)}
              onMouseEnter={() => setSelected(i)}
              className="flex h-full items-end justify-center"
            >
              <span
                className={cn(
                  "block w-[60%] max-w-7 rounded-t-[4px] bg-chart-bar transition-opacity",
                  i !== selected && "opacity-60",
                )}
                style={{ height: h }}
              />
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-muted-foreground" aria-hidden>
        {days.map((d, i) => (
          <span key={d.day} className={cn("truncate", i === selected && "font-semibold text-foreground")}>
            {i === days.length - 1 ? t("today") : weekdayName(d.day, locale)}
          </span>
        ))}
      </div>

      {/* The same numbers as a table, for screen readers. */}
      <table className="sr-only">
        <caption>{t("last7")}</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{weekdayName(d.day, locale)}</th>
              <td>{formatCount(d.count, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

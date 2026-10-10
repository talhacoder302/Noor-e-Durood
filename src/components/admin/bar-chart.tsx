"use client";

import { useLocale } from "next-intl";
import { useState } from "react";
import { formatCount, type NumberLocale } from "@/lib/format";
import { cn } from "@/lib/utils";

type Bar = { key: string; label: string; value: number };

const PLOT_HEIGHT = 140;

/**
 * One series of bars (single colour, no legend). Tap or hover a bar to read
 * its value; only every `labelEvery`-th label is printed so 24–30 bars fit a
 * phone. A screen-reader table carries every value.
 */
export function BarChart({
  title,
  bars,
  defaultIndex = bars.length - 1,
  labelEvery = 1,
}: {
  title: string;
  bars: Bar[];
  defaultIndex?: number;
  labelEvery?: number;
}) {
  const locale = useLocale() as NumberLocale;
  const [selected, setSelected] = useState(defaultIndex);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const current = bars[selected];

  return (
    <figure className="space-y-2">
      <figcaption className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground">
          {current.label}: <span className="num font-semibold text-foreground">{formatCount(current.value, locale)}</span>
        </span>
      </figcaption>

      <div
        dir="ltr"
        className="flex items-end gap-0.5 border-b border-border"
        style={{ height: PLOT_HEIGHT }}
        aria-hidden
      >
        {bars.map((b, i) => (
          <button
            key={b.key}
            type="button"
            tabIndex={-1}
            onClick={() => setSelected(i)}
            onMouseEnter={() => setSelected(i)}
            className="flex h-full min-w-0 flex-1 items-end justify-center"
          >
            <span
              className={cn("block w-[70%] rounded-t-[3px] bg-chart-bar", i !== selected && "opacity-60")}
              style={{ height: b.value === 0 ? 0 : Math.max(3, Math.round((b.value / max) * PLOT_HEIGHT)) }}
            />
          </button>
        ))}
      </div>

      <div dir="ltr" className="flex gap-0.5 text-[10px] text-muted-foreground" aria-hidden>
        {bars.map((b, i) => (
          <span key={b.key} className="num min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
            {i % labelEvery === 0 ? b.label : ""}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {bars.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td>{formatCount(b.value, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

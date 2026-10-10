"use client";

import { animate } from "framer-motion/dom";
import { useEffect, useRef, useState } from "react";
import { formatCount, type NumberLocale } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Counts up from the previously shown value to `value`. The server-rendered
 * text is the real number, so it is readable before any JavaScript runs.
 */
export function AnimatedNumber({
  value,
  locale,
  className,
}: {
  value: number;
  locale: NumberLocale;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  // React renders the text once; after that the animation owns it.
  const [initialText] = useState(() => formatCount(value, locale));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const from = shown.current;
    const render = (n: number) => {
      shown.current = n;
      el.textContent = formatCount(Math.round(n), locale);
    };

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (from === value || reduceMotion) {
      render(value);
      return;
    }

    const diff = Math.abs(value - from);
    const controls = animate(from, value, {
      duration: Math.min(1.6, 0.6 + Math.log10(diff + 1) * 0.2),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: render,
    });
    return () => controls.stop();
  }, [value, locale]);

  return (
    <span ref={ref} className={cn("num", className)}>
      {initialText}
    </span>
  );
}

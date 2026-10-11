"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { PIN_LENGTH } from "@/lib/pin";
import { cn } from "@/lib/utils";

/** 4-digit PIN field with an eye button to show or hide what was typed. */
export function PinInput({
  value,
  onChange,
  name,
  autoComplete,
  size = "lg",
}: {
  value: string;
  onChange: (value: string) => void;
  name?: string;
  autoComplete: string;
  size?: "lg" | "md";
}) {
  const t = useTranslations("Auth");
  const [visible, setVisible] = useState(false);

  return (
    // The field is left-to-right (digits), so the button sits on its right.
    <div className="relative" dir="ltr">
      <Input
        name={name}
        type={visible ? "text" : "password"}
        inputMode="numeric"
        autoComplete={autoComplete}
        maxLength={PIN_LENGTH}
        placeholder="••••"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, PIN_LENGTH))}
        className={cn(
          "num px-12 text-center tracking-[0.5em]",
          size === "lg" ? "h-12 text-2xl" : "h-11 text-xl",
        )}
        required
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePin") : t("showPin")}
        aria-pressed={visible}
        title={visible ? t("hidePin") : t("showPin")}
        className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {visible ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
      </button>
    </div>
  );
}

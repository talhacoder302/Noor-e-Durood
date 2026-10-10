"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ label }: { label: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-10 rounded-full"
      aria-label={label}
      title={label}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {/* Icons switch with CSS so server and client markup always match. */}
      <MoonIcon className="size-5 dark:hidden" />
      <SunIcon className="hidden size-5 dark:block" />
    </Button>
  );
}

"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// next-themes renders an inline <script> that applies the saved theme before
// first paint. It only does its job in the server HTML. When the browser builds
// the layout itself (switching language, the not-found page) React 19 can't run
// it anyway and logs "Encountered a script tag". Marking it as data on the
// client skips that; hydration keeps the server's runnable copy
// (next-themes sets suppressHydrationWarning on it).
const scriptProps = typeof window === "undefined" ? undefined : { type: "application/json" };

export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider scriptProps={scriptProps} {...props} />;
}

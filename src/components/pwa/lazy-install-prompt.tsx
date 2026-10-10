"use client";

import dynamic from "next/dynamic";

// Never rendered on the server (it depends on the browser), so it loads on
// its own after the page is interactive.
export const LazyInstallPrompt = dynamic(
  () => import("./install-prompt").then((m) => m.InstallPrompt),
  { ssr: false },
);

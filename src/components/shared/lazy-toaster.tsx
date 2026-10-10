"use client";

import dynamic from "next/dynamic";

// Toasts only ever appear after the user does something, so the toaster can
// load after the page is interactive instead of during the first load.
export const LazyToaster = dynamic(() => import("@/components/ui/sonner").then((m) => m.Toaster), {
  ssr: false,
});

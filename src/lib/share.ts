"use client";

/** The page link people should land on when they open a shared message. */
export function shareLink(locale: string): string {
  const path = locale === "en" ? "/en" : "/";
  return new URL(path, window.location.origin).toString();
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** Opens the phone's share sheet. Resolves false if it isn't available or was cancelled. */
export async function nativeShare(text: string, url: string, title: string): Promise<boolean> {
  if (!canNativeShare()) return false;
  try {
    await navigator.share({ title, text, url });
    return true;
  } catch {
    return false;
  }
}

"use client";

import { useCallback, useSyncExternalStore } from "react";

// Tiny per-device preferences (sound on/off, last tab). Server render always
// gets the fallback; the stored value takes over after hydration.

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useLocalPref<T extends string>(
  key: string,
  serverFallback: T,
  clientFallback: () => T = () => serverFallback,
): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => (read(key) as T | null) ?? clientFallback(),
    () => serverFallback,
  );

  const set = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // Not saved; fine for a preference.
      }
      listeners.forEach((l) => l());
    },
    [key],
  );

  return [value, set];
}

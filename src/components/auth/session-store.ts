"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { PublicUser } from "@/lib/types";

// Who is logged in, shared by the header, forms and the tasbeeh. Pages are
// static, so the browser asks /api/auth/me once per page load.

export type SessionState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "user"; user: PublicUser }
  /** Couldn't check (offline or server error); treat like logged in for retries. */
  | { status: "unknown" };

const LOADING: SessionState = { status: "loading" };
let state: SessionState = LOADING;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSessionState(): SessionState {
  return state;
}

export function loadSession(force = false): Promise<void> {
  if (inflight && !force) return inflight;
  if (!force && state.status !== "loading") return Promise.resolve();
  inflight = fetch("/api/auth/me", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`me ${res.status}`);
      const data = (await res.json()) as { user: PublicUser | null };
      set(data.user ? { status: "user", user: data.user } : { status: "guest" });
    })
    .catch(() => set({ status: "unknown" }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** After login/signup (user) or logout / an expired session (null). */
export function setSessionUser(user: PublicUser | null) {
  set(user ? { status: "user", user } : { status: "guest" });
}

export function useSession(): SessionState {
  const session = useSyncExternalStore(subscribe, () => state, () => LOADING);
  useEffect(() => {
    void loadSession();
  }, []);
  return session;
}

/** Same-site path to return to after logging in; anything else goes home. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

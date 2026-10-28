"use client";

import { useSyncExternalStore } from "react";
import { getSessionState, setSessionUser } from "@/components/auth/session-store";
import { getDeviceId, peekDeviceId, rememberDeviceId } from "@/lib/device-id";
import { beaconDurood, submitDurood } from "@/lib/submit-durood";
import {
  parseQueueState,
  TAP_QUEUE_KEY,
  TapQueue,
  type QueueState,
  type StorageLike,
} from "@/lib/tap-queue";
import { flushQueue } from "@/lib/tap-sync";
import { randomUuid } from "@/lib/uuid";
import {
  addOptimistic,
  applyConfirmed,
  rollbackOptimistic,
} from "@/components/counter/totals-store";

const AUTO_FLUSH_MS = 10 * 60_000;
const MAX_BACKOFF_MS = 60 * 60_000;

export type TasbeehSnapshot = {
  queue: QueueState;
  syncing: boolean;
  online: boolean;
  /** Last failure code, cleared by the next successful send. */
  error: string | null;
  errorMax?: number;
};

const SERVER_SNAPSHOT: TasbeehSnapshot = {
  queue: { session: 0, pending: 0, inflight: null },
  syncing: false,
  online: true,
  error: null,
};

// localStorage can throw (private mode, blocked storage). Fall back to memory
// so tapping still works for this visit.
function browserStorage(): StorageLike {
  try {
    const probe = "noor.probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => void memory.set(k, v),
    };
  }
}

let queue: TapQueue | null = null;
let snapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

let failures = 0;
let nextAutoAt = 0;
let flushing: Promise<void> | null = null;
// Batches whose optimistic add happened on this page.
const optimistic = new Set<string>();

function getQueue(): TapQueue {
  queue ??= new TapQueue(browserStorage(), randomUuid);
  return queue;
}

function update(patch: Partial<TasbeehSnapshot> = {}) {
  snapshot = { ...snapshot, queue: getQueue().read(), ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useTasbeeh(): TasbeehSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
}

export function tap(): QueueState {
  getQueue().tap();
  update();
  return snapshot.queue;
}

export function resetSession() {
  getQueue().resetSession();
  update();
}

async function runFlush(keepalive: boolean) {
  update({ syncing: true });

  const outcome = await flushQueue(
    getQueue(),
    async (batch) => {
      const deviceId = await getDeviceId();
      return submitDurood({ ...batch, deviceId, mode: "tap" }, { keepalive });
    },
    {
      onSend: (batch) => {
        optimistic.add(batch.clientId);
        addOptimistic(batch.count);
      },
      onConfirmed: (batch, result) => {
        optimistic.delete(batch.clientId);
        rememberDeviceId(result.deviceId);
        applyConfirmed(result.totals);
      },
      onFailed: (batch) => {
        if (optimistic.delete(batch.clientId)) rollbackOptimistic(batch.count);
      },
    },
  );

  if (outcome.status === "failed") {
    // The session ended: wait quietly for the user to log in again.
    if (outcome.error === "login_required") setSessionUser(null);
    failures++;
    nextAutoAt = Date.now() + Math.min(MAX_BACKOFF_MS, AUTO_FLUSH_MS * 2 ** (failures - 1));
    update({ syncing: false, error: outcome.error, errorMax: outcome.max });
  } else {
    failures = 0;
    nextAutoAt = 0;
    update({ syncing: false, error: null, errorMax: undefined });
  }
}

/**
 * Sends unsent taps. Automatic triggers respect the failure backoff; a press
 * of "Jama karein" always tries. Only one tab flushes at a time.
 */
export function flush({ manual = false, keepalive = false } = {}): Promise<void> {
  if (flushing) return flushing;
  const s = getQueue().read();
  if (s.pending === 0 && !s.inflight) return Promise.resolve();
  // Guests can count, but only an account can add: keep taps on the phone.
  if (getSessionState().status === "guest") return Promise.resolve();
  if (!manual && (Date.now() < nextAutoAt || !navigator.onLine)) {
    return Promise.resolve();
  }

  const job = () => runFlush(keepalive);
  const locked =
    "locks" in navigator
      ? navigator.locks.request("noor-tasbeeh-flush", { ifAvailable: true }, (lock) =>
          lock ? job() : undefined,
        )
      : job();

  flushing = Promise.resolve(locked)
    .catch(() => update({ syncing: false, error: "network" }))
    .finally(() => {
      flushing = null;
    });
  return flushing;
}

/** Page is going away: hand the batch to the browser to deliver. */
function beacon() {
  if (getSessionState().status === "guest") return;
  const deviceId = peekDeviceId();
  if (!deviceId) return;
  const batch = getQueue().takeBatch();
  if (!batch) return;
  // Kept in flight on purpose; the next visit resends it with the same id.
  beaconDurood({ clientId: batch.clientId, count: batch.count, deviceId, mode: "tap" });
}

let started = 0;
let stop: (() => void) | null = null;

/** Starts timers and listeners once, however many components use them. */
export function startTasbeehSync(): () => void {
  started++;
  if (started === 1) {
    update({ online: navigator.onLine });

    const timer = setInterval(() => void flush(), AUTO_FLUSH_MS);
    const onOnline = () => {
      failures = 0;
      nextAutoAt = 0;
      update({ online: true });
      void flush();
    };
    const onOffline = () => update({ online: false });
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void flush({ keepalive: true });
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === TAP_QUEUE_KEY) {
        snapshot = { ...snapshot, queue: parseQueueState(e.newValue) };
        listeners.forEach((l) => l());
      }
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("pagehide", beacon);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    // Anything left from a previous visit goes out now.
    void flush();

    stop = () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("pagehide", beacon);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }

  return () => {
    started--;
    if (started === 0) {
      stop?.();
      stop = null;
    }
  };
}

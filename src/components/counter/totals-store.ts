"use client";

import { useSyncExternalStore } from "react";
import type { Totals } from "@/lib/types";

// Small shared store so the counter and the entry form stay in sync without
// a provider around the whole page.

// After a local submission, polled numbers may still be the cached ones from
// before it. For this long we never let the counter go backwards.
const GUARD_MS = 20_000;

let totals: Totals | null = null;
let guardUntil = 0;
const listeners = new Set<() => void>();

function set(next: Totals | null) {
  totals = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function maxMerge(current: Totals, incoming: Totals): Totals {
  if (current.dayKey !== incoming.dayKey) return incoming;
  return {
    dayKey: incoming.dayKey,
    total: Math.max(current.total, incoming.total),
    today: Math.max(current.today, incoming.today),
    month: Math.max(current.month, incoming.month),
  };
}

export function useTotals(initial: Totals | null): Totals | null {
  const live = useSyncExternalStore(
    subscribe,
    () => totals,
    () => null,
  );
  return live ?? initial;
}

export function seedTotals(initial: Totals | null) {
  if (!totals && initial) set(initial);
}

/** Numbers from polling /api/stats. */
export function applyPolled(incoming: Totals) {
  const guarded = totals && Date.now() < guardUntil;
  set(guarded ? maxMerge(totals!, incoming) : incoming);
}

/** Fresh numbers returned by our own submission. */
export function applyConfirmed(incoming: Totals) {
  guardUntil = Date.now() + GUARD_MS;
  set(totals ? maxMerge(totals, incoming) : incoming);
}

export function addOptimistic(count: number) {
  guardUntil = Date.now() + GUARD_MS;
  if (!totals) return;
  set({
    ...totals,
    total: totals.total + count,
    today: totals.today + count,
    month: totals.month + count,
  });
}

export function rollbackOptimistic(count: number) {
  guardUntil = 0;
  if (!totals) return;
  set({
    ...totals,
    total: Math.max(0, totals.total - count),
    today: Math.max(0, totals.today - count),
    month: Math.max(0, totals.month - count),
  });
}

"use client";

import { useEffect } from "react";
import { startTasbeehSync } from "./tasbeeh-store";
import { TasbeehPanel } from "./tasbeeh-panel";

/** Tasbeeh on the offline page: taps queue up and sync once back online. */
export function OfflineTasbeeh() {
  useEffect(() => startTasbeehSync(), []);
  return <TasbeehPanel />;
}

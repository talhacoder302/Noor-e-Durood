"use client";

import type { DuroodMode, SubmitResponse } from "./types";

export type ClientSubmitResult =
  | SubmitResponse
  | { ok: false; error: "network"; max?: undefined };

type Payload = {
  deviceId: string;
  clientId: string;
  count: number;
  mode: DuroodMode;
};

const RETRY_DELAYS_MS = [800, 2000];

/**
 * Posts a submission, retrying network and server errors with the SAME
 * clientId, so the server counts it at most once.
 */
export async function submitDurood(
  payload: Payload,
  options: { keepalive?: boolean } = {},
): Promise<ClientSubmitResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch("/api/durood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // Lets the request finish even if the page is being hidden or closed.
        keepalive: options.keepalive,
      });
      // 503 means the site is paused; retrying would not help.
      const retryable = [500, 502, 504].includes(res.status);
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) {
        return (await res.json()) as SubmitResponse;
      }
    } catch {
      if (attempt >= RETRY_DELAYS_MS.length) {
        return { ok: false, error: "network" };
      }
    }
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
  }
}

/**
 * Fire-and-forget send for page unload. The result is never known, so the
 * caller must keep the batch; a later retry with the same clientId is free.
 */
export function beaconDurood(payload: Payload): boolean {
  if (typeof navigator === "undefined" || !navigator.sendBeacon) return false;
  const body = new Blob([JSON.stringify(payload)], { type: "application/json" });
  return navigator.sendBeacon("/api/durood", body);
}

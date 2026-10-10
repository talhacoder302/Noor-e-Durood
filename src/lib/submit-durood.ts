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
export async function submitDurood(payload: Payload): Promise<ClientSubmitResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch("/api/durood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

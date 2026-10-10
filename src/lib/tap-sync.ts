import type { Batch, TapQueue } from "./tap-queue";
import { DEFAULT_MAX_BATCH } from "./tap-queue";
import type { ClientSubmitResult } from "./submit-durood";

// Errors where the server may have stored the batch, or will accept it
// unchanged later: keep the batch and its clientId for the next attempt.
const KEEP_BATCH = new Set(["network", "server", "rate_limited", "paused"]);

export type FlushOutcome =
  | { status: "idle" }
  | { status: "synced" }
  | { status: "failed"; error: string; max?: number };

export type FlushHooks = {
  /** A new batch is about to be sent (good moment for an optimistic add). */
  onSend?: (batch: Batch) => void;
  onConfirmed?: (batch: Batch, result: Extract<ClientSubmitResult, { ok: true }>) => void;
  /** The send failed; `fresh` says whether onSend ran for it on this page. */
  onFailed?: (batch: Batch, fresh: boolean) => void;
};

/**
 * Sends batches until nothing is left or one fails. Never drops taps: a
 * failed batch either stays in flight (same clientId) or goes back to pending.
 */
export async function flushQueue(
  queue: TapQueue,
  send: (batch: Batch) => Promise<ClientSubmitResult>,
  hooks: FlushHooks = {},
  maxBatch = DEFAULT_MAX_BATCH,
): Promise<FlushOutcome> {
  let sent = false;

  // Bounded so a misbehaving server can't keep us looping.
  for (let i = 0; i < 50; i++) {
    const batch = queue.takeBatch(maxBatch);
    if (!batch) break;

    const { fresh, ...plain } = batch;
    if (fresh) hooks.onSend?.(plain);

    const result = await send(plain);
    if (result.ok) {
      queue.confirm(plain.clientId);
      hooks.onConfirmed?.(plain, result);
      sent = true;
      continue;
    }

    hooks.onFailed?.(plain, fresh);
    if (!KEEP_BATCH.has(result.error)) {
      queue.requeue(plain.clientId);
      // Server allows less per entry than our batch: split and carry on.
      if (result.error === "entry_limit" && result.max && result.max < plain.count) {
        maxBatch = result.max;
        continue;
      }
    }
    return { status: "failed", error: result.error, max: result.max };
  }

  return sent ? { status: "synced" } : { status: "idle" };
}

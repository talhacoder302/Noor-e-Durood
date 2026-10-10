// Tasbeeh taps waiting to be sent, kept in localStorage so nothing is lost on
// reload, crash or going offline.
//
// Rules that keep counting exact:
// - A batch gets its clientId when it is created and that is saved BEFORE the
//   request goes out. Every retry (timer, beacon, reload) reuses it, and the
//   server ignores a clientId it has already counted.
// - A batch is only cleared when the server confirms it.
// - Rejections the server never stored (limits, validation) go back to
//   pending so a later batch can carry them.

export const TAP_QUEUE_KEY = "noor.tasbeeh.v1";

/** Small enough to stay under the server's maxPerEntry (10,000 by default). */
export const DEFAULT_MAX_BATCH = 1000;

export type Batch = { clientId: string; count: number };

export type QueueState = {
  /** On-screen count for this sitting; reset by the user. */
  session: number;
  /** Taps not yet put in a batch. */
  pending: number;
  /** Batch sent (or about to be) but not yet confirmed. */
  inflight: Batch | null;
};

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

const EMPTY: QueueState = { session: 0, pending: 0, inflight: null };

function wholeNumber(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : 0;
}

export function parseQueueState(raw: string | null): QueueState {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw) as Partial<QueueState>;
    const inflight =
      data.inflight &&
      typeof data.inflight.clientId === "string" &&
      wholeNumber(data.inflight.count) > 0
        ? { clientId: data.inflight.clientId, count: data.inflight.count }
        : null;
    return {
      session: wholeNumber(data.session),
      pending: wholeNumber(data.pending),
      inflight,
    };
  } catch {
    return EMPTY;
  }
}

/** Taps that the server has not confirmed yet. */
export function unsentCount(state: QueueState): number {
  return state.pending + (state.inflight?.count ?? 0);
}

export class TapQueue {
  constructor(
    private readonly storage: StorageLike,
    private readonly newId: () => string,
  ) {}

  /** Always read fresh: another tab may have changed it. */
  read(): QueueState {
    try {
      return parseQueueState(this.storage.getItem(TAP_QUEUE_KEY));
    } catch {
      return EMPTY;
    }
  }

  private write(state: QueueState): QueueState {
    try {
      this.storage.setItem(TAP_QUEUE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked; nothing better to do than keep going.
    }
    return state;
  }

  tap(): QueueState {
    const s = this.read();
    return this.write({ ...s, session: s.session + 1, pending: s.pending + 1 });
  }

  resetSession(): QueueState {
    return this.write({ ...this.read(), session: 0 });
  }

  /**
   * The batch to send next: the unconfirmed one if there is one (same
   * clientId), otherwise a new one cut from pending. `fresh` is true only
   * for a newly created batch.
   */
  takeBatch(maxBatch = DEFAULT_MAX_BATCH): (Batch & { fresh: boolean }) | null {
    const s = this.read();
    if (s.inflight) return { ...s.inflight, fresh: false };
    if (s.pending <= 0) return null;

    const count = Math.min(s.pending, Math.max(1, maxBatch));
    const inflight = { clientId: this.newId(), count };
    this.write({ ...s, pending: s.pending - count, inflight });
    return { ...inflight, fresh: true };
  }

  /** The server counted this batch. */
  confirm(clientId: string): QueueState {
    const s = this.read();
    if (s.inflight?.clientId !== clientId) return s;
    return this.write({ ...s, inflight: null });
  }

  /** The server refused this batch without storing it: return the taps. */
  requeue(clientId: string): QueueState {
    const s = this.read();
    if (s.inflight?.clientId !== clientId) return s;
    return this.write({
      ...s,
      pending: s.pending + s.inflight.count,
      inflight: null,
    });
  }
}

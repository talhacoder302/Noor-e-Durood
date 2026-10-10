import { describe, expect, it, vi } from "vitest";
import type { ClientSubmitResult } from "./submit-durood";
import {
  parseQueueState,
  TAP_QUEUE_KEY,
  TapQueue,
  unsentCount,
  type Batch,
} from "./tap-queue";
import { flushQueue } from "./tap-sync";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

function makeQueue() {
  let n = 0;
  const storage = memoryStorage();
  const queue = new TapQueue(storage, () => `id-${++n}`);
  return { queue, storage };
}

const totals = { total: 1, today: 1, month: 1, dayKey: "2026-10-10" };
const ok = (): ClientSubmitResult => ({
  ok: true,
  duplicate: false,
  deviceId: "d",
  totals,
});

function tapTimes(queue: TapQueue, n: number) {
  for (let i = 0; i < n; i++) queue.tap();
}

/** Fake server that counts each clientId once, like the real one. */
function fakeServer() {
  const seen = new Map<string, number>();
  return {
    seen,
    total: () => [...seen.values()].reduce((a, b) => a + b, 0),
    send: vi.fn(async (b: Batch): Promise<ClientSubmitResult> => {
      if (!seen.has(b.clientId)) seen.set(b.clientId, b.count);
      return ok();
    }),
  };
}

describe("TapQueue", () => {
  it("counts taps into the session and pending", () => {
    const { queue } = makeQueue();
    tapTimes(queue, 5);
    expect(queue.read()).toEqual({ session: 5, pending: 5, inflight: null });
  });

  it("persists so a reload sees the same state", () => {
    const { queue, storage } = makeQueue();
    tapTimes(queue, 3);
    const again = new TapQueue(storage, () => "x");
    expect(again.read()).toMatchObject({ session: 3, pending: 3 });
  });

  it("resets only the session, never unsent taps", () => {
    const { queue } = makeQueue();
    tapTimes(queue, 4);
    queue.takeBatch();
    queue.tap();
    expect(queue.resetSession()).toEqual({
      session: 0,
      pending: 1,
      inflight: { clientId: "id-1", count: 4 },
    });
  });

  it("reuses the in-flight batch and its clientId until confirmed", () => {
    const { queue } = makeQueue();
    tapTimes(queue, 10);

    const first = queue.takeBatch();
    queue.tap();
    const again = queue.takeBatch();

    expect(first).toEqual({ clientId: "id-1", count: 10, fresh: true });
    expect(again).toEqual({ clientId: "id-1", count: 10, fresh: false });
    expect(unsentCount(queue.read())).toBe(11);

    queue.confirm("id-1");
    expect(queue.read()).toMatchObject({ pending: 1, inflight: null });
  });

  it("ignores a confirm for a batch that is no longer in flight", () => {
    const { queue } = makeQueue();
    tapTimes(queue, 2);
    queue.takeBatch();
    queue.confirm("someone-else");
    expect(queue.read().inflight).toEqual({ clientId: "id-1", count: 2 });
  });

  it("caps batch size", () => {
    const { queue } = makeQueue();
    tapTimes(queue, 25);
    expect(queue.takeBatch(10)).toMatchObject({ count: 10 });
    expect(queue.read().pending).toBe(15);
  });

  it("returns refused taps to pending", () => {
    const { queue } = makeQueue();
    tapTimes(queue, 7);
    queue.takeBatch();
    queue.tap();
    expect(queue.requeue("id-1")).toEqual({ session: 8, pending: 8, inflight: null });
  });

  it("survives corrupt storage", () => {
    expect(parseQueueState("{not json")).toEqual({ session: 0, pending: 0, inflight: null });
    expect(
      parseQueueState(JSON.stringify({ session: -3, pending: 1.5, inflight: { clientId: 4 } })),
    ).toEqual({ session: 0, pending: 0, inflight: null });
  });
});

describe("flushQueue", () => {
  it("sends everything in batches and confirms them", async () => {
    const { queue } = makeQueue();
    const server = fakeServer();
    tapTimes(queue, 2500);

    const outcome = await flushQueue(queue, server.send, {}, 1000);

    expect(outcome).toEqual({ status: "synced" });
    expect(server.send).toHaveBeenCalledTimes(3);
    expect(server.total()).toBe(2500);
    expect(unsentCount(queue.read())).toBe(0);
  });

  it("does nothing when there is nothing to send", async () => {
    const { queue } = makeQueue();
    const server = fakeServer();
    expect(await flushQueue(queue, server.send)).toEqual({ status: "idle" });
    expect(server.send).not.toHaveBeenCalled();
  });

  it("keeps the batch and clientId after a network error, then never double counts", async () => {
    const { queue } = makeQueue();
    const server = fakeServer();
    tapTimes(queue, 50);

    // The request reached the server but the reply was lost.
    const lostReply = vi.fn(async (b: Batch): Promise<ClientSubmitResult> => {
      await server.send(b);
      return { ok: false, error: "network" };
    });
    expect(await flushQueue(queue, lostReply)).toMatchObject({
      status: "failed",
      error: "network",
    });
    expect(queue.read().inflight).toEqual({ clientId: "id-1", count: 50 });

    tapTimes(queue, 5);
    expect(await flushQueue(queue, server.send)).toEqual({ status: "synced" });

    expect(server.total()).toBe(55);
    expect(server.send.mock.calls.map(([b]) => b.clientId)).toEqual(["id-1", "id-1", "id-2"]);
    expect(unsentCount(queue.read())).toBe(0);
  });

  it("keeps the batch while rate limited or paused", async () => {
    for (const error of ["rate_limited", "paused", "server"] as const) {
      const { queue } = makeQueue();
      tapTimes(queue, 3);
      await flushQueue(queue, async () => ({ ok: false, error }));
      expect(queue.read().inflight).toEqual({ clientId: "id-1", count: 3 });
    }
  });

  it("puts taps back in pending when the server refuses them", async () => {
    const { queue } = makeQueue();
    tapTimes(queue, 9);
    const outcome = await flushQueue(queue, async () => ({
      ok: false,
      error: "daily_limit",
      max: 100,
    }));

    expect(outcome).toEqual({ status: "failed", error: "daily_limit", max: 100 });
    expect(queue.read()).toMatchObject({ pending: 9, inflight: null });
  });

  it("splits batches when the server allows less per entry", async () => {
    const { queue } = makeQueue();
    const server = fakeServer();
    tapTimes(queue, 250);

    const strict = vi.fn(async (b: Batch): Promise<ClientSubmitResult> =>
      b.count > 100 ? { ok: false, error: "entry_limit", max: 100 } : server.send(b),
    );

    expect(await flushQueue(queue, strict, {}, 1000)).toEqual({ status: "synced" });
    expect(server.total()).toBe(250);
    expect([...server.seen.values()]).toEqual([100, 100, 50]);
  });

  it("calls the optimistic hooks once per new batch", async () => {
    const { queue } = makeQueue();
    tapTimes(queue, 4);
    const onSend = vi.fn();
    const onFailed = vi.fn();
    const onConfirmed = vi.fn();

    await flushQueue(queue, async () => ({ ok: false, error: "network" }), { onSend, onFailed });
    await flushQueue(queue, async () => ok(), { onSend, onConfirmed });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledWith({ clientId: "id-1", count: 4 }, true);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it("stores state under the expected key", () => {
    const { queue, storage } = makeQueue();
    queue.tap();
    expect(storage.data.has(TAP_QUEUE_KEY)).toBe(true);
  });
});

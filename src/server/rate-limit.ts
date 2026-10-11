import "server-only";
import { RateLimit, type RateLimitDoc } from "@/models/rate-limit";

const MINUTE_MS = 60_000;

/**
 * Fixed-window counter (one minute unless told otherwise). Returns true while the key is within its
 * limit. Atomic $inc, so concurrent requests are counted correctly.
 */
export async function hitRateLimit(
  key: string,
  limit: number,
  now: Date = new Date(),
  windowMs: number = MINUTE_MS,
): Promise<boolean> {
  const bucket = Math.floor(now.getTime() / windowMs);
  const doc = await RateLimit.findOneAndUpdate(
    { _id: `${key}:${bucket}` },
    {
      $inc: { n: 1 },
      $setOnInsert: { expiresAt: new Date((bucket + 2) * windowMs) },
    },
    { upsert: true, returnDocument: "after" },
  ).lean<RateLimitDoc>();

  return doc.n <= limit;
}

/**
 * True while the key is still under its limit, without counting this call.
 * Pair with hitRateLimit when only some outcomes should count (e.g. only
 * wrong PINs, or only accounts actually created).
 */
export async function underRateLimit(
  key: string,
  limit: number,
  now: Date = new Date(),
  windowMs: number = MINUTE_MS,
): Promise<boolean> {
  const bucket = Math.floor(now.getTime() / windowMs);
  const doc = await RateLimit.findById(`${key}:${bucket}`, { n: 1 }).lean<RateLimitDoc>();
  return (doc?.n ?? 0) < limit;
}

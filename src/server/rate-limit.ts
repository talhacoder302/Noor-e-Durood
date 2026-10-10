import "server-only";
import { RateLimit, type RateLimitDoc } from "@/models/rate-limit";

const WINDOW_MS = 60_000;

/**
 * Fixed one-minute window counter. Returns true while the key is within its
 * limit. Atomic $inc, so concurrent requests are counted correctly.
 */
export async function hitRateLimit(
  key: string,
  limit: number,
  now: Date = new Date(),
): Promise<boolean> {
  const bucket = Math.floor(now.getTime() / WINDOW_MS);
  const doc = await RateLimit.findOneAndUpdate(
    { _id: `${key}:${bucket}` },
    {
      $inc: { n: 1 },
      $setOnInsert: { expiresAt: new Date((bucket + 2) * WINDOW_MS) },
    },
    { upsert: true, returnDocument: "after" },
  ).lean<RateLimitDoc>();

  return doc.n <= limit;
}

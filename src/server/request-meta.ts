import "server-only";
import { createHash } from "node:crypto";
import { getEnv } from "@/lib/env";

/** Best guess at the visitor's IP behind Hostinger's proxy. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** SHA-256 of the IP with a secret salt. The raw IP is never stored. */
export function hashIp(ip: string): string {
  const { IP_HASH_SALT } = getEnv();
  return createHash("sha256").update(`${IP_HASH_SALT}:${ip}`).digest("hex");
}

export function shortUserAgent(headers: Headers): string {
  return (headers.get("user-agent") ?? "").slice(0, 120);
}

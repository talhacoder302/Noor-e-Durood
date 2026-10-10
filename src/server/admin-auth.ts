import "server-only";
import bcrypt from "bcryptjs";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getEnv } from "@/lib/env";
import { hitRateLimit } from "./rate-limit";
import { ready } from "./ready";

export const ADMIN_COOKIE = "nd_admin";
const SESSION_MS = 12 * 60 * 60_000;
const LOGIN_LIMIT = { max: 5, windowMs: 15 * 60_000 };

export const BCRYPT_HASH = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

let hashed: Promise<string> | null = null;

/**
 * ADMIN_PASSWORD may be a bcrypt hash (recommended) or plain text. Plain text
 * is hashed once per process so every check is a bcrypt compare.
 */
function passwordHash(): Promise<string> {
  const { ADMIN_PASSWORD } = getEnv();
  if (BCRYPT_HASH.test(ADMIN_PASSWORD)) return Promise.resolve(ADMIN_PASSWORD);
  hashed ??= bcrypt.hash(ADMIN_PASSWORD, 10);
  return hashed;
}

export async function checkAdminPassword(input: string): Promise<boolean> {
  if (!input || input.length > 200) return false;
  return bcrypt.compare(input, await passwordHash());
}

// Changing ADMIN_PASSWORD (or the salt) signs everyone out.
function sessionKey(): Buffer {
  const { IP_HASH_SALT, ADMIN_PASSWORD } = getEnv();
  return createHash("sha256").update(`admin-session:${IP_HASH_SALT}:${ADMIN_PASSWORD}`).digest();
}

function sign(payload: string): string {
  return createHmac("sha256", sessionKey()).update(payload).digest("base64url");
}

/** `v1.<expiry ms>.<hmac>` */
export function createSessionToken(now: number = Date.now()) {
  const expires = now + SESSION_MS;
  const payload = `v1.${expires}`;
  return { token: `${payload}.${sign(payload)}`, expires: new Date(expires) };
}

export function verifySessionToken(token: string | undefined, now: number = Date.now()): boolean {
  if (!token) return false;
  const [version, exp, mac, ...rest] = token.split(".");
  if (version !== "v1" || !exp || !mac || rest.length) return false;
  const expires = Number(exp);
  if (!Number.isSafeInteger(expires) || expires <= now) return false;

  const expected = Buffer.from(sign(`v1.${exp}`));
  const given = Buffer.from(mac);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export type LoginResult = { ok: true; token: string; expires: Date } | { ok: false; error: "wrong" | "rate_limited" };

/** Rate limited per IP hash: 5 tries per 15 minutes. */
export async function attemptAdminLogin(password: string, ipHash: string, now: Date = new Date()): Promise<LoginResult> {
  await ready();
  if (!(await hitRateLimit(`admin-login:${ipHash}`, LOGIN_LIMIT.max, now, LOGIN_LIMIT.windowMs))) {
    return { ok: false, error: "rate_limited" };
  }
  if (!(await checkAdminPassword(password))) return { ok: false, error: "wrong" };
  return { ok: true, ...createSessionToken(now.getTime()) };
}

export async function isAdmin(): Promise<boolean> {
  // Request-time only: the expiry check reads the clock.
  await connection();
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

/** Every admin action and page calls this first. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Not authorized");
}

export const adminCookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  expires,
});

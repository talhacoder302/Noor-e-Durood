import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { Session, type SessionDoc } from "@/models/session";
import { ready } from "./ready";

export const SESSION_COOKIE = "nd_session";

// People shouldn't have to log in again: a year, renewed as they use it.
const SESSION_MS = 365 * 24 * 60 * 60_000;
const TOUCH_EVERY_MS = 24 * 60 * 60_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, userAgentShort: string, now: Date = new Date()) {
  await ready();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_MS);
  await Session.create({
    _id: hashToken(token),
    userId,
    userAgentShort,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
  });
  return { token, expires: expiresAt };
}

/** The user id behind a cookie token, or null. Renews active sessions. */
export async function readSession(token: string | undefined, now: Date = new Date()): Promise<string | null> {
  if (!token || token.length > 100) return null;
  await ready();
  const id = hashToken(token);
  const session = await Session.findById(id).lean<SessionDoc>();
  if (!session || session.expiresAt <= now) return null;

  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await Session.updateOne(
      { _id: id },
      { $set: { lastSeenAt: now, expiresAt: new Date(now.getTime() + SESSION_MS) } },
    );
  }
  return session.userId;
}

export async function deleteSession(token: string | undefined) {
  if (!token) return;
  await ready();
  await Session.deleteOne({ _id: hashToken(token) });
}

/** Log out everywhere (also used when an admin resets a PIN or disables). */
export async function deleteAllSessions(userId: string) {
  await ready();
  await Session.deleteMany({ userId });
}

export function setSessionCookie(response: NextResponse, token: string, expires: Date) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

import "server-only";
import type { NextResponse } from "next/server";
import { isUuid } from "@/lib/uuid";

export const DEVICE_COOKIE = "nd_device";

// Browsers cap cookie lifetime at 400 days; it is refreshed on every submit.
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * The cookie wins when both exist, so a device keeps one id even if
 * localStorage was cleared and a new id was generated.
 */
export function resolveDeviceId(
  cookieValue: string | undefined,
  bodyDeviceId: string,
): string {
  return isUuid(cookieValue) ? cookieValue : bodyDeviceId;
}

export function setDeviceCookie(response: NextResponse, deviceId: string) {
  response.cookies.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { deviceSyncSchema } from "@/lib/validation";
import {
  DEVICE_COOKIE,
  resolveDeviceId,
  setDeviceCookie,
} from "@/server/device-cookie";

/**
 * Called once when the browser has no device id in localStorage. Returns the
 * id from the httpOnly cookie if there is one (localStorage was cleared),
 * otherwise stores the browser's freshly generated id in the cookie.
 */
export async function POST(request: NextRequest) {
  const parsed = deviceSyncSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const deviceId = resolveDeviceId(
    request.cookies.get(DEVICE_COOKIE)?.value,
    parsed.data.deviceId,
  );
  const response = NextResponse.json(
    { deviceId },
    { headers: { "Cache-Control": "no-store" } },
  );
  setDeviceCookie(response, deviceId);
  return response;
}

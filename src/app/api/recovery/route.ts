import { NextResponse, type NextRequest } from "next/server";
import { deviceSyncSchema } from "@/lib/validation";
import { DEVICE_COOKIE, resolveDeviceId, setDeviceCookie } from "@/server/device-cookie";
import { createRecoveryCode } from "@/server/recovery";

const NO_STORE = { "Cache-Control": "no-store" };

/** Creates (or replaces) this device's recovery code. */
export async function POST(request: NextRequest) {
  const parsed = deviceSyncSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400, headers: NO_STORE });
  }
  const deviceId = resolveDeviceId(request.cookies.get(DEVICE_COOKIE)?.value, parsed.data.deviceId);

  try {
    const result = await createRecoveryCode(deviceId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 429, headers: NO_STORE });
    }
    const response = NextResponse.json({ code: result.code, deviceId }, { headers: NO_STORE });
    setDeviceCookie(response, deviceId);
    return response;
  } catch (error) {
    console.error("Failed to create recovery code:", error);
    return NextResponse.json({ error: "server" }, { status: 500, headers: NO_STORE });
  }
}

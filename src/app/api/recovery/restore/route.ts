import { NextResponse, type NextRequest } from "next/server";
import { recoveryRestoreSchema } from "@/lib/validation";
import { DEVICE_COOKIE, resolveDeviceId, setDeviceCookie } from "@/server/device-cookie";
import { restoreFromCode } from "@/server/recovery";
import { getClientIp, hashIp } from "@/server/request-meta";

const NO_STORE = { "Cache-Control": "no-store" };
const STATUS = { invalid: 400, not_found: 404, rate_limited: 429 } as const;

/** Links this device to the stats of the device that owns the code. */
export async function POST(request: NextRequest) {
  const parsed = recoveryRestoreSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400, headers: NO_STORE });
  }
  const current = resolveDeviceId(request.cookies.get(DEVICE_COOKIE)?.value, parsed.data.deviceId);

  try {
    const result = await restoreFromCode(
      parsed.data.code,
      current,
      hashIp(getClientIp(request.headers)),
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: STATUS[result.error], headers: NO_STORE });
    }
    // From now on this phone uses the restored id (the cookie wins on the server).
    const response = NextResponse.json(
      { deviceId: result.deviceId, merged: result.merged },
      { headers: NO_STORE },
    );
    setDeviceCookie(response, result.deviceId);
    return response;
  } catch (error) {
    console.error("Failed to restore from recovery code:", error);
    return NextResponse.json({ error: "server" }, { status: 500, headers: NO_STORE });
  }
}

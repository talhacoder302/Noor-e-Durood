import { connection, NextResponse, type NextRequest } from "next/server";
import { isUuid } from "@/lib/uuid";
import { DEVICE_COOKIE, setDeviceCookie } from "@/server/device-cookie";
import { getMySummary } from "@/server/me";

// Private: a device only ever gets its own numbers. Never cached by proxies.
const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  await connection();
  const cookieId = request.cookies.get(DEVICE_COOKIE)?.value;
  const queryId = request.nextUrl.searchParams.get("deviceId");
  const deviceId = isUuid(cookieId) ? cookieId : isUuid(queryId) ? queryId : null;

  if (!deviceId) {
    return NextResponse.json({ error: "invalid" }, { status: 400, headers: PRIVATE });
  }

  try {
    const response = NextResponse.json(
      { deviceId, summary: await getMySummary(deviceId) },
      { headers: PRIVATE },
    );
    if (cookieId !== deviceId) setDeviceCookie(response, deviceId);
    return response;
  } catch (error) {
    console.error("Failed to load personal summary:", error);
    return NextResponse.json({ error: "server" }, { status: 500, headers: PRIVATE });
  }
}

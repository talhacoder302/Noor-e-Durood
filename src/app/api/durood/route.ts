import { NextResponse, type NextRequest } from "next/server";
import type { SubmitResponse } from "@/lib/types";
import { duroodSubmissionSchema } from "@/lib/validation";
import { addDurood } from "@/server/counter";
import {
  DEVICE_COOKIE,
  resolveDeviceId,
  setDeviceCookie,
} from "@/server/device-cookie";
import { getClientIp, hashIp, shortUserAgent } from "@/server/request-meta";

const STATUS = {
  invalid: 400,
  entry_limit: 400,
  daily_limit: 429,
  rate_limited: 429,
  paused: 503,
  blocked: 403,
  server: 500,
} as const;

function reply(body: SubmitResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return reply({ ok: false, error: "invalid" }, STATUS.invalid);
  }

  const parsed = duroodSubmissionSchema.safeParse(raw);
  if (!parsed.success) {
    return reply({ ok: false, error: "invalid" }, STATUS.invalid);
  }

  const cookieId = request.cookies.get(DEVICE_COOKIE)?.value;
  const deviceId = resolveDeviceId(cookieId, parsed.data.deviceId);

  try {
    const result = await addDurood({
      deviceId,
      clientId: parsed.data.clientId,
      count: parsed.data.count,
      mode: parsed.data.mode,
      ipHash: hashIp(getClientIp(request.headers)),
      userAgentShort: shortUserAgent(request.headers),
    });

    if (!result.ok) return reply(result, STATUS[result.error]);

    const response = reply({ ...result, deviceId });
    setDeviceCookie(response, deviceId);
    return response;
  } catch (error) {
    console.error("Failed to add durood:", error);
    return reply({ ok: false, error: "server" }, STATUS.server);
  }
}

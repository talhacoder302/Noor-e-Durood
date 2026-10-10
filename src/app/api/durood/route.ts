import { NextResponse, type NextRequest } from "next/server";
import type { SubmitResponse } from "@/lib/types";
import { duroodSubmissionSchema } from "@/lib/validation";
import { getSessionUser } from "@/server/accounts";
import { addDurood } from "@/server/counter";
import {
  DEVICE_COOKIE,
  resolveDeviceId,
  setDeviceCookie,
} from "@/server/device-cookie";
import { isJsonRequest } from "@/server/http";
import { getClientIp, hashIp, shortUserAgent } from "@/server/request-meta";
import { SESSION_COOKIE } from "@/server/session";

const STATUS = {
  invalid: 400,
  entry_limit: 400,
  daily_limit: 429,
  rate_limited: 429,
  paused: 503,
  blocked: 403,
  login_required: 401,
  server: 500,
} as const;

function reply(body: SubmitResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return reply({ ok: false, error: "invalid" }, STATUS.invalid);
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
    // Adding durood needs an account; guests can only watch the counts.
    const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) return reply({ ok: false, error: "login_required" }, STATUS.login_required);

    const result = await addDurood({
      userId: user._id.toString(),
      majlisId: user.majlisId,
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

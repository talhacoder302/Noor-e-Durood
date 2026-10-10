import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { credentialsSchema } from "@/lib/validation";
import { isUuid } from "@/lib/uuid";
import { publicUser, type AuthResult } from "./accounts";
import { DEVICE_COOKIE } from "./device-cookie";
import { isJsonRequest, jsonError, NO_STORE, readJson } from "./http";
import { getClientIp, hashIp, shortUserAgent } from "./request-meta";
import { setSessionCookie } from "./session";

const STATUS: Record<string, number> = {
  invalid_phone: 400,
  invalid_pin: 400,
  weak_pin: 400,
  phone_taken: 409,
  wrong: 401,
  locked: 423,
  disabled: 403,
  rate_limited: 429,
};

type Handler = (
  phone: string,
  pin: string,
  meta: { ipHash: string; userAgentShort: string; deviceId?: string },
) => Promise<AuthResult>;

/** Shared by /api/auth/signup and /api/auth/login. */
export async function handleCredentials(request: NextRequest, handler: Handler) {
  if (!isJsonRequest(request)) return jsonError("invalid", 415);
  const parsed = credentialsSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("invalid", 400);

  const deviceCookie = request.cookies.get(DEVICE_COOKIE)?.value;
  try {
    const result = await handler(parsed.data.phone, parsed.data.pin, {
      ipHash: hashIp(getClientIp(request.headers)),
      userAgentShort: shortUserAgent(request.headers),
      deviceId: isUuid(deviceCookie) ? deviceCookie : undefined,
    });
    if (!result.ok) {
      return jsonError(result.error, STATUS[result.error] ?? 400, {
        retryAfterMinutes: result.retryAfterMinutes,
      });
    }
    const response = NextResponse.json(
      { ok: true, user: await publicUser(result.user) },
      { headers: NO_STORE },
    );
    setSessionCookie(response, result.token, result.expires);
    return response;
  } catch (error) {
    console.error("Auth request failed:", error);
    return jsonError("server", 500);
  }
}

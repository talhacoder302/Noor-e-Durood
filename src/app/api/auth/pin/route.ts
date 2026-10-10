import { NextResponse, type NextRequest } from "next/server";
import { changePinSchema } from "@/lib/validation";
import { changePin, getSessionUser } from "@/server/accounts";
import { isJsonRequest, jsonError, NO_STORE, readJson } from "@/server/http";
import { SESSION_COOKIE } from "@/server/session";

export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return jsonError("invalid", 415);
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return jsonError("login_required", 401);

  const parsed = changePinSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError("invalid", 400);

  const result = await changePin(user._id.toString(), parsed.data.oldPin, parsed.data.newPin);
  if (!result.ok) return jsonError(result.error, result.error === "wrong" ? 401 : 400);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

import { NextResponse, type NextRequest } from "next/server";
import { logoutSchema } from "@/lib/validation";
import { getSessionUser } from "@/server/accounts";
import { isJsonRequest, jsonError, NO_STORE, readJson } from "@/server/http";
import { clearSessionCookie, deleteAllSessions, deleteSession, SESSION_COOKIE } from "@/server/session";

/** Body `{ all: true }` logs out on every phone. */
export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return jsonError("invalid", 415);
  const parsed = logoutSchema.safeParse((await readJson(request)) ?? {});
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (parsed.success && parsed.data.all) {
    const user = await getSessionUser(token);
    if (user) await deleteAllSessions(user._id.toString());
  } else {
    await deleteSession(token);
  }
  const response = NextResponse.json({ ok: true }, { headers: NO_STORE });
  clearSessionCookie(response);
  return response;
}

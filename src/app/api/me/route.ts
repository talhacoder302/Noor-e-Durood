import { connection, NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/server/accounts";
import { getMySummary } from "@/server/me";
import { SESSION_COOKIE } from "@/server/session";

// Private: an account only ever gets its own numbers. Never cached by proxies.
const PRIVATE = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  await connection();
  try {
    const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
    if (!user) {
      return NextResponse.json({ error: "login_required" }, { status: 401, headers: PRIVATE });
    }
    return NextResponse.json({ summary: await getMySummary(user._id.toString()) }, { headers: PRIVATE });
  } catch (error) {
    console.error("Failed to load personal summary:", error);
    return NextResponse.json({ error: "server" }, { status: 500, headers: PRIVATE });
  }
}

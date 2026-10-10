import { connection, NextResponse, type NextRequest } from "next/server";
import { getSessionUser, publicUser } from "@/server/accounts";
import { NO_STORE } from "@/server/http";
import { SESSION_COOKIE } from "@/server/session";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** The logged-in user, or `{ user: null }` for guests. */
export async function GET(request: NextRequest) {
  await connection();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ user: null }, { headers: PRIVATE });
  try {
    const user = await getSessionUser(token);
    return NextResponse.json({ user: user ? await publicUser(user) : null }, { headers: PRIVATE });
  } catch (error) {
    console.error("Failed to read session:", error);
    return NextResponse.json({ error: "server" }, { status: 500, headers: NO_STORE });
  }
}

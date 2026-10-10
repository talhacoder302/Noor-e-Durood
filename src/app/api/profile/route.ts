import { NextResponse, type NextRequest } from "next/server";
import { profileSchema } from "@/lib/validation";
import { getSessionUser, publicUser, updateProfile } from "@/server/accounts";
import { isJsonRequest, jsonError, NO_STORE, readJson } from "@/server/http";
import { SESSION_COOKIE } from "@/server/session";

/** Saves the logged-in user's optional profile (name, majlis, age, city). */
export async function POST(request: NextRequest) {
  if (!isJsonRequest(request)) return jsonError("invalid", 415);
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return jsonError("login_required", 401);

  const parsed = profileSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return jsonError("invalid", 400, { field: parsed.error.issues[0]?.path.join(".") });
  }
  try {
    const result = await updateProfile(user._id.toString(), parsed.data);
    if (!result.ok) return jsonError(result.error, 400, { field: "majlis" });
    return NextResponse.json({ ok: true, user: await publicUser(result.user) }, { headers: NO_STORE });
  } catch (error) {
    console.error("Failed to save profile:", error);
    return jsonError("server", 500);
  }
}

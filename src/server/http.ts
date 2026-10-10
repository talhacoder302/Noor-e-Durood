import "server-only";
import { NextResponse, type NextRequest } from "next/server";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Account endpoints only take JSON. A browser can't send a cross-site JSON
 * POST without a CORS preflight (which we never allow), so this blocks
 * cross-site form tricks on top of the SameSite=Lax cookie.
 */
export function isJsonRequest(request: NextRequest): boolean {
  return (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}

export function jsonError(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error, ...extra }, { status, headers: NO_STORE });
}

export async function readJson(request: NextRequest): Promise<unknown> {
  return request.json().catch(() => null);
}

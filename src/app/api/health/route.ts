import { connection } from "next/server";
import { isDatabaseUp } from "@/server/health";

export async function GET() {
  await connection();
  const dbUp = await isDatabaseUp();

  return Response.json(
    { ok: dbUp, db: dbUp ? "up" : "down" },
    { status: dbUp ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}

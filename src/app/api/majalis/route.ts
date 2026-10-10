import { connection } from "next/server";
import { getCachedMajalis } from "@/server/majalis";

/** Active majalis for the profile dropdown. Public, cached for a few minutes. */
export async function GET() {
  await connection();
  try {
    return Response.json(
      { majalis: await getCachedMajalis() },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
    );
  } catch (error) {
    console.error("Failed to list majalis:", error);
    return Response.json({ error: "server" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

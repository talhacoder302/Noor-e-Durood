import { connection } from "next/server";
import { getCachedTotals } from "@/server/stats";

export async function GET() {
  await connection();
  try {
    const totals = await getCachedTotals();
    return Response.json(totals, {
      // Matches the 3s server cache; lets a CDN in front share it too.
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=3, stale-while-revalidate=10",
      },
    });
  } catch (error) {
    console.error("Failed to read stats:", error);
    return Response.json(
      { error: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

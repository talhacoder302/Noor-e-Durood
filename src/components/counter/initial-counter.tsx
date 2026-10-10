import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import type { Totals } from "@/lib/types";
import { getCachedTotals } from "@/server/stats";
import { LiveCounter } from "./live-counter";

/**
 * Server-renders the first totals so the number is in the HTML before any
 * JavaScript loads. If the database is down, the client polls instead.
 */
export async function InitialCounter() {
  // Request time only: keeps the build from touching the database (and
  // from needing database env vars at build time).
  await connection();
  let initial: Totals | null = null;
  try {
    initial = await getCachedTotals();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Could not load initial totals:", error);
  }
  return <LiveCounter initial={initial} />;
}

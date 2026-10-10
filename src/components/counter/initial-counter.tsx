import { unstable_rethrow } from "next/navigation";
import type { Totals } from "@/lib/types";
import { getCachedTotals } from "@/server/stats";
import { LiveCounter } from "./live-counter";

/**
 * Server-renders the first totals so the number is in the HTML before any
 * JavaScript loads. If the database is down, the client polls instead.
 */
export async function InitialCounter() {
  let initial: Totals | null = null;
  try {
    initial = await getCachedTotals();
  } catch (error) {
    unstable_rethrow(error);
    console.error("Could not load initial totals:", error);
  }
  return <LiveCounter initial={initial} />;
}

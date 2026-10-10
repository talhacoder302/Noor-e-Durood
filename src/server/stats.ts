import "server-only";
import { cacheLife } from "next/cache";
import type { Totals } from "@/lib/types";
import { getTotals } from "./counter";

/**
 * Public totals, cached on the server for ~3 seconds so thousands of polling
 * visitors share one database read. The short expire keeps this out of the
 * build-time prerender: it always resolves at request time.
 */
export async function getCachedTotals(): Promise<Totals> {
  "use cache";
  cacheLife({ stale: 3, revalidate: 3, expire: 60 });
  return getTotals();
}

import "server-only";
import { connectDb } from "@/lib/db";
import { Counter } from "@/models/counter";
import { DeviceStat } from "@/models/device-stat";
import { Entry } from "@/models/entry";
import { RateLimit } from "@/models/rate-limit";
import { Majlis } from "@/models/majlis";
import { Session } from "@/models/session";
import { Settings } from "@/models/settings";
import { User } from "@/models/user";

let indexes: Promise<unknown> | null = null;

/**
 * Connects and makes sure indexes exist before the first write. The unique
 * clientId index is what makes submissions idempotent, so we wait for it.
 */
export async function ready(): Promise<void> {
  await connectDb();
  indexes ??= Promise.all([
    Counter.init(),
    Entry.init(),
    DeviceStat.init(),
    RateLimit.init(),
    Settings.init(),
    User.init(),
    Session.init(),
    Majlis.init(),
  ]).catch((error: unknown) => {
    indexes = null;
    throw error;
  });
  await indexes;
}

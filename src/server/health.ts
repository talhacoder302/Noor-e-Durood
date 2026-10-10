import "server-only";
import { connectDb } from "@/lib/db";

export async function isDatabaseUp(): Promise<boolean> {
  try {
    const conn = await connectDb();
    const db = conn.connection.db;
    if (!db) return false;
    await db.admin().ping();
    return true;
  } catch (error) {
    console.error("Database health check failed:", error);
    return false;
  }
}

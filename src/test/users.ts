import { randomInt } from "node:crypto";
import { User } from "@/models/user";

/** Inserts accounts directly (no PIN hashing) for service tests. */
export async function createTestUsers(n: number, extra: Record<string, unknown> = {}): Promise<string[]> {
  const docs = Array.from({ length: n }, () => ({
    phone: `+92300${String(randomInt(10_000_000)).padStart(7, "0")}`,
    pinHash: "test",
    day: "",
    ...extra,
  }));
  const created = await User.insertMany(docs);
  return created.map((u) => u._id.toString());
}

export async function createTestUser(extra: Record<string, unknown> = {}): Promise<string> {
  const [id] = await createTestUsers(1, extra);
  return id;
}

import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { Counter } from "@/models/counter";
import { Entry } from "@/models/entry";
import { RateLimit } from "@/models/rate-limit";
import { User } from "@/models/user";
import { setupMemoryMongo } from "@/test/mongo";
import { createTestUser } from "@/test/users";
import { addDurood, getTotals } from "./counter";
import { getMySummary } from "./me";

setupMemoryMongo("noor_e_durood_me_test");

// Saturday 10 Oct 2026, noon in Karachi. The week started Monday 5 Oct.
const NOW = new Date("2026-10-10T07:00:00Z");
const at = (day: string) => new Date(`${day}T07:00:00Z`);

async function add(userId: string, count: number, day: string, deviceId: string = randomUUID()) {
  const result = await addDurood({
    userId,
    deviceId,
    clientId: randomUUID(),
    count,
    mode: "tap",
    ipHash: randomUUID(),
    userAgentShort: "vitest",
    now: at(day),
  });
  expect(result.ok).toBe(true);
}

beforeEach(async () => {
  await getTotals(NOW);
  await Promise.all([Counter.deleteMany({}), Entry.deleteMany({}), User.deleteMany({}), RateLimit.deleteMany({})]);
});

describe("getMySummary", () => {
  it("adds up today, this week, this month and all time", async () => {
    const me = await createTestUser();
    await add(me, 10, "2026-10-10"); // today
    await add(me, 5, "2026-10-10");
    await add(me, 20, "2026-10-05"); // Monday, this week
    await add(me, 40, "2026-10-04"); // Sunday, last week, this month
    await add(me, 80, "2026-09-30"); // last month

    const s = await getMySummary(me, NOW);
    expect(s).toMatchObject({ today: 15, week: 35, month: 75, allTime: 155 });
    expect(s.last7).toEqual([
      { day: "2026-10-04", count: 40 },
      { day: "2026-10-05", count: 20 },
      { day: "2026-10-06", count: 0 },
      { day: "2026-10-07", count: 0 },
      { day: "2026-10-08", count: 0 },
      { day: "2026-10-09", count: 0 },
      { day: "2026-10-10", count: 15 },
    ]);
  });

  it("counts every phone the account used", async () => {
    const me = await createTestUser();
    await add(me, 7, "2026-10-10", randomUUID());
    await add(me, 3, "2026-10-10", randomUUID());
    expect(await getMySummary(me, NOW)).toMatchObject({ today: 10, allTime: 10 });
  });

  it("only sees its own account and skips removed entries", async () => {
    const me = await createTestUser();
    await add(me, 7, "2026-10-10");
    await add(await createTestUser(), 1000, "2026-10-10");
    await add(me, 3, "2026-10-10");
    await Entry.updateOne({ userId: me, count: 3 }, { $set: { removed: true } });

    expect(await getMySummary(me, NOW)).toMatchObject({ today: 7, allTime: 7 });
  });

  it("is all zeros for a new account", async () => {
    const s = await getMySummary(await createTestUser(), NOW);
    expect(s).toMatchObject({ today: 0, week: 0, month: 0, allTime: 0 });
    expect(s.last7).toHaveLength(7);
  });
});

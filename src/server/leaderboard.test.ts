import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { Entry } from "@/models/entry";
import { Majlis } from "@/models/majlis";
import { User } from "@/models/user";
import { setupMemoryMongo } from "@/test/mongo";
import { createTestUser } from "@/test/users";
import { getLeaderboard, getPublicProfile } from "./leaderboard";
import { ready } from "./ready";

setupMemoryMongo("noor_e_durood_leaderboard_test");

const NOW = new Date("2026-10-10T07:00:00Z");

beforeEach(async () => {
  await ready();
  await Promise.all([User.deleteMany({}), Entry.deleteMany({}), Majlis.deleteMany({})]);
});

describe("getLeaderboard", () => {
  it("orders by total, shares ranks on ties, and skips disabled and empty accounts", async () => {
    const m = await Majlis.create({ name: "مجلس لاہور" });
    const a = await createTestUser({ name: "Ali", totalCount: 500, majlisId: m._id.toString(), city: "Lahore" });
    const b = await createTestUser({ name: "Bilal", totalCount: 900 });
    const c = await createTestUser({ totalCount: 500, majlisOther: "My majlis", createdAt: new Date("2026-10-01") });
    await createTestUser({ name: "Off", totalCount: 5000, disabled: true });
    await createTestUser({ name: "New", totalCount: 0 });

    const rows = await getLeaderboard({ showNames: true });
    expect(rows.map((r) => [r.id, r.rank])).toEqual([
      [b, 1],
      [c, 2], // joined before Ali, so listed first among the 500s
      [a, 2],
    ]);
    expect(rows[1]).toMatchObject({ name: "", majlis: "My majlis" });
    expect(rows[2]).toMatchObject({ name: "Ali", majlis: "مجلس لاہور", city: "Lahore", total: 500 });
  });

  it("never returns phone numbers", async () => {
    await createTestUser({ name: "Ali", totalCount: 10 });
    expect(JSON.stringify(await getLeaderboard({ showNames: true }))).not.toContain("+92");
  });

  it("sends only rank and count when names are hidden", async () => {
    const m = await Majlis.create({ name: "مجلس لاہور" });
    const id = await createTestUser({ name: "Ali", totalCount: 900, majlisId: m._id.toString(), city: "Lahore" });
    await createTestUser({ name: "Bilal", totalCount: 900 });

    const rows = await getLeaderboard({ showNames: false });
    expect(rows).toEqual([
      { id: null, rank: 1, name: "", majlis: "", city: "", total: 900 },
      { id: null, rank: 1, name: "", majlis: "", city: "", total: 900 },
    ]);
    const json = JSON.stringify(rows);
    for (const secret of ["Ali", "Bilal", "Lahore", "مجلس", id, "+92"]) expect(json).not.toContain(secret);
  });

  it("stops at the limit", async () => {
    for (let i = 1; i <= 5; i++) await createTestUser({ totalCount: i });
    const rows = await getLeaderboard({ showNames: true, limit: 3 });
    expect(rows.map((r) => r.total)).toEqual([5, 4, 3]);
  });
});

describe("getPublicProfile", () => {
  it("shows profile fields, rank and this month's counts", async () => {
    await createTestUser({ totalCount: 1000 });
    const id = await createTestUser({
      name: "Ali",
      city: "Lahore",
      birthYear: 1996,
      totalCount: 300,
      createdAt: new Date("2026-09-15T07:00:00Z"),
    });
    const entry = (count: number, day: string, removed = false) => ({
      clientId: randomUUID(),
      deviceId: "d",
      userId: id,
      count,
      mode: "tap" as const,
      day,
      ipHash: "x",
      removed,
    });
    await Entry.create([
      entry(100, "2026-09-30"),
      entry(150, "2026-10-04"),
      entry(50, "2026-10-10"),
      entry(999, "2026-10-10", true),
    ]);

    const p = await getPublicProfile(id, NOW);
    expect(p).toMatchObject({ name: "Ali", city: "Lahore", age: 30, joined: "2026-09", rank: 2, total: 300, today: 50, month: 200 });
    expect(p?.last7.map((d) => d.count)).toEqual([150, 0, 0, 0, 0, 0, 50]); // 4–10 Oct
    expect(JSON.stringify(p)).not.toContain("+92");
  });

  it("returns null for bad ids, unknown ids and disabled accounts", async () => {
    const off = await createTestUser({ disabled: true, totalCount: 5 });
    expect(await getPublicProfile("not-an-id")).toBeNull();
    expect(await getPublicProfile("0123456789abcdef01234567")).toBeNull();
    expect(await getPublicProfile(off)).toBeNull();
  });

  it("has no rank before the first durood", async () => {
    const id = await createTestUser();
    expect(await getPublicProfile(id, NOW)).toMatchObject({ rank: null, total: 0 });
  });
});

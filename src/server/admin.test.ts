import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { Counter } from "@/models/counter";
import { Entry } from "@/models/entry";
import { Majlis } from "@/models/majlis";
import { RateLimit } from "@/models/rate-limit";
import { Session } from "@/models/session";
import { User } from "@/models/user";
import { setupMemoryMongo } from "@/test/mongo";
import { createTestUser } from "@/test/users";
import { login, signup } from "./accounts";
import {
  getDashboard,
  listEntries,
  listUsers,
  recalculateTotals,
  removeEntry,
  resetUserPin,
  setUserDisabled,
} from "./admin";
import { addDurood, getTotals } from "./counter";
import { readSession } from "./session";

setupMemoryMongo("noor_e_durood_admin_test");

const NOW = new Date("2026-10-10T07:00:00Z");
const at = (iso: string) => new Date(iso);

async function add(userId: string, count: number, now: Date = NOW, majlisId?: string) {
  const r = await addDurood({
    userId,
    majlisId,
    deviceId: randomUUID(),
    clientId: randomUUID(),
    count,
    mode: "number",
    ipHash: randomUUID(),
    userAgentShort: "vitest",
    now,
  });
  if (!r.ok) throw new Error(`add failed: ${r.error}`);
  return r;
}

async function entryIdFor(userId: string, count: number) {
  const e = await Entry.findOne({ userId, count }).lean();
  if (!e) throw new Error("entry not found");
  return e._id.toString();
}

beforeEach(async () => {
  await getTotals(NOW);
  await Promise.all([
    Counter.deleteMany({}),
    Entry.deleteMany({}),
    User.deleteMany({}),
    Session.deleteMany({}),
    RateLimit.deleteMany({}),
    Majlis.deleteMany({}),
  ]);
});

describe("removeEntry", () => {
  it("takes the count back off every counter and the user", async () => {
    const spammer = await createTestUser();
    await add(await createTestUser(), 100);
    await add(spammer, 9000);
    const id = await entryIdFor(spammer, 9000);

    expect(await removeEntry(id, "spam", NOW)).toEqual({ ok: true, count: 9000 });
    expect(await getTotals(NOW)).toMatchObject({ total: 100, today: 100, month: 100 });
    expect(await User.findById(spammer).lean()).toMatchObject({ totalCount: 0, dayCount: 0 });
    expect(await Entry.findById(id).lean()).toMatchObject({ removed: true, removedReason: "spam" });
  });

  it("only ever subtracts once, even when clicked twice at the same time", async () => {
    const u = await createTestUser();
    await add(u, 500);
    await add(u, 20);
    const id = await entryIdFor(u, 500);

    const results = await Promise.all([removeEntry(id, "first", NOW), removeEntry(id, "second", NOW)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await getTotals(NOW)).toMatchObject({ total: 20 });
  });

  it("fixes the right day and month for an older entry", async () => {
    const u = await createTestUser();
    await add(u, 70, at("2026-09-30T07:00:00Z"));
    await add(u, 5, NOW);
    const id = await entryIdFor(u, 70);

    await removeEntry(id, "old spam", NOW);
    expect(await Counter.findById("day:2026-09-30").lean()).toMatchObject({ count: 0 });
    expect(await Counter.findById("month:2026-09").lean()).toMatchObject({ count: 0 });
    expect(await getTotals(NOW)).toMatchObject({ total: 5, today: 5, month: 5 });
    // The user is on a later day now: only the all-time total changes.
    expect(await User.findById(u).lean()).toMatchObject({ totalCount: 5, dayCount: 5 });
  });

  it("hides removed entries from the list unless asked, and shows who sent them", async () => {
    const u = await createTestUser({ name: "Ali" });
    await add(u, 3);
    await removeEntry(await entryIdFor(u, 3), "test", NOW);
    expect((await listEntries({}, NOW)).entries).toHaveLength(0);
    const [entry] = (await listEntries({ showRemoved: true }, NOW)).entries;
    expect(entry).toMatchObject({ count: 3, user: { id: u, name: "Ali" } });
  });

  it("filters the list by size, user and phone number", async () => {
    const big = await createTestUser({ phone: "+923001112222" });
    await add(big, 800);
    await add(await createTestUser(), 2);
    expect((await listEntries({ minCount: 100 }, NOW)).entries.map((e) => e.count)).toEqual([800]);
    expect((await listEntries({ userId: big }, NOW)).entries).toHaveLength(1);
    expect((await listEntries({ phone: "0300-1112222" }, NOW)).entries).toHaveLength(1);
    expect((await listEntries({ phone: "03009998888" }, NOW)).entries).toHaveLength(0);
  });
});

describe("accounts", () => {
  it("disabling stops submissions and logs the user out everywhere", async () => {
    const s = await signup("03250062540", "4827", { ipHash: "ip", userAgentShort: "" });
    if (!s.ok) throw new Error(s.error);
    const id = s.user._id.toString();

    await setUserDisabled(id, true, "abuse");
    expect(await readSession(s.token)).toBeNull();
    const refused = await addDurood({
      userId: id,
      deviceId: randomUUID(),
      clientId: randomUUID(),
      count: 5,
      mode: "tap",
      ipHash: "ip",
      userAgentShort: "",
      now: NOW,
    });
    expect(refused).toEqual({ ok: false, error: "blocked" });
    expect((await listUsers({ disabledOnly: true }, NOW)).users).toMatchObject([{ id, disabledReason: "abuse" }]);

    await setUserDisabled(id, false);
    await add(id, 5);
    expect(await getTotals(NOW)).toMatchObject({ total: 5 });
  });

  it("an admin PIN reset unlocks the account and logs it out", async () => {
    const s = await signup("03250062540", "4827", { ipHash: "ip", userAgentShort: "" });
    if (!s.ok) throw new Error(s.error);
    const id = s.user._id.toString();
    for (let i = 0; i < 5; i++) await login("03250062540", "0001", { ipHash: `ip${i}`, userAgentShort: "" });

    expect(await resetUserPin(id, "12")).toEqual({ ok: false, error: "invalid_pin" });
    expect(await resetUserPin(id, "5163")).toEqual({ ok: true });
    expect(await readSession(s.token)).toBeNull();
    expect(await login("03250062540", "5163", { ipHash: "ip9", userAgentShort: "" })).toMatchObject({ ok: true });
  });

  it("finds users by phone in any format or by name", async () => {
    await createTestUser({ phone: "+923004445555", name: "Bilal Ahmed" });
    await createTestUser({ phone: "+923006667777", name: "Usman" });
    expect((await listUsers({ q: "0300-4445555" }, NOW)).users.map((u) => u.name)).toEqual(["Bilal Ahmed"]);
    expect((await listUsers({ q: "bilal" }, NOW)).users).toHaveLength(1);
    expect((await listUsers({ q: "7777" }, NOW)).users.map((u) => u.name)).toEqual(["Usman"]);
  });
});

describe("recalculateTotals", () => {
  it("rebuilds counters from non-removed entries", async () => {
    const u = await createTestUser();
    await add(u, 40, at("2026-09-29T07:00:00Z"));
    await add(u, 60, NOW);
    await add(u, 7, NOW);
    await removeEntry(await entryIdFor(u, 7), "test", NOW);

    // Simulate drift: a counter edited by hand and a stray document.
    await Counter.updateOne({ _id: "global" }, { $set: { count: 999 } });
    await Counter.create({ _id: "day:2026-01-01", count: 5 });

    const result = await recalculateTotals();
    expect(result).toMatchObject({ total: 100, corrected: 2 });
    expect(await getTotals(NOW)).toMatchObject({ total: 100, today: 60, month: 60 });
    expect(await Counter.findById("month:2026-09").lean()).toMatchObject({ count: 40 });
    expect(await Counter.findById("day:2026-01-01").lean()).toBeNull();
  });
});

describe("getDashboard", () => {
  it("summarises today, users and majalis without exposing IP data", async () => {
    const m = await Majlis.create({ name: "مجلس کراچی" });
    const mid = m._id.toString();
    const a = await createTestUser({ majlisId: mid });
    const b = await createTestUser();
    await add(a, 30, at("2026-10-10T04:10:00Z"), mid); // 09:10 Karachi
    await add(a, 12, at("2026-10-10T07:30:00Z"), mid); // 12:30
    await add(b, 5000, at("2026-10-10T07:45:00Z")); // 12:45, no majlis

    const d = await getDashboard(at("2026-10-10T08:00:00Z"));
    expect(d.totals).toMatchObject({ today: 5042 });
    expect(d.activeUsersToday).toBe(2);
    expect(d.entriesToday).toBe(3);
    expect(d.users).toBe(2);
    expect(d.perHour[9]).toBe(30);
    expect(d.perHour[12]).toBe(5012);
    expect(d.currentHour).toBe(13);
    expect(d.last30).toHaveLength(30);
    expect(d.topEntries[0]).toMatchObject({ count: 5000 });
    expect(d.majlisThisMonth).toEqual([
      { id: null, name: null, count: 5000, users: 1 },
      { id: mid, name: "مجلس کراچی", count: 42, users: 1 },
    ]);
    expect(JSON.stringify(d)).not.toContain("ipHash");
  });
});

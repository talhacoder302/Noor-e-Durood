import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { Entry } from "@/models/entry";
import { Majlis } from "@/models/majlis";
import { RateLimit } from "@/models/rate-limit";
import { Session } from "@/models/session";
import { User } from "@/models/user";
import { setupMemoryMongo } from "@/test/mongo";
import { changePin, getSessionUser, login, signup, updateProfile } from "./accounts";
import { ready } from "./ready";
import { deleteAllSessions, deleteSession } from "./session";

setupMemoryMongo("noor_e_durood_accounts_test");

const NOW = new Date("2026-10-10T07:00:00Z");
const meta = (extra: Partial<{ ipHash: string; deviceId: string; now: Date }> = {}) => ({
  ipHash: randomUUID(),
  userAgentShort: "vitest",
  now: NOW,
  ...extra,
});
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

beforeEach(async () => {
  await ready();
  await Promise.all([
    User.deleteMany({}),
    Session.deleteMany({}),
    Entry.deleteMany({}),
    RateLimit.deleteMany({}),
    Majlis.deleteMany({}),
  ]);
});

describe("signup", () => {
  it("creates an account with phone + PIN and logs in", async () => {
    const r = await signup("0300-1234567", "4827", meta());
    if (!r.ok) throw new Error(r.error);
    expect(r.user.phone).toBe("+923001234567");
    expect(r.user.pinHash).not.toBe("4827");
    expect((await getSessionUser(r.token))?.phone).toBe("+923001234567");
  });

  it("treats the same number written differently as taken", async () => {
    await signup("03250062540", "4827", meta());
    expect(await signup("+92 300 1234567", "7391", meta())).toEqual({ ok: false, error: "phone_taken" });
  });

  it("rejects bad numbers and weak or malformed PINs", async () => {
    expect(await signup("12345", "4827", meta())).toEqual({ ok: false, error: "invalid_phone" });
    expect(await signup("03250062540", "482", meta())).toEqual({ ok: false, error: "invalid_pin" });
    expect(await signup("03250062540", "1234", meta())).toEqual({ ok: false, error: "weak_pin" });
    expect(await User.countDocuments()).toBe(0);
  });

  it("lets a whole majlis sign up from one Wi-Fi, but not unlimited accounts", async () => {
    const ipHash = "same-ip";
    // Typos and weak PINs don't use up the allowance.
    for (let i = 0; i < 10; i++) await signup("123", "4827", meta({ ipHash }));
    for (let i = 0; i < 10; i++) await signup("03250062540", "1111", meta({ ipHash }));

    const results = [];
    for (let i = 0; i < 31; i++) {
      results.push(await signup(`03001${String(i).padStart(6, "0")}`, "4827", meta({ ipHash })));
    }
    expect(results.slice(0, 30).every((r) => r.ok)).toBe(true);
    expect(results[30]).toEqual({ ok: false, error: "rate_limited" });
    // Another connection is unaffected.
    expect(await signup("03009999999", "4827", meta({ ipHash: "other-ip" }))).toMatchObject({ ok: true });
  });
});

describe("login", () => {
  beforeEach(async () => {
    await signup("03250062540", "4827", meta());
  });

  it("works with the right PIN in any phone format", async () => {
    expect(await login("+923001234567", "4827", meta())).toMatchObject({ ok: true });
    expect(await login("۰۳۰۰۱۲۳۴۵۶۷", "۴۸۲۷", meta())).toMatchObject({ ok: true });
  });

  it("gives the same answer for a wrong PIN and an unknown number", async () => {
    expect(await login("03250062540", "1111", meta())).toEqual({ ok: false, error: "wrong" });
    expect(await login("03009999999", "4827", meta())).toEqual({ ok: false, error: "wrong" });
  });

  it("locks after 5 wrong PINs, even for the right one, then unlocks", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await login("03250062540", "0001", meta()));
    expect(results.slice(0, 4).every((r) => !r.ok && r.error === "wrong")).toBe(true);
    expect(results[4]).toEqual({ ok: false, error: "locked", retryAfterMinutes: 15 });

    expect(await login("03250062540", "4827", meta({ now: minutes(5) }))).toMatchObject({
      ok: false,
      error: "locked",
      retryAfterMinutes: 10,
    });
    expect(await login("03250062540", "4827", meta({ now: minutes(16) }))).toMatchObject({ ok: true });
    expect(await User.findOne().lean()).toMatchObject({ failedPins: 0 });
  });

  it("locks for longer after more wrong PINs", async () => {
    let now = NOW;
    let last;
    for (let i = 0; i < 10; i++) {
      last = await login("03250062540", "0001", meta({ now }));
      if (!last.ok && last.error === "locked") now = new Date(now.getTime() + (last.retryAfterMinutes ?? 0) * 60_000 + 1000);
    }
    expect(last).toEqual({ ok: false, error: "locked", retryAfterMinutes: 60 });
  });

  it("never counts successful logins against the IP", async () => {
    const ipHash = "shared-wifi";
    for (let i = 0; i < 40; i++) {
      expect(await login("03250062540", "4827", meta({ ipHash }))).toMatchObject({ ok: true });
    }
  });

  it("limits wrong PINs from one IP across many numbers", async () => {
    const ipHash = "guesser";
    for (let i = 0; i < 30; i++) {
      expect(await login(`0300${String(i).padStart(7, "0")}`, "4827", meta({ ipHash }))).toEqual({ ok: false, error: "wrong" });
    }
    expect(await login("03250062540", "4827", meta({ ipHash }))).toEqual({ ok: false, error: "rate_limited" });
    expect(await login("03250062540", "4827", meta({ ipHash: "someone-else" }))).toMatchObject({ ok: true });
  });

  it("refuses a disabled account", async () => {
    await User.updateOne({}, { $set: { disabled: true } });
    expect(await login("03250062540", "4827", meta())).toEqual({ ok: false, error: "disabled" });
  });

  it("moves the phone's earlier durood into the account", async () => {
    const deviceId = randomUUID();
    await Entry.create([
      { clientId: randomUUID(), deviceId, count: 30, mode: "tap", day: "2026-10-09", ipHash: "x" },
      { clientId: randomUUID(), deviceId, count: 12, mode: "number", day: "2026-10-10", ipHash: "x" },
      // Someone else's entry from the same phone stays theirs.
      { clientId: randomUUID(), deviceId, count: 99, mode: "tap", day: "2026-10-10", ipHash: "x", userId: "other" },
    ]);
    const r = await login("03250062540", "4827", meta({ deviceId }));
    if (!r.ok) throw new Error(r.error);
    expect(r.user.totalCount).toBe(42);
    expect(await Entry.countDocuments({ userId: r.user._id.toString() })).toBe(2);
    expect(await Entry.countDocuments({ userId: "other" })).toBe(1);
  });
});

describe("sessions", () => {
  it("logs out one phone or all phones", async () => {
    const a = await signup("03250062540", "4827", meta());
    if (!a.ok) throw new Error(a.error);
    const b = await login("03250062540", "4827", meta());
    if (!b.ok) throw new Error(b.error);

    await deleteSession(a.token);
    expect(await getSessionUser(a.token)).toBeNull();
    expect(await getSessionUser(b.token)).not.toBeNull();

    await deleteAllSessions(a.user._id.toString());
    expect(await getSessionUser(b.token)).toBeNull();
  });

  it("ignores made-up tokens", async () => {
    expect(await getSessionUser("not-a-token")).toBeNull();
    expect(await getSessionUser(undefined)).toBeNull();
  });
});

describe("PIN and profile", () => {
  it("changes the PIN only with the old one", async () => {
    const r = await signup("03250062540", "4827", meta());
    if (!r.ok) throw new Error(r.error);
    const id = r.user._id.toString();

    expect(await changePin(id, "0000", "7391")).toEqual({ ok: false, error: "wrong" });
    expect(await changePin(id, "4827", "1111")).toEqual({ ok: false, error: "weak_pin" });
    expect(await changePin(id, "4827", "7391")).toEqual({ ok: true });
    expect(await login("03250062540", "7391", meta())).toMatchObject({ ok: true });
  });

  it("saves the optional profile, including 'other' majlis", async () => {
    const r = await signup("03250062540", "4827", meta());
    if (!r.ok) throw new Error(r.error);
    const id = r.user._id.toString();
    const m = await Majlis.create({ name: "مجلس لاہور", order: 1 });

    const saved = await updateProfile(id, { name: "Ali", majlis: m._id.toString(), majlisOther: "", age: 30, city: "Lahore" }, NOW);
    expect(saved).toMatchObject({ ok: true, user: { name: "Ali", majlisId: m._id.toString(), birthYear: 1996, city: "Lahore" } });

    const other = await updateProfile(id, { name: "", majlis: "other", majlisOther: "My majlis", age: "", city: "" }, NOW);
    if (!other.ok) throw new Error("expected ok");
    expect(other.user).toMatchObject({ majlisOther: "My majlis" });
    expect(other.user.majlisId).toBeUndefined();
    expect(other.user.name).toBeUndefined();
    expect(other.user.birthYear).toBeUndefined();
  });

  it("refuses an unknown or inactive majlis", async () => {
    const r = await signup("03250062540", "4827", meta());
    if (!r.ok) throw new Error(r.error);
    const inactive = await Majlis.create({ name: "پرانی", active: false });
    expect(
      await updateProfile(r.user._id.toString(), { name: "", majlis: inactive._id.toString(), majlisOther: "", age: "", city: "" }),
    ).toEqual({ ok: false, error: "invalid_majlis" });
  });
});

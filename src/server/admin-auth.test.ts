import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { Session } from "@/models/session";
import { User } from "@/models/user";
import { setupMemoryMongo } from "@/test/mongo";
import {
  adminAccessFor,
  attemptAdminLogin,
  BCRYPT_HASH,
  checkAdminPassword,
  createSessionToken,
  verifySessionToken,
} from "./admin-auth";
import { signup } from "./accounts";
import { ready } from "./ready";

setupMemoryMongo("noor_e_durood_admin_auth_test");

describe("admin sessions", () => {
  const now = Date.UTC(2026, 9, 10, 7);

  it("accepts its own token until it expires", () => {
    const { token, expires } = createSessionToken(now);
    expect(verifySessionToken(token, now + 1000)).toBe(true);
    expect(verifySessionToken(token, expires.getTime() - 1)).toBe(true);
    expect(verifySessionToken(token, expires.getTime())).toBe(false);
  });

  it("rejects tampered or malformed tokens", () => {
    const { token } = createSessionToken(now);
    const [v, exp, mac] = token.split(".");
    // Pushing the expiry further out breaks the signature.
    expect(verifySessionToken(`${v}.${Number(exp) + 86_400_000}.${mac}`, now)).toBe(false);
    expect(verifySessionToken(`${v}.${exp}.${mac.slice(0, -2)}xx`, now)).toBe(false);
    expect(verifySessionToken(undefined, now)).toBe(false);
    expect(verifySessionToken("", now)).toBe(false);
    expect(verifySessionToken("v1.123", now)).toBe(false);
    expect(verifySessionToken(`${token}.extra`, now)).toBe(false);
  });
});

describe("admin password", () => {
  it("compares with bcrypt", async () => {
    expect(await checkAdminPassword("test-password")).toBe(true);
    expect(await checkAdminPassword("test-passwor")).toBe(false);
    expect(await checkAdminPassword("")).toBe(false);
    expect(await checkAdminPassword("x".repeat(500))).toBe(false);
  });

  it("recognises a bcrypt hash in ADMIN_PASSWORD", async () => {
    expect(BCRYPT_HASH.test(await bcrypt.hash("anything", 4))).toBe(true);
    expect(BCRYPT_HASH.test("plain-password-123")).toBe(false);
  });

  it("rate limits login attempts per IP", async () => {
    const now = new Date("2026-10-10T07:00:00Z");
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await attemptAdminLogin("wrong", "ip-a", now));
    expect(results.every((r) => !r.ok && r.error === "wrong")).toBe(true);
    // Even the right password is refused once the limit is hit.
    expect(await attemptAdminLogin("test-password", "ip-a", now)).toEqual({
      ok: false,
      error: "rate_limited",
    });
    // Another IP is unaffected.
    expect(await attemptAdminLogin("test-password", "ip-b", now)).toMatchObject({ ok: true });
  });
});

describe("admin access", () => {
  // Real accounts and sessions, so this also covers disabled users and logouts.
  async function account(phone: string, extra: Record<string, unknown> = {}) {
    const r = await signup(phone, "4827", { ipHash: randomUUID(), userAgentShort: "vitest" });
    if (!r.ok) throw new Error(r.error);
    if (Object.keys(extra).length) await User.updateOne({ _id: r.user._id }, { $set: extra });
    return { id: r.user._id.toString(), token: r.token };
  }
  const password = () => createSessionToken().token;

  beforeEach(async () => {
    await ready();
    await Promise.all([User.deleteMany({}), Session.deleteMany({})]);
  });

  it("lets the password alone in until the first admin account exists", async () => {
    expect(await adminAccessFor(undefined, password())).toEqual({ ok: true, setup: true });
    expect(await adminAccessFor(undefined, undefined)).toEqual({ ok: false, need: "password" });
  });

  it("then needs an admin account login and the password", async () => {
    const admin = await account("03001111111", { isAdmin: true });
    const member = await account("03002222222");

    expect(await adminAccessFor(undefined, password())).toMatchObject({ ok: false, need: "account", user: null });
    expect(await adminAccessFor(member.token, password())).toMatchObject({ ok: false, need: "account" });
    expect(await adminAccessFor(admin.token, undefined)).toEqual({ ok: false, need: "password" });
    expect(await adminAccessFor(admin.token, password())).toEqual({ ok: true, setup: false });
  });

  it("goes back to setup when the only admin is disabled", async () => {
    const admin = await account("03001111111", { isAdmin: true });
    await User.updateOne({ _id: admin.id }, { $set: { disabled: true } });
    expect(await adminAccessFor(undefined, password())).toEqual({ ok: true, setup: true });
  });
});

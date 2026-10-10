import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { setupMemoryMongo } from "@/test/mongo";
import {
  attemptAdminLogin,
  BCRYPT_HASH,
  checkAdminPassword,
  createSessionToken,
  verifySessionToken,
} from "./admin-auth";

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

import "server-only";
import bcrypt from "bcryptjs";
import { karachiDay } from "@/lib/date";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { isValidPinFormat, isWeakPin, normalizePin } from "@/lib/pin";
import type { PublicUser } from "@/lib/types";
import type { ProfileInput } from "@/lib/validation";
import { Entry } from "@/models/entry";
import { User, type UserDoc } from "@/models/user";
import { isActiveMajlis, majlisName } from "./majalis";
import { hitRateLimit } from "./rate-limit";
import { ready } from "./ready";
import { createSession, readSession } from "./session";

const BCRYPT_COST = 10;
const LOGIN_LIMIT = { max: 20, windowMs: 15 * 60_000 }; // per IP
const SIGNUP_LIMIT = { max: 5, windowMs: 60 * 60_000 }; // per IP

// A 4-digit PIN has 10,000 values, so wrong tries lock the account for longer
// and longer: 5 → 15 min, 10 → 1 hour, 15+ → 24 hours. A right PIN resets it.
function lockFor(failedPins: number): number {
  if (failedPins >= 15) return 24 * 60;
  if (failedPins >= 10) return 60;
  if (failedPins >= 5) return 15;
  return 0;
}

// Compared against when the phone isn't registered, so a missing account
// takes as long to reject as a wrong PIN.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-pin", BCRYPT_COST);

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}

export function toPublicUser(u: UserDoc, majlisName?: string, now: Date = new Date()): PublicUser {
  return {
    id: u._id.toString(),
    phoneMasked: maskPhone(u.phone),
    name: u.name ?? "",
    majlisId: u.majlisId ?? null,
    majlisName: majlisName ?? null,
    majlisOther: u.majlisOther ?? "",
    age: u.birthYear ? now.getFullYear() - u.birthYear : null,
    city: u.city ?? "",
  };
}

export async function getUserById(userId: string): Promise<UserDoc | null> {
  await ready();
  if (!/^[0-9a-f]{24}$/.test(userId)) return null;
  return User.findById(userId).lean<UserDoc>();
}

/** The logged-in user for a session cookie, or null (also for disabled accounts). */
export async function getSessionUser(token: string | undefined): Promise<UserDoc | null> {
  const userId = await readSession(token);
  if (!userId) return null;
  const user = await getUserById(userId);
  return user && !user.disabled ? user : null;
}

/**
 * Moves the durood this phone sent before it had an account into the account.
 * Only entries that don't belong to anyone yet.
 */
export async function claimDeviceHistory(userId: string, deviceId: string | undefined) {
  if (!deviceId) return 0;
  await ready();
  const [sum] = await Entry.aggregate<{ count: number }>([
    { $match: { deviceId, userId: { $exists: false }, removed: { $ne: true } } },
    { $group: { _id: null, count: { $sum: "$count" } } },
  ]);
  await Entry.updateMany({ deviceId, userId: { $exists: false } }, { $set: { userId } });
  if (sum?.count) await User.updateOne({ _id: userId }, { $inc: { totalCount: sum.count } });
  return sum?.count ?? 0;
}

type Meta = { ipHash: string; userAgentShort: string; deviceId?: string; now?: Date };

export type AuthResult =
  | { ok: true; user: UserDoc; token: string; expires: Date }
  | {
      ok: false;
      error: "invalid_phone" | "invalid_pin" | "weak_pin" | "phone_taken" | "wrong" | "locked" | "disabled" | "rate_limited";
      retryAfterMinutes?: number;
    };

export async function signup(rawPhone: string, rawPin: string, meta: Meta): Promise<AuthResult> {
  const now = meta.now ?? new Date();
  const phone = normalizePhone(rawPhone);
  const pin = normalizePin(rawPin);
  if (!phone) return { ok: false, error: "invalid_phone" };
  if (!isValidPinFormat(pin)) return { ok: false, error: "invalid_pin" };
  if (isWeakPin(pin)) return { ok: false, error: "weak_pin" };

  await ready();
  if (!(await hitRateLimit(`signup:${meta.ipHash}`, SIGNUP_LIMIT.max, now, SIGNUP_LIMIT.windowMs))) {
    return { ok: false, error: "rate_limited" };
  }

  let user: UserDoc;
  try {
    const created = await User.create({
      phone,
      pinHash: await bcrypt.hash(pin, BCRYPT_COST),
      day: karachiDay(now),
      createdAt: now,
      lastLoginAt: now,
    });
    user = created.toObject() as UserDoc;
  } catch (error) {
    if (isDuplicateKey(error)) return { ok: false, error: "phone_taken" };
    throw error;
  }

  const userId = user._id.toString();
  const claimed = await claimDeviceHistory(userId, meta.deviceId);
  if (claimed) user = { ...user, totalCount: user.totalCount + claimed };
  return { ok: true, user, ...(await createSession(userId, meta.userAgentShort, now)) };
}

export async function login(rawPhone: string, rawPin: string, meta: Meta): Promise<AuthResult> {
  const now = meta.now ?? new Date();
  const phone = normalizePhone(rawPhone);
  const pin = normalizePin(rawPin);

  await ready();
  if (!(await hitRateLimit(`login:${meta.ipHash}`, LOGIN_LIMIT.max, now, LOGIN_LIMIT.windowMs))) {
    return { ok: false, error: "rate_limited" };
  }

  const user = phone ? await User.findOne({ phone }).lean<UserDoc>() : null;
  if (user?.lockedUntil && user.lockedUntil > now) {
    return {
      ok: false,
      error: "locked",
      retryAfterMinutes: Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 60_000),
    };
  }

  const pinOk = await bcrypt.compare(isValidPinFormat(pin) ? pin : "x", user?.pinHash ?? DUMMY_HASH);
  if (!user || !pinOk) {
    if (user) {
      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { failedPins: 1 } },
        { returnDocument: "after" },
      ).lean<UserDoc>();
      const minutes = lockFor(updated?.failedPins ?? 0);
      if (minutes && updated && (updated.failedPins % 5 === 0 || updated.failedPins >= 15)) {
        await User.updateOne(
          { _id: user._id },
          { $set: { lockedUntil: new Date(now.getTime() + minutes * 60_000) } },
        );
        return { ok: false, error: "locked", retryAfterMinutes: minutes };
      }
    }
    return { ok: false, error: "wrong" };
  }
  if (user.disabled) return { ok: false, error: "disabled" };

  const userId = user._id.toString();
  await User.updateOne(
    { _id: user._id },
    { $set: { failedPins: 0, lastLoginAt: now }, $unset: { lockedUntil: "" } },
  );
  const claimed = await claimDeviceHistory(userId, meta.deviceId);
  const fresh = { ...user, totalCount: user.totalCount + claimed };
  return { ok: true, user: fresh, ...(await createSession(userId, meta.userAgentShort, now)) };
}

export type ChangePinResult = { ok: true } | { ok: false; error: "wrong" | "invalid_pin" | "weak_pin" };

export async function changePin(userId: string, oldPin: string, newPin: string): Promise<ChangePinResult> {
  const next = normalizePin(newPin);
  if (!isValidPinFormat(next)) return { ok: false, error: "invalid_pin" };
  if (isWeakPin(next)) return { ok: false, error: "weak_pin" };

  const user = await getUserById(userId);
  if (!user || !(await bcrypt.compare(normalizePin(oldPin), user.pinHash))) {
    return { ok: false, error: "wrong" };
  }
  await User.updateOne({ _id: user._id }, { $set: { pinHash: await bcrypt.hash(next, BCRYPT_COST) } });
  return { ok: true };
}

/** PublicUser with the majlis name filled in. */
export async function publicUser(user: UserDoc): Promise<PublicUser> {
  return toPublicUser(user, (await majlisName(user.majlisId)) ?? undefined);
}

export type ProfileResult = { ok: true; user: UserDoc } | { ok: false; error: "invalid_majlis" };

/** Saves the optional profile. Empty values clear the field. */
export async function updateProfile(userId: string, input: ProfileInput, now: Date = new Date()): Promise<ProfileResult> {
  await ready();
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  const put = (key: string, value: unknown) => {
    if (value === "" || value === undefined || value === null) unset[key] = "";
    else set[key] = value;
  };

  put("name", input.name);
  put("city", input.city);
  put("birthYear", input.age === "" ? "" : now.getFullYear() - input.age);

  if (input.majlis === "other") {
    unset.majlisId = "";
    put("majlisOther", input.majlisOther);
  } else if (input.majlis === "") {
    unset.majlisId = "";
    unset.majlisOther = "";
  } else {
    if (!(await isActiveMajlis(input.majlis))) return { ok: false, error: "invalid_majlis" };
    set.majlisId = input.majlis;
    unset.majlisOther = "";
  }

  const user = await User.findOneAndUpdate(
    { _id: userId },
    { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { returnDocument: "after" },
  ).lean<UserDoc>();
  if (!user) throw new Error("User not found");
  return { ok: true, user };
}

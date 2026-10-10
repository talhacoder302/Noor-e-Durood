import "server-only";
import { createHash, randomInt } from "node:crypto";
import { karachiDay } from "@/lib/date";
import { getEnv } from "@/lib/env";
import {
  isRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_ALPHABET,
  RECOVERY_LENGTH,
} from "@/lib/recovery-code";
import { DeviceStat, type DeviceStatDoc } from "@/models/device-stat";
import { Entry } from "@/models/entry";
import { hitRateLimit } from "./rate-limit";
import { ready } from "./ready";

// Generous for real people, far too slow for guessing 31^8 codes.
const CREATE_LIMIT = { max: 5, windowMs: 60 * 60_000 };
const RESTORE_LIMIT = { max: 10, windowMs: 10 * 60_000 };

function hashCode(code: string): string {
  const { IP_HASH_SALT } = getEnv();
  return createHash("sha256").update(`${IP_HASH_SALT}:recovery:${code}`).digest("hex");
}

function newCode(): string {
  return Array.from(
    { length: RECOVERY_LENGTH },
    () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)],
  ).join("");
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === 11000;
}

export type CreateCodeResult = { ok: true; code: string } | { ok: false; error: "rate_limited" };

/**
 * Gives the device a new recovery code (replacing any old one). The plain
 * code is returned once; only its hash is stored.
 */
export async function createRecoveryCode(
  deviceId: string,
  now: Date = new Date(),
): Promise<CreateCodeResult> {
  await ready();
  if (!(await hitRateLimit(`rc-create:${deviceId}`, CREATE_LIMIT.max, now, CREATE_LIMIT.windowMs))) {
    return { ok: false, error: "rate_limited" };
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    try {
      await DeviceStat.updateOne(
        { deviceId },
        {
          $set: { recoveryHash: hashCode(code) },
          $setOnInsert: { totalCount: 0, day: karachiDay(now), dayCount: 0, lastEntryAt: now },
        },
        { upsert: true },
      );
      return { ok: true, code };
    } catch (error) {
      // Same code already taken by another device (astronomically rare).
      if (!isDuplicateKey(error)) throw error;
    }
  }
  throw new Error("Could not create a unique recovery code");
}

export type RestoreResult =
  | { ok: true; deviceId: string; merged: number }
  | { ok: false; error: "invalid" | "not_found" | "rate_limited" };

/**
 * Links this device to the device that owns `rawCode`: everything this
 * device counted so far moves over, and from now on it uses that device id.
 */
export async function restoreFromCode(
  rawCode: string,
  currentDeviceId: string,
  ipHash: string,
  now: Date = new Date(),
): Promise<RestoreResult> {
  const code = normalizeRecoveryCode(rawCode);
  if (!isRecoveryCode(code)) return { ok: false, error: "invalid" };

  await ready();
  if (!(await hitRateLimit(`rc-restore:${ipHash}`, RESTORE_LIMIT.max, now, RESTORE_LIMIT.windowMs))) {
    return { ok: false, error: "rate_limited" };
  }

  const target = await DeviceStat.findOne({ recoveryHash: hashCode(code) }).lean<DeviceStatDoc>();
  if (!target) return { ok: false, error: "not_found" };
  if (target.deviceId === currentDeviceId) {
    return { ok: true, deviceId: target.deviceId, merged: 0 };
  }

  // Move this device's history to the restored identity.
  await Entry.updateMany({ deviceId: currentDeviceId }, { $set: { deviceId: target.deviceId } });
  const source = await DeviceStat.findOneAndDelete({ deviceId: currentDeviceId }).lean<DeviceStatDoc>();
  if (source && source.totalCount > 0) {
    await DeviceStat.updateOne(
      { deviceId: target.deviceId },
      {
        $inc: {
          totalCount: source.totalCount,
          // Today's allowance is shared once both phones are one identity.
          dayCount: source.day === target.day ? source.dayCount : 0,
        },
      },
    );
  }

  return { ok: true, deviceId: target.deviceId, merged: source?.totalCount ?? 0 };
}

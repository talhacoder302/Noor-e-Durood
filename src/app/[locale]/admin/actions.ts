"use server";

import { refresh, updateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { ABSOLUTE_MAX_PER_ENTRY } from "@/lib/limits";
import {
  recalculateTotals,
  removeEntry,
  resetUserPin,
  setUserDisabled,
  type RecalcResult,
} from "@/server/admin";
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  attemptAdminLogin,
  requireAdmin,
} from "@/server/admin-auth";
import { createMajlis, MAJALIS_TAG, updateMajlis } from "@/server/majalis";
import { LEADERBOARD_TAG } from "@/server/leaderboard";
import { PUBLIC_SETTINGS_TAG } from "@/server/public-settings";
import { getClientIp, hashIp } from "@/server/request-meta";
import { updateSettings } from "@/server/settings";

// Every action re-checks the session: Server Actions are public endpoints.

export type ActionState = { status: "idle" | "ok" | "error"; code?: string; detail?: string };

const reason = z.string().trim().min(3).max(200);
const objectId = z.string().regex(/^[0-9a-f]{24}$/);

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = z.object({ password: z.string().min(1).max(200) }).safeParse({
    password: form.get("password"),
  });
  if (!parsed.success) return { status: "error", code: "wrong" };

  const ipHash = hashIp(getClientIp(await headers()));
  const result = await attemptAdminLogin(parsed.data.password, ipHash);
  if (!result.ok) return { status: "error", code: result.error };

  // Setting a cookie in an action re-renders the page, now signed in.
  (await cookies()).set(ADMIN_COOKIE, result.token, adminCookieOptions(result.expires));
  return { status: "ok" };
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function removeEntryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({ id: objectId, reason })
    .safeParse({ id: form.get("id"), reason: form.get("reason") });
  if (!parsed.success) return { status: "error", code: "invalid" };

  const result = await removeEntry(parsed.data.id, parsed.data.reason);
  if (!result.ok) return { status: "error", code: "already_removed" };
  refresh();
  return { status: "ok", detail: String(result.count) };
}

/** Turns an account off (no logins, no submissions) with a reason. */
export async function disableUserAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({ userId: objectId, reason })
    .safeParse({ userId: form.get("userId"), reason: form.get("reason") });
  if (!parsed.success) return { status: "error", code: "invalid" };

  await setUserDisabled(parsed.data.userId, true, parsed.data.reason);
  refresh();
  return { status: "ok" };
}

export async function enableUserAction(form: FormData): Promise<void> {
  await requireAdmin();
  const parsed = objectId.safeParse(form.get("userId"));
  if (!parsed.success) return;
  await setUserDisabled(parsed.data, false);
  refresh();
}

/** "Forgot my PIN": the admin sets a new 4-digit PIN and tells the user. */
export async function resetPinAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({ userId: objectId, pin: z.string().trim().min(1).max(12) })
    .safeParse({ userId: form.get("userId"), pin: form.get("pin") });
  if (!parsed.success) return { status: "error", code: "invalid" };

  const result = await resetUserPin(parsed.data.userId, parsed.data.pin);
  if (!result.ok) return { status: "error", code: result.error };
  refresh();
  return { status: "ok" };
}

const majlisSchema = z.object({
  name: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().max(80),
  city: z.string().trim().max(60),
  order: z.coerce.number().int().min(0).max(9999),
});

export async function createMajlisAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = majlisSchema.safeParse({
    name: form.get("name"),
    nameEn: form.get("nameEn") ?? "",
    city: form.get("city") ?? "",
    order: form.get("order") || 0,
  });
  if (!parsed.success) return { status: "error", code: "invalid", detail: parsed.error.issues[0]?.path.join(".") };

  await createMajlis(parsed.data);
  updateTag(MAJALIS_TAG);
  refresh();
  return { status: "ok" };
}

export async function updateMajlisAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = majlisSchema.extend({ id: objectId, active: z.boolean() }).safeParse({
    id: form.get("id"),
    name: form.get("name"),
    nameEn: form.get("nameEn") ?? "",
    city: form.get("city") ?? "",
    order: form.get("order") || 0,
    active: form.get("active") === "on",
  });
  if (!parsed.success) return { status: "error", code: "invalid", detail: parsed.error.issues[0]?.path.join(".") };

  const { id, ...patch } = parsed.data;
  await updateMajlis(id, patch);
  updateTag(MAJALIS_TAG);
  refresh();
  return { status: "ok" };
}

const settingsSchema = z.object({
  maxPerEntry: z.coerce.number().int().min(1).max(ABSOLUTE_MAX_PER_ENTRY),
  maxPerDevicePerDay: z.coerce.number().int().min(1).max(100_000_000),
  announcement: z.string().trim().max(500),
  fridayMessageUr: z.string().trim().max(800),
  fridayMessageEn: z.string().trim().max(800),
  paused: z.boolean(),
  leaderboardShowNames: z.boolean(),
});

export async function saveSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse({
    maxPerEntry: form.get("maxPerEntry"),
    maxPerDevicePerDay: form.get("maxPerDevicePerDay"),
    announcement: form.get("announcement") ?? "",
    fridayMessageUr: form.get("fridayMessageUr") ?? "",
    fridayMessageEn: form.get("fridayMessageEn") ?? "",
    paused: form.get("paused") === "on",
    leaderboardShowNames: form.get("leaderboardShowNames") === "on",
  });
  if (!parsed.success) {
    return { status: "error", code: "invalid", detail: parsed.error.issues[0]?.path.join(".") };
  }
  if (parsed.data.maxPerEntry > parsed.data.maxPerDevicePerDay) {
    return { status: "error", code: "invalid", detail: "maxPerEntry" };
  }

  await updateSettings(parsed.data);
  updateTag(PUBLIC_SETTINGS_TAG);
  updateTag(LEADERBOARD_TAG);
  refresh();
  return { status: "ok" };
}

export async function recalculateAction(): Promise<RecalcResult> {
  await requireAdmin();
  const result = await recalculateTotals();
  refresh();
  return result;
}

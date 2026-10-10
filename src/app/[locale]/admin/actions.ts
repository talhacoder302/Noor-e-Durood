"use server";

import { refresh, updateTag } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { ABSOLUTE_MAX_PER_ENTRY } from "@/lib/limits";
import {
  blockDevice,
  recalculateTotals,
  removeEntry,
  unblockDevice,
  type RecalcResult,
} from "@/server/admin";
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  attemptAdminLogin,
  requireAdmin,
} from "@/server/admin-auth";
import { PUBLIC_SETTINGS_TAG } from "@/server/public-settings";
import { getClientIp, hashIp } from "@/server/request-meta";
import { updateSettings } from "@/server/settings";

// Every action re-checks the session: Server Actions are public endpoints.

export type ActionState = { status: "idle" | "ok" | "error"; code?: string; detail?: string };

const reason = z.string().trim().min(3).max(200);

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
    .object({ id: z.string().regex(/^[0-9a-f]{24}$/), reason })
    .safeParse({ id: form.get("id"), reason: form.get("reason") });
  if (!parsed.success) return { status: "error", code: "invalid" };

  const result = await removeEntry(parsed.data.id, parsed.data.reason);
  if (!result.ok) return { status: "error", code: "already_removed" };
  refresh();
  return { status: "ok", detail: String(result.count) };
}

export async function blockDeviceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({ deviceId: z.uuid(), reason })
    .safeParse({ deviceId: form.get("deviceId"), reason: form.get("reason") });
  if (!parsed.success) return { status: "error", code: "invalid" };

  await blockDevice(parsed.data.deviceId, parsed.data.reason);
  refresh();
  return { status: "ok" };
}

export async function unblockDeviceAction(form: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.uuid().safeParse(form.get("deviceId"));
  if (!parsed.success) return;
  await unblockDevice(parsed.data);
  refresh();
}

const settingsSchema = z.object({
  maxPerEntry: z.coerce.number().int().min(1).max(ABSOLUTE_MAX_PER_ENTRY),
  maxPerDevicePerDay: z.coerce.number().int().min(1).max(100_000_000),
  announcement: z.string().trim().max(500),
  fridayMessageUr: z.string().trim().max(800),
  fridayMessageEn: z.string().trim().max(800),
  paused: z.boolean(),
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
  });
  if (!parsed.success) {
    return { status: "error", code: "invalid", detail: parsed.error.issues[0]?.path.join(".") };
  }
  if (parsed.data.maxPerEntry > parsed.data.maxPerDevicePerDay) {
    return { status: "error", code: "invalid", detail: "maxPerEntry" };
  }

  await updateSettings(parsed.data);
  updateTag(PUBLIC_SETTINGS_TAG);
  refresh();
  return { status: "ok" };
}

export async function recalculateAction(): Promise<RecalcResult> {
  await requireAdmin();
  const result = await recalculateTotals();
  refresh();
  return result;
}

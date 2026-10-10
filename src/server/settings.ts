import "server-only";
import { DEFAULT_FRIDAY_MESSAGE } from "@/lib/friday";
import { Settings, SETTINGS_ID, type SettingsDoc } from "@/models/settings";
import { ready } from "./ready";

export type AppSettings = Omit<SettingsDoc, "_id">;

const CACHE_MS = 30_000;
let cached: { value: AppSettings; at: number } | null = null;

function toSettings(doc: SettingsDoc): AppSettings {
  return {
    maxPerEntry: doc.maxPerEntry,
    maxPerDevicePerDay: doc.maxPerDevicePerDay,
    announcement: doc.announcement ?? "",
    paused: doc.paused,
    // Older documents may not have these fields yet.
    fridayMessageUr: doc.fridayMessageUr || DEFAULT_FRIDAY_MESSAGE.ur,
    fridayMessageEn: doc.fridayMessageEn || DEFAULT_FRIDAY_MESSAGE.en,
  };
}

/** The settings singleton, created with defaults if missing. Cached briefly. */
export async function getSettings(): Promise<AppSettings> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  await ready();
  const doc = await Settings.findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $setOnInsert: { _id: SETTINGS_ID } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean<SettingsDoc>();

  const value = toSettings(doc);
  cached = { value, at: Date.now() };
  return value;
}

export async function updateSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  await ready();
  const doc = await Settings.findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $set: patch },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean<SettingsDoc>();

  const value = toSettings(doc);
  cached = { value, at: Date.now() };
  return value;
}

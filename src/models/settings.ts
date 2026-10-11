import { model, models, Schema, type Model } from "mongoose";
import {
  DEFAULT_MAX_PER_DEVICE_PER_DAY,
  DEFAULT_MAX_PER_ENTRY,
} from "@/lib/limits";

export const SETTINGS_ID = "settings";

export type SettingsDoc = {
  _id: string;
  maxPerEntry: number;
  maxPerDevicePerDay: number;
  announcement: string;
  paused: boolean;
  /** Friday banner text; empty means the built-in default. */
  fridayMessageUr: string;
  fridayMessageEn: string;
  /** Leaderboard shows names and opens profiles; off = anonymous counts only. */
  leaderboardShowNames: boolean;
};

const settingsSchema = new Schema<SettingsDoc>(
  {
    _id: { type: String, required: true },
    maxPerEntry: { type: Number, required: true, default: DEFAULT_MAX_PER_ENTRY },
    maxPerDevicePerDay: {
      type: Number,
      required: true,
      default: DEFAULT_MAX_PER_DEVICE_PER_DAY,
    },
    announcement: { type: String, default: "" },
    paused: { type: Boolean, default: false },
    fridayMessageUr: { type: String, default: "" },
    fridayMessageEn: { type: String, default: "" },
    leaderboardShowNames: { type: Boolean, default: false },
  },
  { collection: "settings", versionKey: false },
);

export const Settings: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc>) ?? model("Settings", settingsSchema);

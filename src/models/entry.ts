import { model, models, Schema, type Model } from "mongoose";
import type { DuroodMode } from "@/lib/types";

export type EntryDoc = {
  /** Client-generated per submission; unique, so retries never double count. */
  clientId: string;
  deviceId: string;
  count: number;
  mode: DuroodMode;
  /** Karachi day (YYYY-MM-DD), for per-day breakdowns. */
  day: string;
  createdAt: Date;
  /** SHA-256 of IP + secret salt. The raw IP is never stored. */
  ipHash: string;
  userAgentShort: string;
  removed: boolean;
  removedReason?: string;
};

const entrySchema = new Schema<EntryDoc>(
  {
    clientId: { type: String, required: true },
    deviceId: { type: String, required: true },
    count: { type: Number, required: true, min: 1 },
    mode: { type: String, required: true, enum: ["tap", "number"] },
    day: { type: String, required: true },
    createdAt: { type: Date, required: true, default: () => new Date() },
    ipHash: { type: String, required: true },
    userAgentShort: { type: String, default: "" },
    removed: { type: Boolean, default: false },
    removedReason: { type: String },
  },
  { collection: "entries", versionKey: false },
);

entrySchema.index({ clientId: 1 }, { unique: true });
entrySchema.index({ deviceId: 1, createdAt: -1 });
entrySchema.index({ createdAt: -1 });

export const Entry: Model<EntryDoc> =
  (models.Entry as Model<EntryDoc>) ?? model("Entry", entrySchema);

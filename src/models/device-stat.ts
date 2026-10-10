import { model, models, Schema, type Model } from "mongoose";

export type DeviceStatDoc = {
  deviceId: string;
  totalCount: number;
  lastEntryAt: Date;
  /** Karachi day that dayCount belongs to; used to enforce the daily limit. */
  day: string;
  dayCount: number;
  /** SHA-256 of the recovery code (salted); the code itself is never stored. */
  recoveryHash?: string;
};

const deviceStatSchema = new Schema<DeviceStatDoc>(
  {
    deviceId: { type: String, required: true },
    totalCount: { type: Number, required: true, default: 0 },
    lastEntryAt: { type: Date, required: true },
    day: { type: String, required: true },
    dayCount: { type: Number, required: true, default: 0 },
    recoveryHash: { type: String },
  },
  { collection: "devicestats", versionKey: false },
);

deviceStatSchema.index({ deviceId: 1 }, { unique: true });
deviceStatSchema.index({ recoveryHash: 1 }, { unique: true, sparse: true });

export const DeviceStat: Model<DeviceStatDoc> =
  (models.DeviceStat as Model<DeviceStatDoc>) ??
  model("DeviceStat", deviceStatSchema);

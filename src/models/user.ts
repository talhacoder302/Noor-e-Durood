import { model, models, Schema, type Model } from "mongoose";

export type UserDoc = {
  _id: { toString(): string };
  /** E.164, e.g. "+923001234567". The login id. */
  phone: string;
  /** bcrypt hash of the 4-digit PIN. */
  pinHash: string;

  // Profile, all optional.
  name?: string;
  majlisId?: string;
  /** Typed in when the user picks "other" instead of a listed majlis. */
  majlisOther?: string;
  birthYear?: number;
  city?: string;

  // Wrong-PIN protection.
  failedPins: number;
  lockedUntil?: Date;

  // Set by an admin.
  disabled: boolean;
  disabledReason?: string;

  // Running totals; the daily part enforces maxPerDevicePerDay per user.
  totalCount: number;
  day: string;
  dayCount: number;
  lastEntryAt?: Date;

  createdAt: Date;
  lastLoginAt?: Date;
};

const userSchema = new Schema<UserDoc>(
  {
    phone: { type: String, required: true },
    pinHash: { type: String, required: true },
    name: { type: String },
    majlisId: { type: String },
    majlisOther: { type: String },
    birthYear: { type: Number },
    city: { type: String },
    failedPins: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    disabled: { type: Boolean, default: false },
    disabledReason: { type: String },
    totalCount: { type: Number, default: 0 },
    day: { type: String, default: "" },
    dayCount: { type: Number, default: 0 },
    lastEntryAt: { type: Date },
    createdAt: { type: Date, default: () => new Date() },
    lastLoginAt: { type: Date },
  },
  { collection: "users", versionKey: false },
);

userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ majlisId: 1 });
userSchema.index({ createdAt: -1 });
// Leaderboard order and rank lookups.
userSchema.index({ totalCount: -1, createdAt: 1 });

export const User: Model<UserDoc> = (models.User as Model<UserDoc>) ?? model("User", userSchema);

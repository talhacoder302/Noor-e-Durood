import { model, models, Schema, type Model } from "mongoose";

// One document per key per minute window; MongoDB deletes them via TTL.
export type RateLimitDoc = {
  _id: string;
  n: number;
  expiresAt: Date;
};

const rateLimitSchema = new Schema<RateLimitDoc>(
  {
    _id: { type: String, required: true },
    n: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: "ratelimits", versionKey: false },
);

rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit: Model<RateLimitDoc> =
  (models.RateLimit as Model<RateLimitDoc>) ??
  model("RateLimit", rateLimitSchema);

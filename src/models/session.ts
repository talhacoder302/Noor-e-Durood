import { model, models, Schema, type Model } from "mongoose";

// One document per logged-in phone/browser. The cookie holds a random token;
// only its SHA-256 is stored here, so a database leak can't be used to log in.
export type SessionDoc = {
  /** SHA-256 (hex) of the cookie token. */
  _id: string;
  userId: string;
  userAgentShort: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
};

const sessionSchema = new Schema<SessionDoc>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    userAgentShort: { type: String, default: "" },
    createdAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: "sessions", versionKey: false },
);

sessionSchema.index({ userId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<SessionDoc> =
  (models.Session as Model<SessionDoc>) ?? model("Session", sessionSchema);

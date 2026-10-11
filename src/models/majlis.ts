import { Schema, type Model } from "mongoose";
import { defineModel } from "./define";

// The list users pick their majlis from. Managed in the admin panel; users
// can also choose "other" and type a name (stored on the user instead).
export type MajlisDoc = {
  _id: { toString(): string };
  name: string;
  nameEn?: string;
  city?: string;
  active: boolean;
  order: number;
  createdAt: Date;
};

const majlisSchema = new Schema<MajlisDoc>(
  {
    name: { type: String, required: true },
    nameEn: { type: String },
    city: { type: String },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { collection: "majalis", versionKey: false },
);

majlisSchema.index({ active: 1, order: 1 });

export const Majlis: Model<MajlisDoc> = defineModel<MajlisDoc>("Majlis", majlisSchema);

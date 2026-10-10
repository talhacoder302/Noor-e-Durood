import { model, models, Schema, type Model } from "mongoose";

// _id is "global", "day:YYYY-MM-DD" or "month:YYYY-MM".
// Only ever changed with atomic $inc (upsert). Never read-modify-write.
export type CounterDoc = {
  _id: string;
  count: number;
};

const counterSchema = new Schema<CounterDoc>(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
  },
  { collection: "counters", versionKey: false },
);

export const Counter: Model<CounterDoc> =
  (models.Counter as Model<CounterDoc>) ?? model("Counter", counterSchema);

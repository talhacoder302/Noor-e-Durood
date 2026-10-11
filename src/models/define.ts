import mongoose, { type Model, type Schema } from "mongoose";

/**
 * Registers a Mongoose model once per process.
 *
 * In development Next reloads changed modules but mongoose keeps its model
 * registry, so `models.X ?? model(...)` would keep the schema from before an
 * edit, and fields it doesn't know are silently dropped on save (that's how a
 * new Settings field never got stored). Outside production the model is
 * rebuilt from the current schema on every module load.
 */
export function defineModel<T>(name: string, schema: Schema<T>): Model<T> {
  if (process.env.NODE_ENV !== "production" && mongoose.models[name]) mongoose.deleteModel(name);
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

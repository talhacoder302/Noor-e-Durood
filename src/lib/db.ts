import "server-only";
import mongoose from "mongoose";
import { getEnv } from "./env";

// Only src/server/* should import this. Route handlers and pages go through
// the services there.

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Survives hot reloads in dev and is shared across requests in production.
const globalForMongoose = globalThis as typeof globalThis & {
  _mongoose?: MongooseCache;
};

const cache: MongooseCache = (globalForMongoose._mongoose ??= {
  conn: null,
  promise: null,
});

mongoose.set("strictQuery", true);

export async function connectDb(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const { MONGODB_URI, MONGODB_DB } = getEnv();
    cache.promise = mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10_000,
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // Let the next request retry instead of reusing a failed promise.
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}

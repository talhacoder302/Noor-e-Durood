import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll } from "vitest";

/**
 * Starts a throwaway MongoDB for this test file. getEnv() is lazy, so
 * setting the env vars before the first service call is enough.
 */
export function setupMemoryMongo(dbName: string) {
  let mongo: MongoMemoryServer | undefined;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    process.env.MONGODB_DB = dbName;
    process.env.IP_HASH_SALT = "test-salt-test-salt";
    process.env.ADMIN_PASSWORD = "test-password";
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });
}

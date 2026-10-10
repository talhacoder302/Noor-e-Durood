// Creates the noor_e_durood database on Atlas: collections plus the global
// counter document. Safe to run more than once.
// Usage: npm run db:init   (reads MONGODB_URI and MONGODB_DB from .env.local)
import mongoose from "mongoose";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall back to variables already set in the shell.
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "noor_e_durood";

if (!uri) {
  console.error("MONGODB_URI is missing. Fill it in .env.local first.");
  process.exit(1);
}

const collections = ["counters", "entries", "devicestats", "settings"];

try {
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db;
  await db.admin().ping();
  console.log(`Connected. Using database "${dbName}".`);

  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name),
  );
  for (const name of collections) {
    if (existing.has(name)) {
      console.log(`  ${name}: already exists`);
    } else {
      await db.createCollection(name);
      console.log(`  ${name}: created`);
    }
  }

  // Seed the global total without ever overwriting an existing count.
  await db
    .collection("counters")
    .updateOne({ _id: "global" }, { $setOnInsert: { count: 0 } }, { upsert: true });
  console.log("  counters/global: ready");
} catch (error) {
  console.error("Could not initialise the database:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

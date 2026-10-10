// Prepares the database: collections, the Settings singleton and the
// global / today / this-month counters at 0.
//
//   npm run db:seed            safe: only creates what is missing
//   npm run db:seed -- --reset wipes counters, entries, device stats and
//                              rate limits, then starts every counter at 0
//
// Reads MONGODB_URI and MONGODB_DB from .env.local.
import mongoose from "mongoose";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall back to variables already set in the shell.
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "noor_e_durood";
const reset = process.argv.includes("--reset");

if (!uri) {
  console.error("MONGODB_URI is missing. Fill it in .env.local first.");
  process.exit(1);
}

// Keep in sync with src/lib/limits.ts and src/lib/date.ts.
const SETTINGS_DEFAULTS = {
  maxPerEntry: 10_000,
  maxPerDevicePerDay: 100_000,
  announcement: "",
  paused: false,
  // Empty means the built-in Friday text (src/lib/friday.ts).
  fridayMessageUr: "",
  fridayMessageEn: "",
};

function karachiDay(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const day = karachiDay();
const counterIds = ["global", `day:${day}`, `month:${day.slice(0, 7)}`];
const collections = ["counters", "entries", "devicestats", "settings", "ratelimits"];

try {
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db;
  console.log(`Connected. Using database "${dbName}".`);

  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name),
  );
  for (const name of collections) {
    if (!existing.has(name)) {
      await db.createCollection(name);
      console.log(`  created collection ${name}`);
    }
  }

  const counters = db.collection("counters");

  if (reset) {
    await Promise.all(
      ["counters", "entries", "devicestats", "ratelimits"].map((name) =>
        db.collection(name).deleteMany({}),
      ),
    );
    console.log("  reset: cleared counters, entries, devicestats, ratelimits");
  } else {
    const global = await counters.findOne({ _id: "global" });
    if (global?.count > 0) {
      console.log(
        `  counters already have data (global = ${global.count}); leaving them.` +
          " Use --reset to start from 0.",
      );
    }
  }

  for (const _id of counterIds) {
    await counters.updateOne({ _id }, { $setOnInsert: { count: 0 } }, { upsert: true });
  }
  console.log(`  counters ready: ${counterIds.join(", ")}`);

  // Add fields introduced after the document was first created.
  for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
    await db
      .collection("settings")
      .updateOne({ _id: "settings", [key]: { $exists: false } }, { $set: { [key]: value } });
  }

  const settings = await db
    .collection("settings")
    .findOneAndUpdate(
      { _id: "settings" },
      { $setOnInsert: SETTINGS_DEFAULTS },
      { upsert: true, returnDocument: "after" },
    );
  const current = { ...settings };
  delete current._id;
  console.log("  settings:", current);
} catch (error) {
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

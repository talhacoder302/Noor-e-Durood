// Emergency tool for the site owner (needs the database URI, so it can't be
// run from the website). Once an admin account exists, the admin panel needs
// that account's login, so if the only admin forgets their PIN or loses the
// role, fix it here.
//
//   npm run admin:account -- 03001234567              make this account an admin
//   npm run admin:account -- 03001234567 --pin 4827   also set a new PIN (logs it out everywhere)
//   npm run admin:account -- 03001234567 --remove     take the admin role away
//
// Reads MONGODB_URI and MONGODB_DB from .env.local.
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Fall back to variables already set in the shell.
}

const args = process.argv.slice(2);
const usage = "Usage: npm run admin:account -- <mobile number> [--pin 1234] [--remove]";

// Same rules as src/lib/phone.ts (normalizePhone), kept short here.
function normalizePhone(input) {
  let s = String(input ?? "").replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  let digits;
  if (s.startsWith("+")) digits = s.slice(1);
  else if (/^0\d{10}$/.test(s)) digits = `92${s.slice(1)}`;
  else if (/^3\d{9}$/.test(s)) digits = `92${s}`;
  else if (/^92\d{10}$/.test(s)) digits = s;
  else return null;
  if (!/^\d+$/.test(digits)) return null;
  if (digits.startsWith("92")) return /^92\d{10}$/.test(digits) ? `+${digits}` : null;
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

const phone = normalizePhone(args[0]);
const remove = args.includes("--remove");
const pinIndex = args.indexOf("--pin");
const pin = pinIndex >= 0 ? args[pinIndex + 1] : undefined;

if (!phone) {
  console.error(usage);
  process.exit(1);
}
if (pin !== undefined && !/^\d{4}$/.test(pin)) {
  console.error("The PIN must be exactly 4 digits.");
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is missing. Fill it in .env.local first.");
  process.exit(1);
}
await mongoose.connect(uri, {
  dbName: process.env.MONGODB_DB || "noor_e_durood",
  serverSelectionTimeoutMS: 10_000,
});
const db = mongoose.connection.db;

const user = await db.collection("users").findOne({ phone }, { projection: { _id: 1 } });
if (!user) {
  console.error("No account with that number. Sign up on the site first.");
  await mongoose.disconnect();
  process.exit(1);
}

const update = remove ? { $unset: { isAdmin: "" } } : { $set: { isAdmin: true } };
if (pin) {
  update.$set = { ...update.$set, pinHash: await bcrypt.hash(pin, 10), failedPins: 0, disabled: false };
  update.$unset = { ...update.$unset, lockedUntil: "", disabledReason: "" };
}
await db.collection("users").updateOne({ _id: user._id }, update);
if (pin) await db.collection("sessions").deleteMany({ userId: user._id.toString() });

console.log(remove ? "Admin role removed." : "This account is now an admin.");
if (pin) console.log("New PIN set; the account was logged out everywhere.");
await mongoose.disconnect();

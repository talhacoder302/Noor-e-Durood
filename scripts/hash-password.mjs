// Makes a bcrypt hash for ADMIN_PASSWORD, so the plain password never has to
// be stored anywhere.  Usage: npm run admin:hash -- "your strong password"
import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Usage: npm run admin:hash -- "a strong password (12+ characters)"');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log("\nFor the Hostinger environment variables panel:");
console.log(`ADMIN_PASSWORD=${hash}`);
// Next.js expands $VARS in .env files, so each $ needs a backslash there.
console.log("\nFor .env.local (dollar signs escaped):");
console.log(`ADMIN_PASSWORD=${hash.replaceAll("$", () => "\\$")}\n`);

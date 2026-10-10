import "server-only";
import { z } from "zod";

// Treat empty values in .env files ("KEY=") as missing.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const envSchema = z.object({
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, "must be a mongodb:// or mongodb+srv:// URI"),
  MONGODB_DB: z.string().min(1).default("noor_e_durood"),
  IP_HASH_SALT: z.string().min(16, "must be at least 16 characters"),
  ADMIN_PASSWORD: z.string().min(8, "must be at least 8 characters"),
  NEXT_PUBLIC_SITE_URL: optional(z.url()),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Validated server environment. Parsed lazily so `next build` works without
 * secrets; the first request that needs them fails loudly instead.
 */
export function getEnv(): Env {
  if (cached) return cached;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Only variable names and rules are printed, never the values.
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${problems}`);
  }

  cached = result.data;
  return cached;
}

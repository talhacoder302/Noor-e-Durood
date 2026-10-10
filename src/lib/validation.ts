import { z } from "zod";
import { ABSOLUTE_MAX_PER_ENTRY } from "./limits";

export const duroodSubmissionSchema = z.object({
  deviceId: z.uuid(),
  count: z.number().int().positive().max(ABSOLUTE_MAX_PER_ENTRY),
  mode: z.enum(["tap", "number"]),
  clientId: z.uuid(),
});

export type DuroodSubmission = z.infer<typeof duroodSubmissionSchema>;

export const deviceSyncSchema = z.object({ deviceId: z.uuid() });


export const credentialsSchema = z.object({
  phone: z.string().trim().min(5).max(32),
  pin: z.string().trim().min(1).max(12),
});

export const changePinSchema = z.object({
  oldPin: z.string().trim().min(1).max(12),
  newPin: z.string().trim().min(1).max(12),
});

export const logoutSchema = z.object({ all: z.boolean().optional() });

/** "" = no majlis, "other" = typed name in majlisOther, else a majlis id. */
export const profileSchema = z.object({
  name: z.string().trim().max(60),
  majlis: z.union([z.literal(""), z.literal("other"), z.string().regex(/^[0-9a-f]{24}$/)]),
  majlisOther: z.string().trim().max(80),
  age: z.union([z.literal(""), z.coerce.number().int().min(5).max(120)]),
  city: z.string().trim().max(60),
});

export type ProfileInput = z.infer<typeof profileSchema>;

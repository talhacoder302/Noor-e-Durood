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

export const recoveryRestoreSchema = z.object({
  deviceId: z.uuid(),
  code: z.string().min(4).max(32),
});

/** Public totals. The only numbers anyone outside the admin panel ever sees. */
export type Totals = {
  total: number;
  today: number;
  month: number;
  /** Karachi day (YYYY-MM-DD) these totals belong to. */
  dayKey: string;
};

export type DuroodMode = "tap" | "number";

export type SubmitErrorCode =
  | "invalid"
  | "entry_limit"
  | "daily_limit"
  | "rate_limited"
  | "paused"
  | "server";

export type SubmitResponse =
  | { ok: true; totals: Totals; duplicate: boolean; deviceId: string }
  | { ok: false; error: SubmitErrorCode; max?: number };

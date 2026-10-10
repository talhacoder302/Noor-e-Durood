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
  | "blocked"
  | "login_required"
  | "server";

export type SubmitResponse =
  | { ok: true; totals: Totals; duplicate: boolean; deviceId: string }
  | { ok: false; error: SubmitErrorCode; max?: number };

/** One account's own numbers (all its phones together). Only returned to that account. */
export type MySummary = {
  today: number;
  week: number;
  month: number;
  allTime: number;
  /** Oldest first, always 7 entries ending today. */
  last7: { day: string; count: number }[];
};

/** What the browser may know about the logged-in user (never the full phone or PIN). */
export type PublicUser = {
  id: string;
  phoneMasked: string;
  name: string;
  majlisId: string | null;
  majlisName: string | null;
  majlisOther: string;
  age: number | null;
  city: string;
};

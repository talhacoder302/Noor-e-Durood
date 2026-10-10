// Defaults for the Settings singleton (admin can change them later).
export const DEFAULT_MAX_PER_ENTRY = 10_000;
export const DEFAULT_MAX_PER_DEVICE_PER_DAY = 100_000;

// Hard ceiling for a single request, whatever the settings say.
export const ABSOLUTE_MAX_PER_ENTRY = 1_000_000;

// Requests per minute. The IP limit is looser on purpose: mobile carriers in
// Pakistan put many phones behind one shared IP (CGNAT).
export const RATE_LIMIT_PER_DEVICE = 30;
export const RATE_LIMIT_PER_IP = 120;

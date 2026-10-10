export type NumberLocale = "ur" | "en";

type Unit = { value: bigint; label: string };

// Largest first. Urdu uses the South Asian system (ہزار، لاکھ، کروڑ، ارب، کھرب).
const UNITS: Record<NumberLocale, Unit[]> = {
  ur: [
    { value: 100_000_000_000n, label: "کھرب" },
    { value: 1_000_000_000n, label: "ارب" },
    { value: 10_000_000n, label: "کروڑ" },
    { value: 100_000n, label: "لاکھ" },
    { value: 1_000n, label: "ہزار" },
  ],
  en: [
    { value: 1_000_000_000_000n, label: "trillion" },
    { value: 1_000_000_000n, label: "billion" },
    { value: 1_000_000n, label: "million" },
    { value: 1_000n, label: "thousand" },
  ],
};

/** Whole-number BigInt from any number; NaN and Infinity become 0. */
function toWhole(value: number): bigint {
  if (!Number.isFinite(value)) return 0n;
  return BigInt(Math.trunc(value));
}

function groupDigits(digits: string, locale: NumberLocale): string {
  if (digits.length <= 3) return digits;

  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  // Lakh/crore style groups the remaining digits in twos: 1,23,45,678
  const size = locale === "ur" ? 2 : 3;
  const groups: string[] = [];
  for (let end = rest.length; end > 0; end -= size) {
    groups.unshift(rest.slice(Math.max(0, end - size), end));
  }
  return `${groups.join(",")},${last3}`;
}

/**
 * Formats a count with commas.
 * ur: 1,23,45,678 (lakh/crore grouping), en: 12,345,678.
 * Always uses Western digits so numbers stay readable in both modes.
 */
export function formatCount(value: number, locale: NumberLocale): string {
  const whole = toWhole(value);
  const negative = whole < 0n;
  const digits = (negative ? -whole : whole).toString();
  return `${negative ? "-" : ""}${groupDigits(digits, locale)}`;
}

/**
 * Short words label for a big count, using the two largest units.
 * ur: 12345678 -> "1 کروڑ 23 لاکھ", en: 12345678 -> "12 million 345 thousand".
 * Returns "" below one thousand, where the number alone is clear enough.
 */
export function countInWords(value: number, locale: NumberLocale): string {
  let remaining = toWhole(value);
  if (remaining < 0n) remaining = -remaining;

  const parts: string[] = [];
  for (const unit of UNITS[locale]) {
    if (parts.length === 2) break;
    const amount = remaining / unit.value;
    if (amount > 0n) {
      parts.push(`${formatCount(Number(amount), locale)} ${unit.label}`);
      remaining %= unit.value;
    }
  }
  return parts.join(" ");
}

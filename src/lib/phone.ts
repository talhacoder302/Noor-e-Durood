// Phone numbers are the account id. Every way people write the same
// number must end up as one stored value (E.164, e.g. "+923001234567").

/** Urdu/Arabic digits to 0–9; drops spaces, dashes, dots and brackets. */
function clean(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s\-().]/g, "");
}

/**
 * Pakistani numbers in any common form (0300…, 300…, 92300…, +92300…,
 * 0092300…) and overseas numbers written with + or 00. Returns null if it
 * doesn't look like a phone number.
 */
export function normalizePhone(input: string): string | null {
  let s = clean(input);
  if (s.startsWith("00")) s = `+${s.slice(2)}`;

  let digits: string;
  if (s.startsWith("+")) {
    digits = s.slice(1);
    if (!/^\d+$/.test(digits)) return null;
  } else if (/^0\d{10}$/.test(s)) {
    digits = `92${s.slice(1)}`; // 03250062540
  } else if (/^3\d{9}$/.test(s)) {
    digits = `92${s}`; // 3001234567
  } else if (/^92\d{10}$/.test(s)) {
    digits = s; // 923001234567
  } else {
    return null;
  }

  // Pakistan: +92 then 10 digits (mobiles start with 3).
  if (digits.startsWith("92")) return /^92\d{10}$/.test(digits) ? `+${digits}` : null;
  // Elsewhere: E.164 allows up to 15 digits; very short ones are typos.
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
}

/** "+92 300 ***4567": enough to recognise your own number, not to copy it. */
export function maskPhone(phone: string): string {
  const last4 = phone.slice(-4);
  if (phone.startsWith("+92") && phone.length === 13) {
    return `+92 ${phone.slice(3, 6)} ***${last4}`;
  }
  return `${phone.slice(0, 3)}***${last4}`;
}

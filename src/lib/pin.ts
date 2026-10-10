// 4-digit PINs. Safety comes from bcrypt + lockouts after wrong tries; here
// we only refuse the PINs everyone guesses first.

export const PIN_LENGTH = 4;

export function normalizePin(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\s/g, "");
}

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** 0000, 1111 … and straight runs like 1234 or 9876. */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1+$/.test(pin)) return true;
  const steps = [...pin].map(Number).slice(1).map((d, i) => d - Number(pin[i]));
  return steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

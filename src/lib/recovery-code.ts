// Recovery codes: 8 characters, no look-alikes (0/O, 1/I/L), shown as
// "ABCD-EFGH". Typing is forgiving: case, spaces, dashes and Urdu digits.

export const RECOVERY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const RECOVERY_LENGTH = 8;

export function normalizeRecoveryCode(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "");
}

export function isRecoveryCode(code: string): boolean {
  return (
    code.length === RECOVERY_LENGTH &&
    [...code].every((c) => RECOVERY_ALPHABET.includes(c))
  );
}

export function formatRecoveryCode(code: string): string {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

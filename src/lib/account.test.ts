import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone } from "./phone";
import { isValidPinFormat, isWeakPin, normalizePin } from "./pin";

describe("normalizePhone", () => {
  it("treats every way of writing a Pakistani number as the same", () => {
    for (const input of [
      "03001234567",
      "0300-1234567",
      "0300 123 4567",
      "3001234567",
      "923001234567",
      "+923001234567",
      "+92 300 1234567",
      "00923001234567",
      "۰۳۰۰۱۲۳۴۵۶۷",
    ]) {
      expect(normalizePhone(input), input).toBe("+923001234567");
    }
  });

  it("accepts overseas numbers written with + or 00", () => {
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("00971501234567")).toBe("+971501234567");
  });

  it("rejects things that aren't phone numbers", () => {
    for (const input of ["", "abc", "12345", "0300123", "030012345678", "+92 300 12", "+0123456789", "92-300"]) {
      expect(normalizePhone(input), input).toBeNull();
    }
  });

  it("masks for display", () => {
    expect(maskPhone("+923001234567")).toBe("+92 300 ***4567");
    expect(maskPhone("+447700900123")).toBe("+44***0123");
  });
});

describe("PIN rules", () => {
  it("is exactly four digits, Urdu digits allowed", () => {
    expect(isValidPinFormat(normalizePin("۴۸۲۷"))).toBe(true);
    expect(isValidPinFormat("4827")).toBe(true);
    expect(isValidPinFormat("482")).toBe(false);
    expect(isValidPinFormat("48271")).toBe(false);
    expect(isValidPinFormat("48a7")).toBe(false);
  });

  it("refuses the PINs people guess first", () => {
    for (const pin of ["0000", "1111", "9999", "1234", "2345", "6789", "4321", "9876"]) {
      expect(isWeakPin(pin), pin).toBe(true);
    }
    for (const pin of ["4827", "1357", "2580", "1212", "7391"]) {
      expect(isWeakPin(pin), pin).toBe(false);
    }
  });
});

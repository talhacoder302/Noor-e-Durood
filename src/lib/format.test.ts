import { describe, expect, it } from "vitest";
import { countInWords, formatCount, normalizeDigits } from "./format";

describe("formatCount", () => {
  it("uses lakh/crore grouping in Urdu", () => {
    expect(formatCount(12345678, "ur")).toBe("1,23,45,678");
    expect(formatCount(100000, "ur")).toBe("1,00,000");
    expect(formatCount(1000000000, "ur")).toBe("1,00,00,00,000");
  });

  it("uses thousands grouping in English", () => {
    expect(formatCount(12345678, "en")).toBe("12,345,678");
    expect(formatCount(100000, "en")).toBe("100,000");
    expect(formatCount(1000000000, "en")).toBe("1,000,000,000");
  });

  it("leaves small numbers alone", () => {
    for (const locale of ["ur", "en"] as const) {
      expect(formatCount(0, locale)).toBe("0");
      expect(formatCount(7, locale)).toBe("7");
      expect(formatCount(999, locale)).toBe("999");
      expect(formatCount(1000, locale)).toBe("1,000");
    }
  });

  it("handles odd input safely", () => {
    expect(formatCount(1234.99, "en")).toBe("1,234");
    expect(formatCount(-1234567, "ur")).toBe("-12,34,567");
    expect(formatCount(Number.NaN, "en")).toBe("0");
    expect(formatCount(Number.POSITIVE_INFINITY, "ur")).toBe("0");
  });

  it("stays exact beyond the safe integer range", () => {
    expect(formatCount(1e21, "en")).toBe("1,000,000,000,000,000,000,000");
  });
});

describe("countInWords", () => {
  it("uses crore and lakh in Urdu", () => {
    expect(countInWords(12345678, "ur")).toBe("1 کروڑ 23 لاکھ");
    expect(countInWords(150000, "ur")).toBe("1 لاکھ 50 ہزار");
    expect(countInWords(2500000000, "ur")).toBe("2 ارب 50 کروڑ");
  });

  it("uses million and thousand in English", () => {
    expect(countInWords(12345678, "en")).toBe("12 million 345 thousand");
    expect(countInWords(2500000000, "en")).toBe("2 billion 500 million");
  });

  it("skips empty units", () => {
    expect(countInWords(10000000, "ur")).toBe("1 کروڑ");
    expect(countInWords(10005000, "ur")).toBe("1 کروڑ 5 ہزار");
    expect(countInWords(1000000, "en")).toBe("1 million");
  });

  it("returns an empty label below one thousand", () => {
    expect(countInWords(0, "ur")).toBe("");
    expect(countInWords(999, "en")).toBe("");
  });
});

describe("normalizeDigits", () => {
  it("accepts Urdu and Arabic digits", () => {
    expect(normalizeDigits("۵۰۰")).toBe("500");
    expect(normalizeDigits("٣١٣")).toBe("313");
  });

  it("drops anything that is not a digit", () => {
    expect(normalizeDigits("1,000")).toBe("1000");
    expect(normalizeDigits(" 12a3 ")).toBe("123");
    expect(normalizeDigits("-5.5")).toBe("55");
  });
});

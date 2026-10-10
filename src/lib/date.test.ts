import { describe, expect, it } from "vitest";
import { counterIds, karachiDay, karachiMonth } from "./date";

describe("Karachi dates", () => {
  it("rolls over to the next day at midnight Pakistan time", () => {
    // 19:00 UTC is midnight in Karachi (UTC+5).
    expect(karachiDay(new Date("2026-03-31T18:59:59Z"))).toBe("2026-03-31");
    expect(karachiDay(new Date("2026-03-31T19:00:00Z"))).toBe("2026-04-01");
  });

  it("derives the month from the Karachi day", () => {
    expect(karachiMonth(new Date("2026-03-31T19:30:00Z"))).toBe("2026-04");
  });

  it("builds counter ids", () => {
    const at = new Date("2026-10-10T07:00:00Z");
    expect(counterIds.global).toBe("global");
    expect(counterIds.day(at)).toBe("day:2026-10-10");
    expect(counterIds.month(at)).toBe("month:2026-10");
  });
});

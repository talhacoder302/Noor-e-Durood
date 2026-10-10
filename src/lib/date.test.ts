import { describe, expect, it } from "vitest";
import {
  addDays,
  counterIds,
  isFridayInKarachi,
  karachiDay,
  karachiMonth,
  lastDays,
  weekdayOf,
  weekStart,
} from "./date";

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

describe("week helpers", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("starts weeks on Monday", () => {
    // 10 Oct 2026 is a Saturday.
    expect(weekdayOf("2026-10-10")).toBe(6);
    expect(weekStart("2026-10-10")).toBe("2026-10-05");
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
    expect(weekStart("2026-10-11")).toBe("2026-10-05");
  });

  it("lists the last seven days oldest first", () => {
    expect(lastDays(7, "2026-10-02")).toEqual([
      "2026-09-26",
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("knows Friday in Pakistan time", () => {
    // Thursday 19:00 UTC is already Friday midnight in Karachi.
    expect(isFridayInKarachi(new Date("2026-10-08T18:59:00Z"))).toBe(false);
    expect(isFridayInKarachi(new Date("2026-10-08T19:00:00Z"))).toBe(true);
    expect(isFridayInKarachi(new Date("2026-10-09T18:59:00Z"))).toBe(true);
    expect(isFridayInKarachi(new Date("2026-10-09T19:00:00Z"))).toBe(false);
  });
});

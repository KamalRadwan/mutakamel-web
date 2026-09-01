import { describe, expect, it } from "vitest";
import {
  addMonths,
  matchPreset,
  monthGrid,
  orderRange,
  resolvePreset,
  toTimeValue,
  withTime,
} from "./date-range-presets";

// A Tuesday in the third quarter, deliberately mid-month and mid-year.
const NOW = new Date(2026, 8, 1, 14, 37, 12); // 2026-09-01

function iso(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")} ${String(value.getHours()).padStart(2, "0")}:${String(
    value.getMinutes(),
  ).padStart(2, "0")}`;
}

describe("resolvePreset", () => {
  it("covers today from midnight to the last millisecond", () => {
    const range = resolvePreset("today", NOW)!;
    expect(iso(range.from)).toBe("2026-09-01 00:00");
    expect(iso(range.to)).toBe("2026-09-01 23:59");
    expect(range.to.getMilliseconds()).toBe(999);
  });

  it("steps back a whole day for yesterday", () => {
    const range = resolvePreset("yesterday", NOW)!;
    expect(iso(range.from)).toBe("2026-08-31 00:00");
    expect(iso(range.to)).toBe("2026-08-31 23:59");
  });

  it("ends this month on its own last day, not a fixed 30th", () => {
    const range = resolvePreset("thisMonth", NOW)!;
    expect(iso(range.from)).toBe("2026-09-01 00:00");
    expect(iso(range.to)).toBe("2026-09-30 23:59");
  });

  it("ends last month on the 31st when that is its length", () => {
    const range = resolvePreset("lastMonth", NOW)!;
    expect(iso(range.from)).toBe("2026-08-01 00:00");
    expect(iso(range.to)).toBe("2026-08-31 23:59");
  });

  it("rolls last month across a year boundary", () => {
    const range = resolvePreset("lastMonth", new Date(2026, 0, 15))!;
    expect(iso(range.from)).toBe("2025-12-01 00:00");
    expect(iso(range.to)).toBe("2025-12-31 23:59");
  });

  it("covers whole years", () => {
    expect(iso(resolvePreset("thisYear", NOW)!.from)).toBe("2026-01-01 00:00");
    expect(iso(resolvePreset("thisYear", NOW)!.to)).toBe("2026-12-31 23:59");
    expect(iso(resolvePreset("lastYear", NOW)!.from)).toBe("2025-01-01 00:00");
    expect(iso(resolvePreset("lastYear", NOW)!.to)).toBe("2025-12-31 23:59");
  });

  it("puts every quarter on the right months of the current year", () => {
    expect(iso(resolvePreset("q1", NOW)!.from)).toBe("2026-01-01 00:00");
    expect(iso(resolvePreset("q1", NOW)!.to)).toBe("2026-03-31 23:59");
    expect(iso(resolvePreset("q2", NOW)!.from)).toBe("2026-04-01 00:00");
    expect(iso(resolvePreset("q2", NOW)!.to)).toBe("2026-06-30 23:59");
    expect(iso(resolvePreset("q3", NOW)!.from)).toBe("2026-07-01 00:00");
    expect(iso(resolvePreset("q3", NOW)!.to)).toBe("2026-09-30 23:59");
    expect(iso(resolvePreset("q4", NOW)!.from)).toBe("2026-10-01 00:00");
    expect(iso(resolvePreset("q4", NOW)!.to)).toBe("2026-12-31 23:59");
  });

  it("has no range of its own for a custom selection", () => {
    expect(resolvePreset("custom", NOW)).toBeNull();
  });
});

describe("matchPreset", () => {
  it("names a range that happens to equal a preset", () => {
    expect(matchPreset(resolvePreset("q2", NOW)!, NOW)).toBe("q2");
    expect(matchPreset(resolvePreset("today", NOW)!, NOW)).toBe("today");
  });

  it("calls anything else custom", () => {
    expect(
      matchPreset(
        { from: new Date(2026, 8, 3), to: new Date(2026, 8, 9, 23, 59, 59, 999) },
        NOW,
      ),
    ).toBe("custom");
  });
});

describe("time of day", () => {
  it("round-trips a time through the input format", () => {
    const applied = withTime(new Date(2026, 8, 1), "09:05");
    expect(toTimeValue(applied)).toBe("09:05");
    expect(applied.getSeconds()).toBe(0);
  });

  it("ignores a malformed or impossible time rather than producing NaN", () => {
    const base = new Date(2026, 8, 1, 8, 30);
    expect(withTime(base, "").getTime()).toBe(base.getTime());
    expect(withTime(base, "99:99").getTime()).toBe(base.getTime());
    expect(withTime(base, "24:00").getTime()).toBe(base.getTime());
    expect(withTime(base, "abc").getTime()).toBe(base.getTime());
  });
});

describe("calendar grid", () => {
  it("always renders six whole weeks", () => {
    expect(monthGrid(new Date(2026, 8, 1), 0)).toHaveLength(42);
    expect(monthGrid(new Date(2026, 1, 1), 6)).toHaveLength(42);
  });

  it("starts on the requested weekday", () => {
    expect(monthGrid(new Date(2026, 8, 1), 0)[0].getDay()).toBe(0);
    expect(monthGrid(new Date(2026, 8, 1), 6)[0].getDay()).toBe(6);
    expect(monthGrid(new Date(2026, 8, 1), 1)[0].getDay()).toBe(1);
  });

  it("steps months across a year boundary", () => {
    expect(addMonths(new Date(2026, 11, 1), 1).getFullYear()).toBe(2027);
    expect(addMonths(new Date(2026, 0, 1), -1).getFullYear()).toBe(2025);
  });
});

describe("orderRange", () => {
  it("accepts a selection made backwards", () => {
    const later = new Date(2026, 8, 20);
    const earlier = new Date(2026, 8, 4);
    const range = orderRange(later, earlier);
    expect(iso(range.from)).toBe("2026-09-04 00:00");
    expect(iso(range.to)).toBe("2026-09-20 23:59");
  });

  it("makes a single-day selection span that whole day", () => {
    const day = new Date(2026, 8, 7, 16, 20);
    const range = orderRange(day, day);
    expect(iso(range.from)).toBe("2026-09-07 00:00");
    expect(iso(range.to)).toBe("2026-09-07 23:59");
  });
});

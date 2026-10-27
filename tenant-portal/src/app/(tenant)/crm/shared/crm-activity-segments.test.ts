import { describe, expect, it } from "vitest";
import type { CrmActivityState } from "./crm-activity-tone";
import { crmActivitySegments } from "./crm-activity-segments";

describe("crmActivitySegments", () => {
  it("fills an empty column with NONE", () => {
    expect(crmActivitySegments([])).toEqual([{ state: "NONE", count: 0, percent: 100 }]);
  });

  it.each<CrmActivityState>(["FUTURE", "TODAY", "OVERDUE", "NONE"])("fills a column containing only %s", (state) => {
    expect(crmActivitySegments([state, state, state])).toEqual([{ state, count: 3, percent: 100 }]);
  });

  it("counts mixed states in contract order regardless of input order", () => {
    expect(crmActivitySegments(["NONE", "TODAY", "FUTURE", "OVERDUE", "FUTURE", "NONE", "TODAY", "FUTURE"])).toEqual([
      { state: "FUTURE", count: 3, percent: 37.5 },
      { state: "TODAY", count: 2, percent: 25 },
      { state: "OVERDUE", count: 1, percent: 12.5 },
      { state: "NONE", count: 2, percent: 25 },
    ]);
  });

  it("omits zero-count states", () => {
    expect(crmActivitySegments(["NONE", "TODAY", "NONE"])).toEqual([
      { state: "TODAY", count: 1, percent: 33.33 },
      { state: "NONE", count: 2, percent: 66.67 },
    ]);
  });

  it("breaks equal-remainder ties in contract order", () => {
    expect(crmActivitySegments(["OVERDUE", "TODAY", "FUTURE"])).toEqual([
      { state: "FUTURE", count: 1, percent: 33.34 },
      { state: "TODAY", count: 1, percent: 33.33 },
      { state: "OVERDUE", count: 1, percent: 33.33 },
    ]);
  });

  it("awards the rounding remainder to the largest fractional share", () => {
    expect(crmActivitySegments(["FUTURE", "TODAY", "TODAY", "OVERDUE", "OVERDUE", "OVERDUE", "NONE"])).toEqual([
      { state: "FUTURE", count: 1, percent: 14.29 },
      { state: "TODAY", count: 2, percent: 28.57 },
      { state: "OVERDUE", count: 3, percent: 42.86 },
      { state: "NONE", count: 1, percent: 14.28 },
    ]);
  });

  it.each([3, 7, 11, 101, 10_001])("totals exactly 100 percent in hundredths for %i leads", (total) => {
    const order: readonly CrmActivityState[] = ["FUTURE", "TODAY", "OVERDUE", "NONE"];
    const states = Array.from({ length: total }, (_, index) => order[index % order.length]);
    const segments = crmActivitySegments(states);
    expect(segments.reduce((sum, segment) => sum + Math.round(segment.percent * 100), 0)).toBe(10_000);
    expect(segments.reduce((sum, segment) => sum + segment.count, 0)).toBe(total);
    for (const segment of segments) {
      expect(segment.count).toBeGreaterThan(0);
      expect(Math.abs(segment.percent - segment.count / total * 100)).toBeLessThanOrEqual(0.01);
    }
  });

  it("accepts readonly input without changing it", () => {
    const states = Object.freeze(["NONE", "FUTURE", "TODAY"] as const);
    crmActivitySegments(states);
    expect(states).toEqual(["NONE", "FUTURE", "TODAY"]);
  });
});

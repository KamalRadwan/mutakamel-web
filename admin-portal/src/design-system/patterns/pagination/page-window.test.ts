import { describe, expect, it } from "vitest";
import { pageWindow } from "./page-window";

describe("pageWindow", () => {
  it("lists every page while they still fit without a gap", () => {
    expect(pageWindow(1, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("keeps three pages either side of the current page", () => {
    expect(pageWindow(10, 20)).toEqual([1, "gap-start", 7, 8, 9, 10, 11, 12, 13, "gap-end", 20]);
  });

  it("keeps first and last reachable from the middle", () => {
    const slots = pageWindow(50, 100);
    expect(slots.at(0)).toBe(1);
    expect(slots.at(-1)).toBe(100);
  });

  it("widens the window inward at the edges rather than shrinking it", () => {
    // The contiguous run stays seven wide wherever the current page sits; only
    // the first/last shortcuts around it come and go.
    const run = (slots: ReturnType<typeof pageWindow>) => {
      const numbers = slots.filter((slot): slot is number => typeof slot === "number");
      let longest = 0;
      let current = 0;
      numbers.forEach((n, index) => {
        current = index > 0 && n === numbers[index - 1] + 1 ? current + 1 : 1;
        longest = Math.max(longest, current);
      });
      return longest;
    };
    expect(run(pageWindow(1, 100))).toBe(7);
    expect(run(pageWindow(50, 100))).toBe(7);
    expect(run(pageWindow(100, 100))).toBe(7);
    expect(pageWindow(1, 100)).toEqual([1, 2, 3, 4, 5, 6, 7, "gap-end", 100]);
    expect(pageWindow(100, 100)).toEqual([1, "gap-start", 94, 95, 96, 97, 98, 99, 100]);
  });

  it("never emits a gap that hides a single page", () => {
    for (let total = 1; total <= 40; total += 1) {
      for (let page = 1; page <= total; page += 1) {
        const slots = pageWindow(page, total);
        const numbers = slots.filter((slot): slot is number => typeof slot === "number");
        slots.forEach((slot, index) => {
          if (typeof slot !== "string") return;
          const before = slots[index - 1];
          const after = slots[index + 1];
          // A gap standing in for one page should have been that page.
          expect(Number(after) - Number(before)).toBeGreaterThan(2);
        });
        expect(numbers).toContain(page);
        expect(numbers.at(0)).toBe(1);
        expect(numbers.at(-1)).toBe(total);
      }
    }
  });

  it("clamps out-of-range and non-integer input instead of throwing", () => {
    expect(pageWindow(0, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(99, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(1, 0)).toEqual([1]);
  });
});

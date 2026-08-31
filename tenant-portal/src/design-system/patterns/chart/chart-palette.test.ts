import { describe, expect, it } from "vitest";
import {
  hasAdjacentCautionNegative,
  MAX_QUALITATIVE_CATEGORIES,
  orderStatusRoles,
  QUALITATIVE_RAMP,
  STATUS_DRAW_ORDER,
  STATUS_FILL,
  topNWithOther,
  type ChartRole,
} from "./chart-palette";

describe("chart palette", () => {
  it("has exactly four status fills — the four roles and no fifth hue", () => {
    expect(Object.keys(STATUS_FILL).sort()).toEqual(["brand", "caution", "negative", "positive"]);
  });

  it("colours only through tokens, so the theme flip and tenant branding repaint it", () => {
    for (const fill of Object.values(STATUS_FILL)) {
      expect(fill).toMatch(/^var\(--color-(brand|positive|caution|negative)-\d{3}\)$/);
    }
  });

  it("draws the qualitative ramp from ONE hue", () => {
    for (const step of QUALITATIVE_RAMP) {
      expect(step).toMatch(/^var\(--color-brand-\d{3}\)$/);
    }
  });

  it("puts brand between caution and negative in the canonical order", () => {
    expect(hasAdjacentCautionNegative(STATUS_DRAW_ORDER)).toBe(false);
  });

  it("separates caution and negative in any three-or-more-role breakdown", () => {
    const roles: ChartRole[] = ["negative", "caution", "brand"];
    expect(hasAdjacentCautionNegative(roles)).toBe(true);
    const ordered = orderStatusRoles(roles.map((role) => ({ role }))).map((entry) => entry.role);
    expect(hasAdjacentCautionNegative(ordered)).toBe(false);
  });

  it("orders series positive, caution, brand, negative regardless of input order", () => {
    const ordered = orderStatusRoles(
      (["negative", "brand", "positive", "caution"] as ChartRole[]).map((role) => ({ role })),
    );
    expect(ordered.map((entry) => entry.role)).toEqual(["positive", "caution", "brand", "negative"]);
  });
});

describe("topNWithOther", () => {
  const sources = [
    { key: "referral", label: "Referral", value: 40 },
    { key: "web", label: "Website", value: 90 },
    { key: "event", label: "Event", value: 10 },
    { key: "cold", label: "Cold call", value: 5 },
  ];

  it("sorts descending so the darkest step is the largest slice", () => {
    const slices = topNWithOther(sources, "Other", 2);
    expect(slices.map((slice) => slice.label)).toEqual(["Website", "Referral", "Other"]);
    expect(slices[0].fill).toBe(QUALITATIVE_RAMP[0]);
    expect(slices[1].fill).toBe(QUALITATIVE_RAMP[1]);
  });

  it("folds the tail into Other and sums it", () => {
    const slices = topNWithOther(sources, "Other", 2);
    const other = slices.at(-1)!;
    expect(other.isOther).toBe(true);
    expect(other.value).toBe(15);
  });

  it("gives Other the lightest step whatever N is", () => {
    for (const limit of [1, 2, 3]) {
      const slices = topNWithOther(sources, "Other", limit);
      expect(slices.at(-1)!.fill).toBe(QUALITATIVE_RAMP.at(-1));
    }
  });

  it("adds no Other bucket when everything fits", () => {
    const slices = topNWithOther(sources, "Other", 4);
    expect(slices.some((slice) => slice.isOther)).toBe(false);
    expect(slices).toHaveLength(4);
  });

  it("never assigns more fills than the single-hue ramp has", () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      key: String(index),
      label: `Source ${index}`,
      value: 20 - index,
    }));
    const slices = topNWithOther(many, "Other", 99);
    expect(slices).toHaveLength(MAX_QUALITATIVE_CATEGORIES + 1);
    expect(new Set(slices.map((slice) => slice.fill)).size).toBe(slices.length);
  });

  it("does not mutate the caller's array", () => {
    const input = [...sources];
    topNWithOther(input, "Other", 2);
    expect(input).toEqual(sources);
  });
});

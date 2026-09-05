// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardVisual } from "@/types/dashboard";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";

const language = { lang: "en" as "ar" | "en", dir: "ltr" as "ltr" | "rtl", t: en as typeof ar };

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => language,
}));

import { BarVisual } from "./BarVisual";

/**
 * Recharts measures 0×0 under jsdom, so nothing reaches the SVG. The
 * exact-value table `ChartFigure` renders is built from the same ordered
 * array the chart is, which makes it the honest place to assert order.
 */
function rowLabels(): string[] {
  const table = screen.getByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent ?? "");
}

function bar(
  categories: Array<{ key: string; label: string; value: number }>,
  ordered?: boolean,
): DashboardVisual {
  return {
    key: "tenants.recency",
    kind: "bar",
    title: "Time Since Last Request",
    unit: "count",
    ordered,
    data: { categories },
  } as DashboardVisual;
}

const BUCKETS = [
  { key: "today", label: "Today", value: 1 },
  { key: "week", label: "Within a week", value: 0 },
  { key: "month", label: "Within a month", value: 0 },
  { key: "dormant", label: "Over a month", value: 2 },
  { key: "never", label: "Never", value: 3 },
];

describe("BarVisual ordering", () => {
  it("ranks categories by value when the order carries no meaning", () => {
    render(<BarVisual visual={bar(BUCKETS) as never} />);

    expect(rowLabels()).toEqual([
      "Never",
      "Over a month",
      "Today",
      "Within a week",
      "Within a month",
    ]);
  });

  /**
   * A histogram's buckets are a scale. Sorted by size they read as nonsense —
   * "never, over a month, today" is not a timeline — and the reader loses the
   * one thing the chart was for.
   */
  it("keeps the given order when the categories are a scale", () => {
    render(<BarVisual visual={bar(BUCKETS, true) as never} />);

    expect(rowLabels()).toEqual([
      "Today",
      "Within a week",
      "Within a month",
      "Over a month",
      "Never",
    ]);
  });

  it("keeps every bucket rather than folding a tail into Other", () => {
    const many = Array.from({ length: 9 }, (_, index) => ({
      key: `b${index}`,
      label: `Bucket ${index}`,
      value: 9 - index,
    }));
    render(<BarVisual visual={bar(many, true) as never} />);

    expect(rowLabels()).toHaveLength(9);
    expect(rowLabels()).not.toContain(en.dashboard.visuals.other);
  });

  /**
   * The spoken summary names the biggest bar. In an ordered chart the first
   * bar is simply the first bucket, so reading `[0]` would announce the wrong
   * category to anyone using the accessible summary rather than the picture.
   */
  it("names the largest bucket in the summary, not the first one", () => {
    render(<BarVisual visual={bar(BUCKETS, true) as never} />);

    expect(screen.getByRole("figure").textContent).toContain("Highest is Never");
  });
});

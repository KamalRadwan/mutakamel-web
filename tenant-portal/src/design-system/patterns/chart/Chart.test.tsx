// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { setLanguage } from "@/i18n/useLanguage";
import { BarChart, LineChart, type CartesianSeries } from "./CartesianChart";
import { DonutChart } from "./DonutChart";
import { Sparkline } from "./Sparkline";
import { topNWithOther } from "./chart-palette";

// recharts measures with ResizeObserver; jsdom has no layout. The stub lets the
// tree mount. Assertions below are about markup and props, never geometry.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  setLanguage("en");
});

const data = [
  { month: "Jan", won: 12, lost: 4 },
  { month: "Feb", won: 18, lost: 6 },
];

const series: CartesianSeries[] = [
  { key: "lost", label: "Lost", role: "negative" },
  { key: "won", label: "Won", role: "positive" },
];

describe("Cartesian charts", () => {
  it("names the figure and states the numbers in words for a screen reader", () => {
    render(
      <LineChart
        data={data}
        xKey="month"
        series={series}
        label="Opportunities by month"
        summary="Won rose from 12 to 18; lost rose from 4 to 6."
      />,
    );
    expect(screen.getByRole("img", { name: "Opportunities by month" })).toBeInTheDocument();
    expect(screen.getByText("Won rose from 12 to 18; lost rose from 4 to 6.")).toBeInTheDocument();
  });

  it("disables the mount animation on every series", () => {
    const { container } = render(
      <BarChart data={data} xKey="month" series={series} label="Opportunities" summary="Two months." />,
    );
    // recharts adds `recharts-animation` only when animating; nothing here does.
    expect(container.querySelector(".recharts-bar-rectangle.animate")).toBeNull();
  });

  it("renders in Arabic without a language ternary anywhere in the component", () => {
    setLanguage("ar");
    render(<BarChart data={data} xKey="month" series={series} label="الفرص" summary="شهران." />);
    expect(screen.getByRole("img", { name: "الفرص" })).toBeInTheDocument();
  });
});

describe("DonutChart", () => {
  it("accepts a status breakdown coloured by the four roles", () => {
    render(
      <DonutChart
        label="Leads by status"
        summary="Converted 40, on hold 10, disqualified 5."
        slices={[
          { key: "converted", label: "Converted", value: 40, role: "positive" },
          { key: "onHold", label: "On hold", value: 10, role: "caution" },
          { key: "disqualified", label: "Disqualified", value: 5, role: "negative" },
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: "Leads by status" })).toBeInTheDocument();
  });

  it("accepts a qualitative breakdown straight from topNWithOther", () => {
    const slices = topNWithOther(
      [
        { key: "web", label: "Website", value: 90 },
        { key: "referral", label: "Referral", value: 40 },
        { key: "event", label: "Event", value: 10 },
      ],
      "Other",
      2,
    );
    render(<DonutChart label="Leads by source" summary="Website leads." slices={slices} />);
    expect(screen.getByRole("img", { name: "Leads by source" })).toBeInTheDocument();
  });

  it("renders the total in the hole, already formatted by the caller", () => {
    render(
      <DonutChart
        label="Leads by status"
        summary="55 leads."
        centerValue="55"
        centerLabel="Leads"
        slices={[{ key: "a", label: "Converted", value: 55, role: "positive" }]}
      />,
    );
    expect(screen.getByText("55")).toBeInTheDocument();
    expect(screen.getByText("Leads")).toBeInTheDocument();
  });

  it("renders nothing broken for an empty breakdown", () => {
    render(<DonutChart label="Empty" summary="No data." slices={[]} />);
    expect(screen.getByRole("img", { name: "Empty" })).toBeInTheDocument();
  });
});

describe("Sparkline", () => {
  it("carries the trend in its accessible name, not only in the shape", () => {
    render(<Sparkline values={[3, 5, 4, 9]} label="New leads, up 12% over 30 days" />);
    expect(screen.getByRole("img", { name: "New leads, up 12% over 30 days" })).toBeInTheDocument();
  });
});

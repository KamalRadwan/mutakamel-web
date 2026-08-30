// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DATE_RANGE_PRESET_IDS,
  DateRangePicker,
  resolveDateRangePreset,
  type DateRangePresetLabels,
} from "./DateRangePicker";

afterEach(cleanup);

const presetLabels: DateRangePresetLabels = {
  today: "Today",
  last7Days: "Last 7 days",
  last30Days: "Last 30 days",
  last90Days: "Last 90 days",
  thisMonth: "This month",
  thisQuarter: "This quarter",
};

// A Wednesday in the middle of a quarter, so month and quarter edges are
// unambiguous.
const NOW = new Date(2026, 4, 20, 14, 30);

describe("resolveDateRangePreset", () => {
  it("snaps to day boundaries so a mid-afternoon filter does not drop a day", () => {
    const range = resolveDateRangePreset("today", NOW);
    expect(range.from?.getHours()).toBe(0);
    expect(range.to?.getHours()).toBe(23);
  });

  it("counts last-N-days inclusively of today", () => {
    const range = resolveDateRangePreset("last7Days", NOW);
    expect(range.from?.getDate()).toBe(14);
    expect(range.to?.getDate()).toBe(20);
  });

  it("resolves this month and this quarter to their real edges", () => {
    expect(resolveDateRangePreset("thisMonth", NOW).from?.getDate()).toBe(1);
    expect(resolveDateRangePreset("thisMonth", NOW).to?.getDate()).toBe(31);
    // Q2 2026 is April–June.
    expect(resolveDateRangePreset("thisQuarter", NOW).from?.getMonth()).toBe(3);
    expect(resolveDateRangePreset("thisQuarter", NOW).to?.getMonth()).toBe(5);
  });

  it("covers all six presets the plan names", () => {
    expect(DATE_RANGE_PRESET_IDS).toHaveLength(6);
    for (const id of DATE_RANGE_PRESET_IDS) {
      expect(resolveDateRangePreset(id, NOW).from).toBeInstanceOf(Date);
    }
  });
});

describe("DateRangePicker", () => {
  it("renders the placeholder when no range is set", () => {
    render(
      <DateRangePicker onValueChange={vi.fn()} placeholder="Any date" presetLabels={presetLabels} />,
    );
    expect(screen.getByRole("button", { name: /Any date/ })).toBeInTheDocument();
  });

  it("formats both ends with an explicit locale", () => {
    render(
      <DateRangePicker
        value={{ from: new Date(2026, 4, 1), to: new Date(2026, 4, 31) }}
        onValueChange={vi.fn()}
        placeholder="Any date"
        presetLabels={presetLabels}
        language="en"
      />,
    );
    expect(screen.getByRole("button", { name: /May 1, 2026 – May 31, 2026/ })).toBeInTheDocument();
  });

  it("applies a preset against the reference date it is given, not the wall clock", () => {
    const onValueChange = vi.fn();
    render(
      <DateRangePicker
        onValueChange={onValueChange}
        placeholder="Any date"
        presetLabels={presetLabels}
        now={NOW}
        language="en"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Any date/ }));
    fireEvent.click(screen.getByRole("button", { name: "Last 30 days" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect((onValueChange.mock.calls[0][0]!.from as Date).getMonth()).toBe(3);
  });

  it("offers every preset label the caller passes", () => {
    render(
      <DateRangePicker
        onValueChange={vi.fn()}
        placeholder="Any date"
        presetLabels={presetLabels}
        language="en"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Any date/ }));
    for (const label of Object.values(presetLabels)) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterBar, type FilterBarProps } from "./FilterBar";
import { describeFilters, normalizeFilterValue, type FilterDef } from "./filter-types";

afterEach(cleanup);

const presetLabels = {
  today: "Today",
  last7Days: "Last 7 days",
  last30Days: "Last 30 days",
  last90Days: "Last 90 days",
  thisMonth: "This month",
  thisQuarter: "This quarter",
};

const multiSelectLabels = {
  emptyLabel: "No stages match",
  moreLabel: "+{count}",
  removeLabel: "Remove {label}",
  overflowLabel: "More stages",
};

const filters: FilterDef[] = [
  {
    id: "status",
    kind: "select",
    label: "Status",
    options: [
      { value: "OPEN", label: "Open" },
      { value: "ON_HOLD", label: "On hold" },
    ],
  },
  {
    id: "stage",
    kind: "multiSelect",
    label: "Stage",
    options: [
      { value: "new", label: "New" },
      { value: "qualified", label: "Qualified" },
      { value: "won", label: "Won" },
    ],
    labels: multiSelectLabels,
  },
  { id: "created", kind: "dateRange", label: "Created", presetLabels },
  { id: "amount", kind: "numericRange", label: "Amount", minLabel: "Min", maxLabel: "Max" },
  { id: "archived", kind: "boolean", label: "Archived", trueLabel: "Yes", falseLabel: "No" },
];

function renderBar(overrides: Partial<FilterBarProps> = {}) {
  const props: FilterBarProps = {
    filters,
    values: {},
    onChange: vi.fn(),
    onReset: vi.fn(),
    searchValue: "",
    onSearchChange: vi.fn(),
    searchPlaceholder: "Search",
    filtersLabel: "Filters",
    clearAllLabel: "Clear all",
    overflowChipsLabel: "More filters",
    removeChipLabel: "Remove {label}",
    ...overrides,
  };
  return { props, ...render(<FilterBar {...props} />) };
}

describe("describeFilters", () => {
  const format = {
    dateRange: (from?: string, to?: string) => [from, to].filter(Boolean).join(" – "),
    numericRange: (min?: string, max?: string) => [min, max].filter(Boolean).join(" – "),
  };

  it("emits one chip per multi-select VALUE, each individually removable", () => {
    const chips = describeFilters(
      filters,
      { stage: { kind: "multiSelect", values: ["new", "won"] } },
      format,
    );
    expect(chips.map((chip) => chip.text)).toEqual(["Stage: New", "Stage: Won"]);
    expect(chips[0].nextValue).toEqual({ kind: "multiSelect", values: ["won"] });
  });

  it("covers all five filter kinds", () => {
    const chips = describeFilters(
      filters,
      {
        status: { kind: "select", value: "ON_HOLD" },
        stage: { kind: "multiSelect", values: ["new"] },
        created: { kind: "dateRange", from: "2026-01-01", to: "2026-03-31" },
        amount: { kind: "numericRange", min: "100", max: "500" },
        archived: { kind: "boolean", value: true },
      },
      format,
    );
    expect(chips.map((chip) => chip.text)).toEqual([
      "Status: On hold",
      "Stage: New",
      "Created: 2026-01-01 – 2026-03-31",
      "Amount: 100 – 500",
      "Archived: Yes",
    ]);
  });

  it("ignores a value whose kind does not match its definition", () => {
    expect(
      describeFilters(filters, { status: { kind: "boolean", value: true } }, format),
    ).toEqual([]);
  });

  it("keeps decimal bounds as strings so precision cannot be lost", () => {
    const chips = describeFilters(
      filters,
      { amount: { kind: "numericRange", min: "9007199254740993.15" } },
      format,
    );
    expect(chips[0].text).toBe("Amount: 9007199254740993.15");
  });
});

describe("normalizeFilterValue", () => {
  it("clears an emptied multi-select rather than leaving a chip-less filter", () => {
    expect(normalizeFilterValue({ kind: "multiSelect", values: [] })).toBeUndefined();
  });

  it("clears an empty range in both directions", () => {
    expect(normalizeFilterValue({ kind: "dateRange" })).toBeUndefined();
    expect(normalizeFilterValue({ kind: "numericRange" })).toBeUndefined();
  });

  it("keeps a half-open range, which is a real filter", () => {
    expect(normalizeFilterValue({ kind: "numericRange", min: "10" })).toEqual({
      kind: "numericRange",
      min: "10",
    });
  });
});

describe("FilterBar", () => {
  it("renders a control for every filter kind", () => {
    renderBar();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stage" })).toBeInTheDocument();
    expect(screen.getByLabelText("Min")).toBeInTheDocument();
    expect(screen.getByLabelText("Max")).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("writes a numeric bound back as a STRING", () => {
    const onChange = vi.fn();
    renderBar({ onChange });
    fireEvent.change(screen.getByLabelText("Min"), { target: { value: "250.75" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ amount: { kind: "numericRange", min: "250.75", max: undefined } }),
    );
  });

  it("clears a boolean filter when it is switched off, rather than storing false", () => {
    const onChange = vi.fn();
    renderBar({ values: { archived: { kind: "boolean", value: true } }, onChange });
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ archived: undefined }));
  });

  it("collapses chips past maxVisibleChips behind a BUTTON, never a static count", () => {
    renderBar({
      maxVisibleChips: 2,
      values: { stage: { kind: "multiSelect", values: ["new", "qualified", "won"] } },
    });
    const overflow = screen.getByRole("button", { name: "+1" });
    expect(overflow.tagName).toBe("BUTTON");
  });

  it("keeps overflowed chips removable inside that popover", () => {
    const onChange = vi.fn();
    renderBar({
      maxVisibleChips: 2,
      values: { stage: { kind: "multiSelect", values: ["new", "qualified", "won"] } },
      onChange,
    });
    fireEvent.click(screen.getByRole("button", { name: "+1" }));
    expect(screen.getByText("More filters")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Stage: Won" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ stage: { kind: "multiSelect", values: ["new", "qualified"] } }),
    );
  });

  it("removes a visible chip from its own control", () => {
    const onChange = vi.fn();
    renderBar({ values: { status: { kind: "select", value: "OPEN" } }, onChange });
    fireEvent.click(screen.getByRole("button", { name: "Remove Status: Open" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });

  it("shows Clear all only once something is filtering", () => {
    const { unmount } = renderBar();
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    unmount();
    renderBar({ values: { status: { kind: "select", value: "OPEN" } } });
    expect(screen.getByRole("button", { name: "Clear all" })).toBeInTheDocument();
  });

  it("debounces search before calling back", () => {
    vi.useFakeTimers();
    const onSearchChange = vi.fn();
    renderBar({ onSearchChange });
    fireEvent.change(screen.getByPlaceholderText("Search"), { target: { value: "acme" } });
    expect(onSearchChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onSearchChange).toHaveBeenCalledWith("acme");
    vi.useRealTimers();
  });
});

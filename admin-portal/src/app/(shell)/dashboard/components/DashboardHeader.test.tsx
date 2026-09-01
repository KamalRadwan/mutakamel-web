// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardHeader } from "./DashboardHeader";
import { resolvePreset } from "../utils/date-range-presets";

vi.mock("@/i18n/I18nContext", async () => {
  const { en } = await import("@/i18n/dictionaries/en");
  return { useI18n: () => ({ lang: "en", dir: "ltr", t: en }) };
});

const TODAY = resolvePreset("today", new Date())!;

function renderHeader(range = TODAY) {
  const onRangeChange = vi.fn();
  render(
    <DashboardHeader
      isRefreshing={false}
      onRefresh={vi.fn()}
      range={range}
      onRangeChange={onRangeChange}
    />,
  );
  return { onRangeChange };
}

function openPicker() {
  fireEvent.click(screen.getByRole("button", { name: /Reporting window/ }));
}

describe("DashboardHeader range picker", () => {
  it("names the current window on the trigger", () => {
    renderHeader();
    expect(
      screen.getByRole("button", { name: /Reporting window: Today/ }),
    ).toBeInTheDocument();
  });

  it("shows the dates themselves when the window matches no preset", () => {
    renderHeader({
      from: new Date(2026, 8, 3),
      to: new Date(2026, 8, 9, 23, 59, 59, 999),
    });
    expect(
      screen.getByRole("button", {
        name: /Reporting window: Sep 3, 2026 — Sep 9, 2026/,
      }),
    ).toBeInTheDocument();
  });

  it("offers every named window once opened", () => {
    renderHeader();
    openPicker();

    for (const name of [
      "Today",
      "Yesterday",
      "This month",
      "Last month",
      "This year",
      "Last year",
      "1st quarter",
      "2nd quarter",
      "3rd quarter",
      "4th quarter",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("marks the active preset pressed, and only that one", () => {
    renderHeader();
    openPicker();

    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Last month" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("emits a whole-day range when a preset is chosen", () => {
    const { onRangeChange } = renderHeader();
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: "Yesterday" }));

    expect(onRangeChange).toHaveBeenCalledTimes(1);
    const [range] = onRangeChange.mock.calls[0];
    expect(range.to.getTime() - range.from.getTime()).toBe(86_400_000 - 1);
  });

  it("carries a from and to time for the window", () => {
    renderHeader();
    openPicker();

    expect(screen.getByLabelText("From time")).toHaveValue("00:00");
    expect(screen.getByLabelText("To time")).toHaveValue("23:59");
  });

  it("renders a full six-week grid", () => {
    renderHeader();
    openPicker();

    const grid = screen.getByRole("grid", { name: "Choose a date range" });
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(42);
  });

  it("applies a two-click range", () => {
    const { onRangeChange } = renderHeader();
    openPicker();

    const grid = screen.getByRole("grid", { name: "Choose a date range" });
    const cells = within(grid).getAllByRole("gridcell");
    fireEvent.click(cells[10]);
    fireEvent.click(cells[16]);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onRangeChange).toHaveBeenCalledTimes(1);
    const [range] = onRangeChange.mock.calls[0];
    expect(range.from.getTime()).toBeLessThan(range.to.getTime());
  });

  it("discards a half-made selection when cancelled", () => {
    const { onRangeChange } = renderHeader();
    openPicker();

    const grid = screen.getByRole("grid", { name: "Choose a date range" });
    fireEvent.click(within(grid).getAllByRole("gridcell")[3]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onRangeChange).not.toHaveBeenCalled();
  });
});

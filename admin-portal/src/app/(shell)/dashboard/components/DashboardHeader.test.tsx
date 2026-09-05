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
      "Maximum",
    ]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("marks the committed preset pressed when first opened", () => {
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

  it("stages a preset without committing it, so the panel stays open", () => {
    const { onRangeChange } = renderHeader();
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: "Yesterday" }));

    // Nothing reloads yet — the reader may still narrow the hours.
    expect(onRangeChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Yesterday" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("commits the staged preset on Apply", () => {
    const { onRangeChange } = renderHeader();
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: "Yesterday" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onRangeChange).toHaveBeenCalledTimes(1);
    const [range] = onRangeChange.mock.calls[0];
    expect(range.to.getTime() - range.from.getTime()).toBe(86_400_000 - 1);
  });

  it("reaches back to 2000 for the maximum window", () => {
    const { onRangeChange } = renderHeader();
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: "Maximum" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const [range] = onRangeChange.mock.calls[0];
    expect(range.from.getFullYear()).toBe(2000);
    expect(range.from.getMonth()).toBe(0);
    expect(range.from.getDate()).toBe(1);
  });

  it("abandons a staged preset when cancelled", () => {
    const { onRangeChange } = renderHeader();
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: "Last month" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onRangeChange).not.toHaveBeenCalled();
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

  /**
   * FE-B11. The second click round-tripped both endpoints through the `HH:mm`
   * time inputs, which cannot hold seconds, so the inclusive end of day came
   * back as 23:59:00.000. The window the dashboard then requested was 59.999
   * seconds short of the days the operator had clicked, and the same dates
   * reported fewer records than the equivalent named preset.
   */
  it("ends a two-click range on the last millisecond of the final day", () => {
    // September 2026 opens on Sunday 30 August, so cell 4 is the 3rd and cell
    // 10 the 9th. Pinning the month keeps the instants below literal.
    const { onRangeChange } = renderHeader({
      from: new Date(2026, 8, 3),
      to: new Date(2026, 8, 9, 23, 59, 59, 999),
    });
    openPicker();

    const grid = screen.getByRole("grid", { name: "Choose a date range" });
    const cells = within(grid).getAllByRole("gridcell");
    fireEvent.click(cells[4]);
    fireEvent.click(cells[10]);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const [range] = onRangeChange.mock.calls[0];
    expect(range.from.getTime()).toBe(new Date(2026, 8, 3, 0, 0, 0, 0).getTime());
    expect(range.to.getTime()).toBe(new Date(2026, 8, 9, 23, 59, 59, 999).getTime());
  });

  it("keeps a chosen time of day across the second click", () => {
    const { onRangeChange } = renderHeader({
      from: new Date(2026, 8, 3),
      to: new Date(2026, 8, 9, 23, 59, 59, 999),
    });
    openPicker();

    const grid = screen.getByRole("grid", { name: "Choose a date range" });
    const cells = within(grid).getAllByRole("gridcell");
    fireEvent.click(cells[4]);
    fireEvent.change(screen.getByLabelText("To time"), {
      target: { value: "11:30" },
    });
    fireEvent.click(cells[10]);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const [range] = onRangeChange.mock.calls[0];
    expect(range.to.getTime()).toBe(new Date(2026, 8, 9, 11, 30, 0, 0).getTime());
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

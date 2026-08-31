// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Calendar } from "./Calendar";

afterEach(cleanup);

const MARCH_2026 = new Date(2026, 2, 15);

describe("Calendar", () => {
  it("renders a native table grid, which is what makes it work with no stylesheet", () => {
    const { container } = render(<Calendar mode="single" month={MARCH_2026} />);
    expect(container.querySelector("table")).not.toBeNull();
    expect(screen.getAllByRole("gridcell").length).toBeGreaterThan(27);
  });

  it("styles every structural element from design-system classes, not rdp-* defaults", () => {
    const { container } = render(<Calendar mode="single" month={MARCH_2026} />);
    const grid = container.querySelector("table");
    // If the stylesheet were ever imported instead, these would be `rdp-*`.
    expect(grid?.className).toContain("border-collapse");
    expect(container.querySelector("tbody button")?.className).toContain("rounded-sm");
  });

  it("renders Arabic month names with Western digits", () => {
    render(<Calendar mode="single" month={MARCH_2026} language="ar" />);
    // ar-EG month name for March, and Latin — not Arabic-Indic — year digits.
    expect(screen.getByText(/مارس/)).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/٢٠٢٦/)).toBeNull();
  });

  it("marks a selected day and leaves the rest unselected", () => {
    render(<Calendar mode="single" month={MARCH_2026} selected={new Date(2026, 2, 15)} />);
    const selected = screen.getAllByRole("gridcell").filter((cell) => cell.className.includes("bg-primary"));
    expect(selected).toHaveLength(1);
  });
});

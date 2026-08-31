// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardHeader } from "./DashboardHeader";

vi.mock("@/i18n/I18nContext", async () => {
  const { en } = await import("@/i18n/dictionaries/en");
  return { useI18n: () => ({ lang: "en", dir: "ltr", t: en }) };
});

describe("DashboardHeader", () => {
  it("exposes the localized date presets as a named pressed-state group", () => {
    const onRangeChange = vi.fn();
    render(
      <DashboardHeader
        isRefreshing={false}
        onRefresh={vi.fn()}
        rangePreset="lastMonth"
        onRangeChange={onRangeChange}
      />,
    );

    expect(
      screen.getByRole("group", { name: "Dashboard date range" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "This Month" }))
      .toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Last Month" }))
      .toHaveAttribute("aria-pressed", "true");
    const custom = screen.getByRole("button", { name: "Custom" });
    expect(custom).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(custom);
    expect(onRangeChange).toHaveBeenCalledWith("custom");
  });
});

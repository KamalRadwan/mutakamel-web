// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const i18n = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));

vi.mock("@/i18n/I18nContext", async () => {
  const { en } = await import("@/i18n/dictionaries/en");
  const { ar } = await import("@/i18n/dictionaries/ar");
  return {
    useI18n: () => ({
      lang: i18n.lang,
      dir: i18n.lang === "ar" ? "rtl" : "ltr",
      t: i18n.lang === "ar" ? ar : en,
    }),
  };
});

import { DashboardRefreshPauseControl } from "./DashboardRefreshPauseControl";
import { DashboardHeader } from "./DashboardHeader";

afterEach(() => {
  i18n.lang = "en";
});

const TODAY = {
  from: new Date("2026-09-01T00:00:00"),
  to: new Date("2026-09-01T23:59:59.999"),
};

describe("DashboardRefreshPauseControl", () => {
  it("offers an explicit pause and resume without hiding current data", () => {
    const onOperatorPausedChange = vi.fn();
    const { rerender } = render(
      <DashboardRefreshPauseControl
        interval="30s"
        isPaused={false}
        operatorPaused={false}
        pauseReasons={[]}
        onOperatorPausedChange={onOperatorPausedChange}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Auto-refresh active");
    fireEvent.click(
      screen.getByRole("button", { name: "Pause auto-refresh" }),
    );
    expect(onOperatorPausedChange).toHaveBeenLastCalledWith(true);

    rerender(
      <DashboardRefreshPauseControl
        interval="30s"
        isPaused
        operatorPaused
        pauseReasons={["operator"]}
        onOperatorPausedChange={onOperatorPausedChange}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Paused by you. Current dashboard data stays visible until you resume.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Resume auto-refresh" }),
    );
    expect(onOperatorPausedChange).toHaveBeenLastCalledWith(false);
  });

  it("explains automatic interaction pauses and lets the operator keep them paused", () => {
    const onOperatorPausedChange = vi.fn();
    render(
      <DashboardRefreshPauseControl
        interval="60s"
        isPaused
        operatorPaused={false}
        pauseReasons={["region-selection"]}
        onOperatorPausedChange={onOperatorPausedChange}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Paused while you interact with dashboard data and resumes automatically.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Keep auto-refresh paused" }),
    );
    expect(onOperatorPausedChange).toHaveBeenCalledWith(true);
  });
});

describe("DashboardHeader print fallback", () => {
  it("announces the exact-value fallback in both languages and enables retry", () => {
    const props = {
      isRefreshing: false,
      onRefresh: vi.fn(),
      range: TODAY,
      onRangeChange: vi.fn(),
      onPrintReport: vi.fn(),
      printFallbackReason: "charts-unavailable" as const,
    };
    const { rerender } = render(<DashboardHeader {...props} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Chart graphics could not be prepared",
    );
    expect(
      screen.getByRole("button", { name: "Export Executive PDF Report" }),
    ).toBeEnabled();

    i18n.lang = "ar";
    rerender(<DashboardHeader {...props} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "تعذّر تجهيز الرسومات البيانية",
    );
    expect(
      screen.getByRole("button", {
        name: "تصدير تقرير تنفيذي مطبوع (PDF)",
      }),
    ).toBeEnabled();
  });
});

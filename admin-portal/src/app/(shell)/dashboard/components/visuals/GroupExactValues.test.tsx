// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardGroup } from "@/types/dashboard";
import { en } from "@/i18n/dictionaries/en";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
  useOptionalI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

import { GroupExactValues } from "./GroupExactValues";

function group(snapshot: Record<string, unknown>): DashboardGroup {
  return {
    key: "billing",
    permission: "admin.reports.billing",
    available: true,
    asOf: "2026-09-05T00:00:00.000Z",
    snapshot,
    period: {},
    breakdowns: {},
    alerts: [],
    cards: [],
  } as unknown as DashboardGroup;
}

/**
 * FE-B14. This table is the dashboard's evidence — the print path renders the
 * same markup — and it is headed "All values". It nevertheless formatted every
 * measure with the approximate helpers written for axes and hover labels, so
 * an operator reconciling a report read $10 for 10.49 collected, two minutes
 * for a 90-second wait and 1.5 KB for 1,537 bytes, with nothing on screen to
 * say a number had been rounded.
 */
describe("GroupExactValues", () => {
  it("keeps the minor unit of a monetary fixed-point string", () => {
    render(<GroupExactValues group={group({ collectedUsd: "10.49" })} />);
    expect(screen.getByText("$10.49")).toBeInTheDocument();
  });

  it("reports a duration in seconds rather than rounding it to minutes", () => {
    render(<GroupExactValues group={group({ averageWaitSeconds: 90 })} />);
    expect(screen.getByText("90s")).toBeInTheDocument();
  });

  it("reports a size in bytes rather than a rounded multiple", () => {
    render(<GroupExactValues group={group({ storedBytes: 1537 })} />);
    expect(screen.getByText("1,537 B")).toBeInTheDocument();
  });

  it("does not clamp a ratio above one down to 100%", () => {
    render(<GroupExactValues group={group({ growthRate: 1.8 })} />);
    expect(screen.getByText("180%")).toBeInTheDocument();
  });

  it("still renders booleans and missing readings as words", () => {
    render(
      <GroupExactValues
        group={group({ dunningEnabled: true, lastRunAt: null })}
      />,
    );
    expect(screen.getByText(en.dashboard.yesLabel)).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

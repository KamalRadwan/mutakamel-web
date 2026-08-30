// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardResponse } from "@/types/dashboard";
import { en } from "@/i18n/dictionaries/en";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

import { DashboardTabsNav } from "./DashboardTabsNav";
import { getAuthorizedDashboardGroupKeys } from "../utils/dashboard-groups";

/**
 * A scoped (`?groups=`) response carries only the groups it loaded. The tab
 * bar must still offer every authorized group: a tab that is not rendered is
 * a tab whose data can never be requested.
 */
const scopedResponse = {
  authorizedGroups: [
    "tenants",
    "domains",
    "subscriptions",
    "billing",
    "payments",
    "wallets",
    "database",
    "storage",
    "provisioning",
    "catalogue",
    "notifications",
    "usage",
    "security",
    "audit",
  ],
  loadedGroups: ["storage"],
  storage: {
    key: "storage",
    permission: "admin.reports.storage",
    available: true,
    asOf: "2026-08-30T00:00:00.000Z",
    snapshot: {},
    period: {},
    breakdowns: {},
    alerts: [],
    cards: [],
    visuals: [],
  },
} as unknown as DashboardResponse;

describe("DashboardTabsNav", () => {
  it("renders a tab for every authorized group when only one is loaded", () => {
    render(
      <DashboardTabsNav
        activeTab="storage"
        onTabChange={() => {}}
        groups={getAuthorizedDashboardGroupKeys(scopedResponse)}
      />,
    );

    const list = screen.getByRole("tablist", {
      name: en.dashboard.groupsAriaLabel,
    });
    // 14 groups plus Overview.
    expect(within(list).getAllByRole("tab")).toHaveLength(15);
  });

  it("keeps the tabs an unscoped response would show", () => {
    const unscoped = {
      ...scopedResponse,
      loadedGroups: scopedResponse.authorizedGroups,
    } as DashboardResponse;

    expect(getAuthorizedDashboardGroupKeys(unscoped)).toEqual(
      getAuthorizedDashboardGroupKeys(scopedResponse),
    );
  });

  it("shows only Overview when the actor is authorized for nothing", () => {
    render(
      <DashboardTabsNav activeTab="overview" onTabChange={() => {}} groups={[]} />,
    );

    const list = screen.getByRole("tablist", {
      name: en.dashboard.groupsAriaLabel,
    });
    expect(within(list).getAllByRole("tab")).toHaveLength(1);
  });
});

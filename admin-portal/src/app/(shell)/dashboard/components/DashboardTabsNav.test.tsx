// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DashboardResponse } from "@/types/dashboard";
import { en } from "@/i18n/dictionaries/en";

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr", t: en }),
}));

import { DashboardTabsNav } from "./DashboardTabsNav";
import { authorizedSubjects } from "../utils/dashboard-subjects";

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
  it("renders a tab for every subject the actor may open", () => {
    render(
      <DashboardTabsNav
        activeTab="infrastructure"
        onTabChange={() => {}}
        subjects={authorizedSubjects(scopedResponse)}
      />,
    );

    const list = screen.getByRole("tablist", {
      name: en.dashboard.groupsAriaLabel,
    });
    // Five subjects plus Overview, where fourteen reports plus Overview used
    // to sit — the strip no longer scrolls past the edge of the screen.
    expect(within(list).getAllByRole("tab")).toHaveLength(6);
  });

  /**
   * A scoped response carries only the reports it loaded, but the tab bar
   * reads the *authorized* set — deriving it from what happened to arrive
   * would hide every subject the actor had not opened yet, which is also the
   * only way to load them.
   */
  it("keeps the subjects an unscoped response would show", () => {
    const unscoped = {
      ...scopedResponse,
      loadedGroups: scopedResponse.authorizedGroups,
    } as DashboardResponse;

    expect(authorizedSubjects(unscoped)).toEqual(
      authorizedSubjects(scopedResponse),
    );
  });

  /** A subject the actor holds no report inside is not offered at all. */
  it("offers only the subjects the actor holds a report inside", () => {
    const narrow = {
      authorizedGroups: ["billing", "audit"],
      loadedGroups: [],
    } as unknown as DashboardResponse;

    expect(authorizedSubjects(narrow)).toEqual(["revenue", "trust"]);
  });

  it("shows only Overview when the actor is authorized for nothing", () => {
    render(
      <DashboardTabsNav activeTab="overview" onTabChange={() => {}} subjects={[]} />,
    );

    const list = screen.getByRole("tablist", {
      name: en.dashboard.groupsAriaLabel,
    });
    expect(within(list).getAllByRole("tab")).toHaveLength(1);
  });
});

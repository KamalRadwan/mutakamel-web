// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import OpportunitiesPage from "./page";

const session = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: session.permissions } }),
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/design-system", async () => ({
  ...(await import("@/design-system/patterns/permission-gate/PermissionGate")),
}));
vi.mock("./components/opportunities-workspace", () => ({
  OpportunitiesWorkspace: () => <p>Opportunities workspace</p>,
}));
afterEach(cleanup);

describe("Opportunity route permission pair", () => {
  it.each([
    { permissions: ["crm.opportunities.read.own"] },
    { permissions: ["crm.pipelines.read"] },
    { permissions: [] },
  ])("denies an incomplete permission pair: %j", ({ permissions }) => {
    session.permissions = permissions;
    render(<OpportunitiesPage />);
    expect(screen.getByText(en.permissionGate.title)).toBeTruthy();
    expect(screen.queryByText("Opportunities workspace")).toBeNull();
  });

  it("admits scoped opportunity readers with pipeline read access", () => {
    session.permissions = ["crm.opportunities.read.team", "crm.pipelines.read"];
    render(<OpportunitiesPage />);
    expect(screen.getByText("Opportunities workspace")).toBeTruthy();
  });
});

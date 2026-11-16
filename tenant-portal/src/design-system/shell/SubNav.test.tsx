// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { CORE_IDENTITY_NAV_ITEMS } from "./nav-config";
import { SubNav } from "./SubNav";

const state = vi.hoisted(() => ({ path: "/core/organization" }));
vi.mock("next/navigation", () => ({ usePathname: () => state.path }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { permissions: [] } }),
}));
afterEach(cleanup);

describe("SubNav current destination", () => {
  it.each([
    ["/core/organization", "Organization"],
    ["/core/organization/companies", "Companies"],
    ["/core/organization/companies/record", "Companies"],
    ["/core/organization/branches/record", "Branches"],
  ])("marks exactly one destination on %s", (path, name) => {
    state.path = path;
    render(<SubNav items={CORE_IDENTITY_NAV_ITEMS.map(item => ({ ...item, hasAccess: () => true }))} />);
    const current = screen.getAllByRole("link").filter(link => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(name);
  });

  it("does not match a route outside the destination's path segment", () => {
    state.path = "/core/organization-archive";
    render(<SubNav items={CORE_IDENTITY_NAV_ITEMS.map(item => ({ ...item, hasAccess: () => true }))} />);
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
  });

  it("keeps unauthorized destinations out of the navigation", () => {
    state.path = "/core/users";
    render(<SubNav items={CORE_IDENTITY_NAV_ITEMS.map(item => ({
      ...item, hasAccess: () => item.id !== "coreCompanies",
    }))} />);
    expect(screen.queryByRole("link", { name: "Companies" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Users" })).toHaveAttribute("aria-current", "page");
  });
});

/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar } from "./Sidebar";

/**
 * FE-C01. The sidebar brand is the one link that is always visible, on desktop
 * and mobile alike, and it hard-coded `/dashboard`. That route is gated on
 * `admin.reports.read`, so staff without it could reach every area they are
 * permitted to and still be sent to a denied page by the link that never goes
 * away. `useNavTree` already resolves a permission-aware `homeHref` for exactly
 * this, and the topbar brand already used it.
 *
 * The test drives the real `useNavTree` against a real permission set; mocking
 * the hook would only assert the mock.
 */

const authState = vi.hoisted(() => ({
  user: { isSuperAdmin: false, permissions: [] as string[] },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/tenants",
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: authState.user }),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en" }),
}));

function brandHref(): string | null {
  // The brand is the first link in the sidebar header, above the nav list.
  const [brand] = screen.getAllByRole("link");
  return brand?.getAttribute("href") ?? null;
}

describe("sidebar brand link", () => {
  beforeEach(() => {
    authState.user = { isSuperAdmin: false, permissions: [] };
  });

  afterEach(cleanup);

  it("goes to the dashboard when the staff member may read reports", () => {
    authState.user = {
      isSuperAdmin: false,
      permissions: ["admin.reports.read", "admin.tenants.read"],
    };

    render(<Sidebar collapsed={false} onToggleCollapse={vi.fn()} />);

    expect(brandHref()).toBe("/dashboard");
  });

  it("does not send a staff member without report access to the dashboard", () => {
    authState.user = {
      isSuperAdmin: false,
      permissions: ["admin.tenants.read"],
    };

    render(<Sidebar collapsed={false} onToggleCollapse={vi.fn()} />);

    expect(brandHref()).toBe("/tenants");
  });

  it("falls back past tenants for a staff member limited to the catalogue", () => {
    authState.user = {
      isSuperAdmin: false,
      permissions: ["admin.applications.read"],
    };

    render(<Sidebar collapsed={false} onToggleCollapse={vi.fn()} />);

    expect(brandHref()).toBe("/applications-catalogue");
  });

  it("uses the same target on mobile, where the brand is equally permanent", () => {
    authState.user = {
      isSuperAdmin: false,
      permissions: ["admin.tenants.read"],
    };

    render(
      <Sidebar collapsed={false} onToggleCollapse={vi.fn()} variant="mobile" />,
    );

    expect(brandHref()).toBe("/tenants");
  });
});

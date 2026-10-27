/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsSidebar } from "./SettingsSidebar";

const state = vi.hoisted(() => ({
  user: { isSuperAdmin: false, permissions: [] as string[] },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => state }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { settings: { pageTitle: "Settings" } } }),
}));
vi.mock("@/design-system", async () => {
  const { SETTINGS_SUBNAV } = await import("@/design-system/shell/nav-config");
  return {
    SETTINGS_SUBNAV,
    SubNav: ({ items }: { items: { href: string; labelKey: { en: string } }[] }) => (
      <nav>{items.map((item) => <a key={item.href} href={item.href}>{item.labelKey.en}</a>)}</nav>
    ),
  };
});

describe("SettingsSidebar permissions", () => {
  afterEach(cleanup);

  it.each([
    { permissions: [], count: 0 },
    { permissions: ["admin.settings.update"], count: 0 },
    { permissions: ["admin.settings.read"], count: 8 },
    { permissions: ["admin.provisioning.publisher-keys.read"], count: 1 },
    { permissions: ["admin.settings.read", "admin.provisioning.publisher-keys.read"], count: 9 },
  ])("shows only permitted links for $permissions", ({ permissions, count }) => {
    state.user = { isSuperAdmin: false, permissions };
    render(<SettingsSidebar />);
    expect(screen.queryAllByRole("link")).toHaveLength(count);
    expect(Boolean(screen.queryByRole("link", { name: "Worker Messages" })))
      .toBe(permissions.includes("admin.provisioning.publisher-keys.read"));
    if (permissions.includes("admin.settings.read")) {
      expect(screen.getAllByRole("link").slice(0, 8).map((link) => link.getAttribute("href")))
        .toEqual(["/settings/platform", "/settings/auth", "/settings/billing", "/settings/notifications",
          "/settings/webphone", "/settings/smtp", "/settings/fatal-alerts", "/settings/storage"]);
    }
  });

  it("shows every link to super admins", () => {
    state.user = { isSuperAdmin: true, permissions: [] };
    render(<SettingsSidebar />);
    expect(screen.getAllByRole("link")).toHaveLength(9);
  });
});

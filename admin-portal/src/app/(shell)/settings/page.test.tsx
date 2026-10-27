/* @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsIndexPage from "./page";

const state = vi.hoisted(() => ({
  user: { isSuperAdmin: false, permissions: [] as string[] },
  isLoading: false,
  redirect: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => state }));
vi.mock("next/navigation", () => ({ redirect: state.redirect }));
vi.mock("@/design-system", async () => {
  const { SETTINGS_SUBNAV } = await import("@/design-system/shell/nav-config");
  return { SETTINGS_SUBNAV };
});

describe("settings index redirect", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it.each([
    { permissions: [], target: "/profile" },
    { permissions: ["admin.settings.update"], target: "/profile" },
    { permissions: ["admin.settings.read"], target: "/settings/platform" },
    { permissions: ["admin.provisioning.publisher-keys.read"], target: "/settings/worker-events" },
    { permissions: ["admin.settings.read", "admin.provisioning.publisher-keys.read"], target: "/settings/platform" },
  ])("chooses $target for $permissions", ({ permissions, target }) => {
    state.user = { isSuperAdmin: false, permissions };
    state.isLoading = false;
    render(<SettingsIndexPage />);
    expect(state.redirect).toHaveBeenCalledWith(target);
  });

  it("waits for auth bootstrap before choosing a destination", () => {
    state.user = { isSuperAdmin: false, permissions: [] };
    state.isLoading = true;
    const view = render(<SettingsIndexPage />);
    expect(state.redirect).not.toHaveBeenCalled();
    state.isLoading = false;
    state.user.permissions = ["admin.settings.read"];
    view.rerender(<SettingsIndexPage />);
    expect(state.redirect).toHaveBeenCalledWith("/settings/platform");
  });
});

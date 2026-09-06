// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGuard, isPublicAdminAuthPath } from "./AuthGuard";

const state = vi.hoisted(() => ({
  pathname: "/admin/accept-invite",
  push: vi.fn(),
  auth: {
    authState: "BOOTSTRAPPING",
    isAuthenticated: false,
    isLoading: true,
    retryBootstrap: vi.fn(),
    bootstrapFailure: null,
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ push: state.push }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => state.auth,
  isPendingAuthState: (authState: string) =>
    ["BOOTSTRAPPING", "STALE", "REFRESHING"].includes(authState),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: {
      common: {
        sessionChecking: "Checking your session...",
        sessionUnavailable: "Session unavailable",
        retry: "Retry",
      },
    },
  }),
}));

describe("AuthGuard public one-time action routes", () => {
  beforeEach(() => {
    state.pathname = "/admin/accept-invite";
    state.push.mockReset();
    state.auth.authState = "BOOTSTRAPPING";
    state.auth.isAuthenticated = false;
    state.auth.isLoading = true;
  });

  afterEach(cleanup);

  it("mounts accept-invite and reset-password while auth bootstrap is pending", () => {
    const view = render(
      <AuthGuard><div>public-action</div></AuthGuard>,
    );
    expect(screen.getByText("public-action")).toBeInTheDocument();
    expect(state.push).not.toHaveBeenCalled();

    state.pathname = "/admin/reset-password/";
    view.rerender(<AuthGuard><div>public-action</div></AuthGuard>);
    expect(screen.getByText("public-action")).toBeInTheDocument();
    expect(state.push).not.toHaveBeenCalled();
  });

  it("does not treat a prefix-spoofed path as public", async () => {
    state.pathname = "/admin/reset-password-attacker";
    state.auth.authState = "UNAUTHENTICATED";
    state.auth.isLoading = false;
    render(<AuthGuard><div>protected-content</div></AuthGuard>);

    expect(screen.queryByText("protected-content")).toBeNull();
    await waitFor(() => expect(state.push).toHaveBeenCalledWith("/login"));
  });

  it("recognizes only the explicit public auth path set", () => {
    expect(isPublicAdminAuthPath("/login")).toBe(true);
    expect(isPublicAdminAuthPath("/admin/accept-invite///")).toBe(true);
    expect(isPublicAdminAuthPath("/admin/reset-password")).toBe(true);
    expect(isPublicAdminAuthPath("/admin/accept-invite/extra")).toBe(false);
    expect(isPublicAdminAuthPath("/settings/auth")).toBe(false);
  });
});

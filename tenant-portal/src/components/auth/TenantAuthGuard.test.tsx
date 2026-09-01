// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import type { TenantAuthState } from "@/context/AuthContext";
import { TenantAuthGuard } from "./TenantAuthGuard";

// `useTenantAuth` cannot produce an ENDED state with an arbitrary code — the
// classifier only reaches "end" for one of the seven session-ending codes — so
// the guard's own validation is only reachable through a stubbed context. That
// is precisely why it is worth testing: it is the check that stops a code the
// transport never produced from being written into a URL.
const state = vi.hoisted(() => ({
  pathname: "/crm/leads",
  authState: "ENDED" as TenantAuthState,
  endedReason: null as string | null,
  isLoading: false,
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: state.replace, push: vi.fn() }),
  usePathname: () => state.pathname,
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({
    authState: state.authState,
    endedReason: state.endedReason,
    isAuthenticated: false,
    isLoading: state.isLoading,
    retryBootstrap: async () => {},
  }),
}));

afterEach(() => {
  cleanup();
  state.pathname = "/crm/leads";
  state.authState = "ENDED";
  state.endedReason = null;
  state.isLoading = false;
  state.replace.mockReset();
});

function renderGuard() {
  render(
    <I18nProvider>
      <TenantAuthGuard>
        <p>screen</p>
      </TenantAuthGuard>
    </I18nProvider>,
  );
}

// The session spinner REPLACES its children, so rendering it over a public page
// unmounts that page and destroys every useState in it.
//
// That is not theoretical. `AuthContext.login()` sets BOOTSTRAPPING before the
// request, so pressing sign-in swapped the form for the spinner; the 401 then
// set `failure` on a component that no longer existed, and the form returned
// freshly mounted with no error and an empty email field. Driven in a real
// browser: with the guard swapping, a failed sign-in left `[role=alert]` empty
// and the typed email cleared; with it not swapping, the failure banner
// rendered and the email survived.
describe("TenantAuthGuard does not unmount a public page while auth is in flight", () => {
  it("keeps a public page mounted", () => {
    state.pathname = "/login";
    state.authState = "BOOTSTRAPPING";
    state.isLoading = true;
    renderGuard();

    expect(screen.getByText("screen")).toBeTruthy();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  // The control: on a private page the spinner is still the right answer, and
  // if this ever stops passing the fix has been over-applied.
  it("still shows the spinner on a private page", () => {
    state.pathname = "/crm/leads";
    state.authState = "BOOTSTRAPPING";
    state.isLoading = true;
    renderGuard();

    expect(screen.queryByText("screen")).toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});

// MASTER-PLAN 13.7, closing the first half of OPEN-QUESTIONS.md Q18.
describe("TenantAuthGuard session-ending reason", () => {
  it.each([
    "AUTH_SESSION_ENDED",
    "AUTH_SESSION_IDLE_EXPIRED",
    "AUTH_SESSION_ABSOLUTE_EXPIRED",
    "AUTH_SECURITY_STALE",
    "AUTH_SESSION_STALE",
    "SESSION_IDENTITY_INACTIVE",
    "INVALID_REFRESH_TOKEN",
  ])("carries %s through to the screen that renders it", async (code) => {
    state.endedReason = code;
    renderGuard();

    await waitFor(() =>
      expect(state.replace).toHaveBeenCalledWith(
        `/session-expired?reason=${code}`,
      ),
    );
  });

  it("sends no reason when the session ended without one", async () => {
    renderGuard();

    await waitFor(() =>
      expect(state.replace).toHaveBeenCalledWith("/session-expired"),
    );
  });

  // The gate. A code outside the transport's own set never reaches the URL,
  // so a message can never be selected by one.
  it.each([
    "NOT_A_REAL_CODE",
    "auth_session_ended",
    "__proto__",
    "AUTH_SESSION_ENDED&reason=AUTH_SECURITY_STALE",
  ])("refuses %j as a reason", async (code) => {
    state.endedReason = code;
    renderGuard();

    await waitFor(() =>
      expect(state.replace).toHaveBeenCalledWith("/session-expired"),
    );
  });

  // The destination itself is unchanged, and stays unchanged: a visitor who
  // never signed in is not a session that ended.
  it("still sends an unauthenticated visitor to the sign-in form", async () => {
    state.authState = "UNAUTHENTICATED";
    state.endedReason = "AUTH_SESSION_ENDED";
    renderGuard();

    await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/login"));
  });

  it("redirects nothing away from a public path", async () => {
    state.pathname = "/session-expired";
    state.endedReason = "AUTH_SESSION_IDLE_EXPIRED";
    renderGuard();

    await waitFor(() => expect(state.replace).not.toHaveBeenCalled());
  });
});

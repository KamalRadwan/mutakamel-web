// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/design-system";
import { I18nProvider } from "@/i18n/I18nContext";
import { ar } from "@/i18n/dictionaries/ar";
import SessionExpiredPage from "./page";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

beforeEach(() => {
  searchParams.delete("reason");
  // jsdom ships no matchMedia, and ThemeProvider reads the system preference
  // through it. `light` keeps the assertions on copy, not on the theme.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

function renderPage(reason?: string) {
  if (reason !== undefined) searchParams.set("reason", reason);
  // Both providers come from FenceLayout → TenantPortalRuntime in the app;
  // FenceScreen carries the language and theme toggles because a user locked
  // out in the wrong language has no other way to change either.
  render(
    <ThemeProvider>
      <I18nProvider>
        <SessionExpiredPage />
      </I18nProvider>
    </ThemeProvider>,
  );
}

const copy = ar.coreIdentity.sessionExpired;

// MASTER-PLAN 13.7. The screen exists to say WHICH of the four terminal
// reasons applied; OPEN-QUESTIONS.md Q18 is why the code could not reach it
// until now.
describe("session expired reasons", () => {
  it.each([
    ["AUTH_SESSION_IDLE_EXPIRED", copy.reasons.idle],
    ["AUTH_SESSION_ABSOLUTE_EXPIRED", copy.reasons.absolute],
    ["AUTH_SESSION_ENDED", copy.reasons.ended],
    ["INVALID_REFRESH_TOKEN", copy.reasons.ended],
    ["AUTH_SECURITY_STALE", copy.reasons.security],
    ["AUTH_SESSION_STALE", copy.reasons.security],
  ])("renders the specific reason for %s", (code, message) => {
    renderPage(code);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByText(copy.unknownReasonHint)).toBeNull();
  });

  it("says only what it knows when no reason arrives", () => {
    renderPage();

    expect(screen.getByText(copy.description)).toBeInTheDocument();
    expect(screen.getByText(copy.unknownReasonHint)).toBeInTheDocument();
  });

  // The gate, and the reason it exists: `?reason=` is user-editable. Every one
  // of these must fall back to the generic copy rather than select a message —
  // and the last two are the shapes a lookup against a bare object would
  // wrongly resolve.
  it.each([
    "NOT_A_REAL_CODE",
    "",
    "auth_session_idle_expired",
    "AUTH_SESSION_IDLE_EXPIRED ",
    "constructor",
    "toString",
    "__proto__",
  ])("refuses %j as a reason", (code) => {
    renderPage(code);

    expect(screen.getByText(copy.description)).toBeInTheDocument();
    expect(screen.getByText(copy.unknownReasonHint)).toBeInTheDocument();
  });

  // A session-ending code that is deliberately NOT one of the four: an inactive
  // identity is an account state and has its own screen. It must not borrow an
  // expiry message it does not deserve.
  it("falls back for SESSION_IDENTITY_INACTIVE, which this screen does not speak for", () => {
    renderPage("SESSION_IDENTITY_INACTIVE");

    expect(screen.getByText(copy.description)).toBeInTheDocument();
    expect(screen.getByText(copy.unknownReasonHint)).toBeInTheDocument();
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nContext";
import { ar } from "@/i18n/dictionaries/ar";
import { ThemeProvider } from "@/design-system";
import LoginPage from "./page";

// ThemeToggle resolves the system theme through matchMedia and the Radix
// Checkbox measures itself through ResizeObserver; jsdom implements neither.
// The stubs only have to exist — nothing here asserts on theme or measurement.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

vi.mock("./hooks/useLogin", () => ({
  useLogin: () => ({
    t: ar,
    email: "",
    setEmail: () => undefined,
    password: "",
    setPassword: () => undefined,
    rememberMe: true,
    showPassword: false,
    isSubmitting: false,
    isForgotModalOpen: false,
    setIsForgotModalOpen: () => undefined,
    openForgotModal: () => undefined,
    resetEmail: "",
    setResetEmail: () => undefined,
    failure: undefined,
    failureKind: undefined,
    toggleShowPassword: () => undefined,
    toggleRememberMe: () => undefined,
    handleSubmit: () => undefined,
    handleForgotPassword: () => undefined,
  }),
}));

afterEach(cleanup);

// U3 — the password `Field` wraps `<div className="relative">` so the reveal
// button can be positioned over the input. `Field` used to clone its id onto
// that DIRECT child, so the id landed on the div and the password control had
// no accessible name at all. The email field above it, with no wrapper, was
// bound correctly — which is the contrast that made it visible.
describe("Login page field wiring", () => {
  // Anchored: the reveal button is named "إظهار كلمة المرور", which CONTAINS
  // the field's own label, so an unanchored match finds both.
  const named = (label: string) => new RegExp(`^${label}`);

  function renderPage() {
    render(
      <I18nProvider>
        <ThemeProvider>
          <LoginPage />
        </ThemeProvider>
      </I18nProvider>,
    );
  }

  it("gives the password input its label as an accessible name", () => {
    renderPage();

    const password = screen.getByLabelText(named(ar.auth.passwordLabel));
    expect(password).toBeInstanceOf(HTMLInputElement);
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("name", "password");
  });

  it("binds the email field the same way, so both are reachable by name", () => {
    renderPage();

    const email = screen.getByLabelText(named(ar.auth.emailLabel));
    expect(email).toHaveAttribute("type", "email");
  });

  // The reveal button sits inside the same wrapper. It names the ACTION, not
  // the field, and it must not be what the field's label points at.
  it("leaves the reveal toggle named for what it does", () => {
    renderPage();

    const toggle = screen.getByRole("button", { name: ar.auth.showPassword });
    expect(toggle).toHaveAttribute("type", "button");
    expect(toggle).not.toBe(screen.getByLabelText(named(ar.auth.passwordLabel)));
  });

  it("keeps both credential fields inside one real form, for password managers", () => {
    renderPage();

    const form = screen.getByLabelText(named(ar.auth.passwordLabel)).closest("form");
    expect(form).not.toBeNull();
    expect(form).toContainElement(screen.getByLabelText(named(ar.auth.emailLabel)));
    expect(form).toHaveAttribute("method", "post");
  });
});

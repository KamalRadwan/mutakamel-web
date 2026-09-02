// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/design-system";
import { I18nProvider } from "@/i18n/I18nContext";
import { ar } from "@/i18n/dictionaries/ar";
import { ActionTokenScreen } from "./ActionTokenScreen";

// ThemeToggle resolves the system theme through matchMedia, which jsdom does
// not implement. Nothing here asserts on the theme.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

vi.mock("../hooks/useActionTokenPassword", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../hooks/useActionTokenPassword")>();
  const { ar: dictionary } = await import("@/i18n/dictionaries/ar");
  return {
    ...original,
    useActionTokenPassword: () => ({
      t: dictionary,
      state: "ready" as const,
      error: undefined,
      newPassword: "",
      setNewPassword: () => undefined,
      confirmPassword: "",
      setConfirmPassword: () => undefined,
      showPassword: false,
      toggleShowPassword: () => undefined,
      isPasswordValid: false,
      isConfirmed: false,
      submit: async () => undefined,
    }),
  };
});

afterEach(cleanup);

// U3, second call site. Same shape as /login: the `Field` wraps a positioning
// `<div className="relative">` so the reveal button can sit over the input, and
// the cloned id used to land on that div. The confirm field below it, with no
// wrapper, was bound correctly — the contrast that made the defect visible.
describe("ActionTokenScreen field wiring", () => {
  // Anchored: "إظهار كلمة المرور" on the reveal button CONTAINS the label.
  const named = (label: string) => new RegExp(`^${label}`);
  const copy = ar.coreIdentity.actionToken;

  function renderScreen() {
    render(
      <I18nProvider>
        <ThemeProvider>
          <ActionTokenScreen flow="reset-password" />
        </ThemeProvider>
      </I18nProvider>,
    );
  }

  it("gives the new-password input its label as an accessible name", () => {
    renderScreen();

    const password = screen.getByLabelText(named(copy.newPassword));
    expect(password).toBeInstanceOf(HTMLInputElement);
    expect(password).toHaveAttribute("name", "new-password");
    expect(password).toHaveAttribute("aria-required", "true");
  });

  it("describes the new-password input by its policy hint", () => {
    renderScreen();

    const password = screen.getByLabelText(named(copy.newPassword));
    const describedBy = password.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)).toHaveTextContent(copy.passwordPolicy);
  });

  it("binds the confirm field the same way, so both are reachable by name", () => {
    renderScreen();

    expect(screen.getByLabelText(named(copy.confirmPassword))).toHaveAttribute(
      "name",
      "confirm-password",
    );
  });
});

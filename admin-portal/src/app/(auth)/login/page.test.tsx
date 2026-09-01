// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

vi.mock("@/components/auth/AuthShell", () => ({
  AuthShell: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("./hooks/useLogin", async () => {
  const { en } = await import("@/i18n/dictionaries/en");
  const ref = () => ({ current: null });
  return {
    useLogin: () => ({
      t: en,
      email: "admin@example.com",
      setEmail: vi.fn(),
      password: "",
      setPassword: vi.fn(),
      rememberMe: false,
      showPassword: false,
      isSubmitting: false,
      error: null,
      fieldErrors: {},
      forgotFieldError: null,
      forgotError: null,
      emailInputRef: ref(),
      passwordInputRef: ref(),
      errorSummaryRef: ref(),
      submissionErrorRef: ref(),
      forgotEmailInputRef: ref(),
      forgotErrorRef: ref(),
      isForgotModalOpen: true,
      setIsForgotModalOpen: vi.fn(),
      toggleShowPassword: vi.fn(),
      toggleRememberMe: vi.fn(),
      handleSubmit: vi.fn(),
      handleForgotPassword: vi.fn(),
    }),
  };
});

describe("LoginPage forgot-password dialog", () => {
  afterEach(cleanup);

  it("keeps login and recovery credentials out of native GET submissions", async () => {
    render(<LoginPage />);
    await screen.findByRole("dialog", { name: "Forgot Password?" });

    const credentials = document.querySelectorAll<HTMLInputElement>(
      'input[name="email"], input[name="password"]',
    );
    expect(credentials).toHaveLength(3);
    for (const input of credentials) {
      expect(input.form?.method).toBe("post");
    }
  });

  it("programmatically associates the visible description with the dialog", async () => {
    render(<LoginPage />);

    const dialog = await screen.findByRole("dialog", { name: "Forgot Password?" });
    const descriptionId = dialog.getAttribute("aria-describedby");

    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)).toHaveTextContent(
      "A password reset link will be sent to your email address.",
    );
  });
});

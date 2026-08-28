// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLogin } from "./useLogin";

const postMock = vi.fn().mockResolvedValue(undefined);
const loginMock = vi.fn().mockResolvedValue(undefined);
const toastMock = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), errorFromApi: vi.fn() };

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { post: (...args: unknown[]) => postMock(...args) },
}));

vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ login: loginMock }),
}));

vi.mock("@/design-system", () => ({
  useToast: () => toastMock,
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: {
      auth: {
        signInSuccess: "Signed in",
        signInSuccessMessage: "ok",
        signInFailed: "Sign-in failed",
        invalidCredentials: "Invalid credentials.",
        resetLinkSent: "Reset link sent",
        resetLinkSentMessage: "ok",
        resetFailed: "Request failed",
        resetFailedMessage: "try again",
      },
    },
  }),
}));

function submitEvent() {
  return { preventDefault: vi.fn() } as unknown as React.FormEvent;
}

afterEach(() => {
  postMock.mockClear();
  loginMock.mockClear();
});

describe("useLogin — D1 (docs/build/DEFECTS.md#d1)", () => {
  it("sends the reset dialog's own bound address, not the login form's email", async () => {
    const { result } = renderHook(() => useLogin());

    act(() => result.current.setEmail("login-field@example.com"));
    act(() => result.current.setResetEmail("distinct-reset@example.com"));

    await act(async () => {
      await result.current.handleForgotPassword(submitEvent());
    });

    expect(postMock).toHaveBeenCalledWith(
      "/api/tenant/core/v1/auth/forgot-password",
      { email: "distinct-reset@example.com" },
      expect.objectContaining({ skipAuthRefresh: true }),
    );
  });

  it("openForgotModal clears any previous reset address", () => {
    const { result } = renderHook(() => useLogin());

    act(() => result.current.setResetEmail("stale@example.com"));
    act(() => result.current.openForgotModal());

    expect(result.current.resetEmail).toBe("");
    expect(result.current.isForgotModalOpen).toBe(true);
  });
});

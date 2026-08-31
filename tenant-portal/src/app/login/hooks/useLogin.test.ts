// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyLoginFailure, useLogin } from "./useLogin";

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

// 4.31 — every branch is a status + errorCode pair read from core-app source.
// One shared toast made these indistinguishable, and each one needs a different
// next action from the user.
describe("classifyLoginFailure", () => {
  it.each([
    [{ status: 401, code: "INVALID_CREDENTIALS" }, "invalidCredentials"],
    [{ status: 403, code: "ACCOUNT_NOT_ACTIVE" }, "accountNotActive"],
    [{ status: 403, code: "SUBSCRIPTION_PAST_DUE" }, "subscriptionPastDue"],
    [{ status: 503, code: "TENANT_INACTIVE" }, "tenantInactive"],
    [{ status: 429, code: "GW.RATE.LIMIT_EXCEEDED" }, "rateLimited"],
    [{ status: 0 }, "offline"],
    [{ status: 500 }, "unknown"],
  ])("maps %o to its own screen state", (error, expected) => {
    expect(classifyLoginFailure(error)).toBe(expected);
  });

  it("falls back to invalid credentials for a 401 whose code did not survive", () => {
    expect(classifyLoginFailure({ status: 401 })).toBe("invalidCredentials");
  });

  it("puts the rate limit ahead of the status, so a 429 is never read as offline", () => {
    expect(classifyLoginFailure({ status: 429 })).toBe("rateLimited");
  });
});

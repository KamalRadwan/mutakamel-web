// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAdminPasswordAction } from "./useAdminPasswordAction";

const auth = vi.hoisted(() => ({
  login: vi.fn(),
  acceptInvite: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

describe.each(["acceptInvite", "resetPassword"] as const)("%s error feedback", (mode) => {
  beforeEach(() => {
    auth.acceptInvite.mockReset();
    auth.resetPassword.mockReset();
    window.history.replaceState({}, "", "/#token=abcdefghijklmnop");
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it.each([
    [400, undefined, "passwordWeak"],
    [422, undefined, "passwordWeak"],
    [422, "WEAK_PASSWORD", "passwordWeak"],
    [400, "INVALID_ACTION_TOKEN", "invalidOrExpiredToken"],
    [400, "AUTH_SESSION_CHANGED", "sessionChanged"],
    [429, undefined, "rateLimited"],
    [503, undefined, "unavailable"],
  ] as const)("maps HTTP %s / %s to %s", async (status, code, expected) => {
    auth[mode].mockRejectedValue({ response: { status, data: { errorCode: code } } });
    const { result } = renderHook(() => useAdminPasswordAction(mode));
    await waitFor(() => expect(result.current.isTokenReady).toBe(true));

    act(() => {
      result.current.setPassword("Quokka7مرحباTree");
      result.current.setConfirmation("Quokka7مرحباTree");
    });
    await act(async () => { await result.current.submit(); });

    expect(auth[mode]).toHaveBeenCalledTimes(1);
    expect(auth[mode]).toHaveBeenCalledWith({
      token: "abcdefghijklmnop",
      newPassword: "Quokka7مرحباTree",
    });
    expect(result.current.error).toBe(expected);
    expect(result.current.isSubmitting).toBe(false);
  });
});

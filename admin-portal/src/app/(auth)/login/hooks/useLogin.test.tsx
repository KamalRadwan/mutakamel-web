// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loginMock, postMock, toastMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  postMock: vi.fn(),
  toastMock: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { post: postMock },
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ login: loginMock }),
}));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: {}, lang: "en" }),
}));
vi.mock("@/components/ui/ToastContext", () => ({
  useToast: () => toastMock,
}));

import { useLogin } from "./useLogin";

describe("forgot-password transport policy", () => {
  beforeEach(() => {
    loginMock.mockReset().mockResolvedValue(undefined);
    postMock.mockReset().mockResolvedValue({ data: { success: true } });
    vi.clearAllMocks();
  });

  it("sends the public non-idempotent request without a key or replay", async () => {
    const { result } = renderHook(() => useLogin());
    act(() => result.current.setEmail(" admin+ops@sub.example.com "));

    await act(async () => {
      await result.current.handleForgotPassword();
    });

    expect(postMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/auth/forgot-password",
      { email: "admin+ops@sub.example.com" },
      { skipAutoIdempotency: true, nonReplayable: true },
    );
  });

  it("defaults to a non-persistent session and keeps missing fields inline", async () => {
    const { result } = renderHook(() => useLogin());

    expect(result.current.rememberMe).toBe(false);

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.fieldErrors).toEqual({
      email: "Please enter your email",
      password: "Please enter your password",
    });
    expect(loginMock).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("retains a rejected login as a persistent submission error", async () => {
    loginMock.mockRejectedValueOnce(new Error("Invalid email or password"));
    const { result } = renderHook(() => useLogin());

    act(() => {
      result.current.setEmail("admin@example.com");
      result.current.setPassword("wrong-password");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.error).toBe("Invalid email or password");
    expect(toastMock.error).toHaveBeenCalledTimes(1);
  });

  it("keeps a malformed login email inline and does not authenticate", async () => {
    const { result } = renderHook(() => useLogin());
    const input = document.createElement("input");
    document.body.append(input);
    result.current.emailInputRef.current = input;

    act(() => {
      result.current.setEmail("admin@");
      result.current.setPassword("secret-password");
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.fieldErrors).toEqual({
      email: "Enter a valid email address",
    });
    await waitFor(() => expect(input).toHaveFocus());
    expect(loginMock).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    input.remove();
  });

  it("keeps a malformed forgot-password email inline and sends no request", async () => {
    const { result } = renderHook(() => useLogin());
    const input = document.createElement("input");
    document.body.append(input);
    result.current.forgotEmailInputRef.current = input;
    act(() => result.current.setEmail("admin@"));

    await act(async () => {
      await result.current.handleForgotPassword();
    });

    expect(result.current.forgotFieldError).toBe("Enter a valid email address");
    await waitFor(() => expect(input).toHaveFocus());
    expect(postMock).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
    input.remove();
  });
});

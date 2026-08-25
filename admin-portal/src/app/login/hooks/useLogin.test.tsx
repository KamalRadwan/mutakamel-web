// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { postMock, toastMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  toastMock: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { post: postMock },
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ login: vi.fn() }),
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
    postMock.mockReset().mockResolvedValue({ data: { success: true } });
    vi.clearAllMocks();
  });

  it("sends the public non-idempotent request without a key or replay", async () => {
    const { result } = renderHook(() => useLogin());
    act(() => result.current.setEmail("admin@example.com"));

    await act(async () => {
      await result.current.handleForgotPassword();
    });

    expect(postMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/auth/forgot-password",
      { email: "admin@example.com" },
      { skipAutoIdempotency: true, nonReplayable: true },
    );
  });
});

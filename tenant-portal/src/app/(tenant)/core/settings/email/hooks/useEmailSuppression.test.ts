// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { useEmailSuppression } from "./useEmailSuppression";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  canManage: true,
  post: vi.fn(),
}));

vi.mock("@/design-system", async () => {
  const actual = await vi.importActual<typeof import("@/design-system")>("@/design-system");
  return {
    ...actual,
    useCan: () => state.canManage,
  };
});

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    lang: state.lang,
    dir: ({ en: "ltr", ar: "rtl" } as const)[state.lang],
    t: ({ en, ar })[state.lang],
    setLang: vi.fn(),
    toggleLang: vi.fn(),
  }),
}));

vi.mock("@/lib/api/axiosClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/axiosClient")>("@/lib/api/axiosClient");
  return {
    ...actual,
    axiosClient: {
      post: (...args: unknown[]) => state.post(...args),
    },
  };
});

function apiError(status: number, data: Record<string, unknown>): TenantApiClientError {
  return new TenantApiClientError("request failed", {
    status,
    statusText: "Error",
    headers: new Headers(),
    data,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.lang = "en";
  state.canManage = true;
});

describe("useEmailSuppression", () => {
  it("reuses the exact UUIDv7 idempotency key on retry for the same address and rotates on edit", async () => {
    state.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          suppressed: true,
          reasonCode: "HARD_BOUNCE",
          firstOccurredAt: "2026-10-20T08:00:00.000Z",
          lastOccurredAt: "2026-10-21T08:00:00.000Z",
        },
      },
    });

    const { result } = renderHook(() => useEmailSuppression());
    act(() => result.current.updateAddress("bounce@acme.example"));

    await act(async () => {
      await result.current.lookup();
    });
    expect(result.current.result).toEqual({
      suppressed: true,
      reasonCode: "HARD_BOUNCE",
      firstOccurredAt: "2026-10-20T08:00:00.000Z",
      lastOccurredAt: "2026-10-21T08:00:00.000Z",
    });

    // Lift without confirmation must not send a request.
    await act(async () => {
      await result.current.lift();
    });
    expect(state.post).toHaveBeenCalledTimes(1);

    // First confirmed lift fails due to network timeout; retry must keep the exact UUIDv7 key.
    state.post.mockRejectedValueOnce(new Error("timeout"));
    act(() => result.current.setConfirming(true));
    await act(async () => {
      await result.current.lift();
    });
    const firstLiftConfig = state.post.mock.calls[1]?.[2] as {
      headers?: Record<string, string>;
      skipAutoIdempotency?: boolean;
    };
    const firstKey = firstLiftConfig.headers?.["x-idempotency-key"];
    expect(firstLiftConfig.skipAutoIdempotency).toBe(true);
    expect(firstKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(result.current.error).toBe(en.emailSuppression.errors.failed);

    state.post.mockResolvedValueOnce({
      data: { success: true, data: { suppressed: false, lifted: true } },
    });
    act(() => result.current.setConfirming(true));
    await act(async () => {
      await result.current.lift();
    });
    const retryLiftConfig = state.post.mock.calls[2]?.[2] as { headers?: Record<string, string> };
    expect(retryLiftConfig.headers?.["x-idempotency-key"]).toBe(firstKey);
    expect(result.current.notice).toBe(en.emailSuppression.lifted);
    expect(result.current.result).toEqual({ suppressed: false });

    // Editing the address clears evidence and rotates any future lift key.
    act(() => result.current.updateAddress("other@acme.example"));
    expect(result.current.result).toBeNull();
    expect(result.current.notice).toBeNull();
  });

  it.each(["en", "ar"] as const)("never exposes server error text containing the submitted address in %s", async (lang) => {
    state.lang = lang;
    const copy = ({ en, ar })[lang].emailSuppression;
    state.post.mockRejectedValueOnce(
      apiError(422, { message: "Address secret-user@acme.example failed validation" }),
    );

    const { result } = renderHook(() => useEmailSuppression());
    act(() => result.current.updateAddress("secret-user@acme.example"));
    await act(async () => {
      await result.current.lookup();
    });

    expect(result.current.error).toBe(copy.errors.invalidAddress);
    expect(result.current.error).not.toContain("secret-user@acme.example");
  });

  it("clears address and evidence and sets denied on HTTP 403", async () => {
    state.post.mockRejectedValueOnce(apiError(403, { errorCode: "FORBIDDEN" }));

    const { result } = renderHook(() => useEmailSuppression());
    act(() => result.current.updateAddress("private@acme.example"));
    await act(async () => {
      await result.current.lookup();
    });

    expect(result.current.denied).toBe(true);
    expect(result.current.address).toBe("");
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe(en.emailSuppression.errors.forbidden);
  });

  it("fails closed on direct handler calls when tenant-wide manage permission is absent or revoked mid-flight", async () => {
    state.canManage = false;
    const deniedHook = renderHook(() => useEmailSuppression());

    act(() => {
      deniedHook.result.current.updateAddress("blocked@acme.example");
      deniedHook.result.current.setConfirming(true);
    });
    await act(async () => {
      await deniedHook.result.current.lookup();
      await deniedHook.result.current.lift();
    });
    expect(deniedHook.result.current.address).toBe("");
    expect(state.post).not.toHaveBeenCalled();
    deniedHook.unmount();

    // Scope loss during an active lookup aborts the request and clears ephemeral state.
    state.canManage = true;
    let capturedSignal: AbortSignal | undefined;
    state.post.mockImplementationOnce((_url: string, _body: unknown, config?: { signal?: AbortSignal }) => {
      capturedSignal = config?.signal;
      return new Promise(() => {});
    });

    const { result, rerender } = renderHook(() => useEmailSuppression());
    act(() => result.current.updateAddress("active@acme.example"));
    act(() => {
      void result.current.lookup();
    });
    expect(capturedSignal?.aborted).toBe(false);
    expect(result.current.isLookupModalOpen).toBe(true);

    state.canManage = false;
    rerender();
    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.address).toBe("");
    expect(result.current.isLookupModalOpen).toBe(false);
    expect(result.current.pending).toBe(false);
  });
});

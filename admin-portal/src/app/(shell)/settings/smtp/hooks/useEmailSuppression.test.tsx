// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { useEmailSuppression } from "./useEmailSuppression";

const mocks = vi.hoisted(() => ({ post: vi.fn(), locale: "en", keySequence: 0 }));
vi.mock("@/lib/api/axiosClient", () => ({ axiosClient: { post: mocks.post } }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: mocks.locale === "ar" ? ar : en }) }));
vi.mock("@/lib/utils/uuid", () => ({
  generateUUIDv7: () => "019a0f00-0000-7000-8000-" + String(++mocks.keySequence).padStart(12, "0"),
}));
vi.mock("@/shared/api/normalized-api-error", () => ({
  normalizeApiError: (error: unknown) => ({ httpStatus: (error as { status?: number }).status ?? 0 }),
}));

const response = (data: unknown) => ({ data: { success: true, data } });
const suppressed = { suppressed: true, reasonCode: "COMPLAINT", firstOccurredAt: "2026-10-23T10:00:00Z", lastOccurredAt: "2026-10-23T11:00:00Z" };
beforeEach(() => { mocks.post.mockReset(); mocks.locale = "en"; mocks.keySequence = 0; });
afterEach(cleanup);

describe("email suppression commands", () => {
  it("sends only body addresses, requires confirmation, and invalidates results on edits", async () => {
    mocks.post.mockResolvedValueOnce(response(suppressed)).mockResolvedValueOnce(response({ suppressed: false, lifted: true }));
    const { result } = renderHook(() => useEmailSuppression());
    act(() => result.current.updateAddress(" private@example.com "));
    await act(async () => { await result.current.lookup(); });
    expect(mocks.post.mock.calls[0][0]).toBe("/api/admin/core/v1/email-suppressions/lookup");
    expect(mocks.post.mock.calls[0][1]).toEqual({ address: "private@example.com" });
    expect(mocks.post.mock.calls[0][2]).toMatchObject({ cache: "no-store", skipAutoIdempotency: true });
    await act(async () => { await result.current.lift(); });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    act(() => result.current.setConfirming(true));
    await act(async () => { await result.current.lift(); });
    expect(mocks.post.mock.calls[1][0]).toBe("/api/admin/core/v1/email-suppressions/lift");
    expect(mocks.post.mock.calls[1][2].headers["x-idempotency-key"]).toMatch(/-7000-/);
    expect(result.current.notice).toBe(en.emailSuppression.lifted);
    act(() => result.current.updateAddress("other@example.com"));
    expect(result.current.result).toBeNull();
    expect(result.current.notice).toBeNull();
  });
  it("retries an ambiguous lift using the same key and reports an already absent suppression", async () => {
    mocks.post.mockResolvedValueOnce(response(suppressed)).mockRejectedValueOnce(new Error("lost")).mockResolvedValueOnce(response({ suppressed: false, lifted: false }));
    const { result } = renderHook(() => useEmailSuppression());
    act(() => result.current.updateAddress("private@example.com"));
    await act(async () => { await result.current.lookup(); });
    act(() => result.current.setConfirming(true));
    await act(async () => { await result.current.lift(); });
    expect(result.current.notice).toBeNull();
    act(() => result.current.setConfirming(true));
    await act(async () => { await result.current.lift(); });
    expect(mocks.post.mock.calls[2][2].headers).toEqual(mocks.post.mock.calls[1][2].headers);
    expect(mocks.keySequence).toBe(1);
    expect(result.current.notice).toBe(en.emailSuppression.alreadyAbsent);
  });
  it.each(["en", "ar"])("localizes failures in %s without echoing server text", async (locale) => {
    mocks.locale = locale;
    mocks.post.mockRejectedValue({ status: 429, message: "private@example.com" });
    const { result } = renderHook(() => useEmailSuppression());
    act(() => result.current.updateAddress("private@example.com"));
    await act(async () => { await result.current.lookup(); });
    expect(result.current.error).toBe((locale === "ar" ? ar : en).emailSuppression.errors.rateLimited);
    expect(result.current.result).toBeNull();
  });
  it("treats 403 as denial and clears the address", async () => {
    mocks.post.mockRejectedValue({ status: 403 });
    const { result } = renderHook(() => useEmailSuppression());
    act(() => result.current.updateAddress("private@example.com"));
    await act(async () => { await result.current.lookup(); });
    expect(result.current.denied).toBe(true);
    expect(result.current.address).toBe("");
    await act(async () => { await result.current.lookup(); });
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });
  it("aborts pending requests on unmount", async () => {
    mocks.post.mockImplementation(() => new Promise(() => {}));
    const { result, unmount } = renderHook(() => useEmailSuppression());
    act(() => result.current.updateAddress("private@example.com"));
    act(() => { void result.current.lookup(); });
    const signal = mocks.post.mock.calls[0][2].signal;
    unmount();
    expect(signal.aborted).toBe(true);
  });
});


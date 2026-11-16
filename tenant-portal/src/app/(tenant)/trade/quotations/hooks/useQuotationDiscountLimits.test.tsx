// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { DISCOUNT_HEADERS, DISCOUNT_IDS } from "../quotation-discount.test-fixtures";
import { useQuotationDiscountLimits } from "./useQuotationDiscountLimits";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn(() => false) },
}));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { id: "actor" }, realtimeAuthGeneration: 1 }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en", dir: "ltr" }) }));
vi.mock("@/design-system", () => ({ useToast: () => mocks.toast }));
vi.mock("../../trade-api", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../trade-api")>()), tradeGet: mocks.get, tradePost: mocks.post, tradePatch: mocks.patch }));
vi.mock("./useQuotationDiscountUsers", () => ({ useQuotationDiscountUsers: () => ({ items: [{ id: DISCOUNT_IDS.actor, firstName: "Mona", lastName: "Hassan", email: "mona@example.test" }] }) }));
const row = (version = 1) => ({ id: DISCOUNT_IDS.policy, version, companyId: DISCOUNT_IDS.company,
  branchId: DISCOUNT_IDS.branch, actorUserId: DISCOUNT_IDS.actor, maxPercent: "10", allowFreeItems: false, reasonRequired: true, active: true });
const reply = (data: unknown, replay = false) => ({ data, status: 200, headers: new Headers(replay ? { "idempotency-replayed": "true" } : {}) });
const error = (status: number, code: string) => new TenantApiClientError("Refused", { status, statusText: "Refused", headers: new Headers(), data: { code } });
async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }
async function setup(existing = false) {
  mocks.get.mockResolvedValue(reply({ items: existing ? [row(2)] : [], total: existing ? 1 : 0, page: 1, limit: 25 }));
  const changed = vi.fn();
  const hook = renderHook((headers) => useQuotationDiscountLimits(headers, true, changed), { initialProps: DISCOUNT_HEADERS });
  act(() => { hook.result.current.setOpen(true); hook.result.current.selectUser(DISCOUNT_IDS.actor); }); await settle();
  return { ...hook, changed };
}
beforeEach(() => { mocks.get.mockReset(); mocks.post.mockReset(); mocks.patch.mockReset(); });
afterEach(cleanup);

describe("discount limit configuration command recovery", () => {
  it("creates a configured limit for a selected real directory user using exact decimal intent", async () => {
    const { result, changed } = await setup();
    act(() => result.current.update({ maxPercent: "15.00" }));
    mocks.post.mockResolvedValue(reply({ ...row(), maxPercent: "15" }));
    await act(async () => { await result.current.submit(); });
    expect(mocks.post).toHaveBeenCalledWith("/api/tenant/trade/v1/quotations/discount-limits",
      { actorUserId: DISCOUNT_IDS.actor, maxPercent: "15", allowFreeItems: false, reasonRequired: false, active: true },
      expect.objectContaining({ headers: expect.objectContaining(DISCOUNT_HEADERS) }));
    expect(changed).toHaveBeenCalledOnce(); expect(result.current.limit?.maxPercent).toBe("15");
  });
  it("replays an unknown create with the same key and body and fences editors and close", async () => {
    const { result } = await setup();
    act(() => result.current.update({ maxPercent: "15" }));
    mocks.post.mockRejectedValueOnce(error(0, "NETWORK"));
    await act(async () => { await result.current.submit(); });
    expect(result.current.write.ambiguous).not.toBeNull();
    act(() => { result.current.update({ maxPercent: "99" }); result.current.setOpen(false); });
    expect(result.current.open).toBe(true); expect(result.current.draft.maxPercent).toBe("15");
    mocks.post.mockResolvedValue(reply({ ...row(), maxPercent: "15" }, true));
    await act(async () => { await result.current.write.ambiguous?.retry(); });
    expect(mocks.post.mock.calls[1][1]).toEqual(mocks.post.mock.calls[0][1]);
    expect(mocks.post.mock.calls[1][2].headers["x-idempotency-key"]).toBe(mocks.post.mock.calls[0][2].headers["x-idempotency-key"]);
    expect(result.current.write.ambiguous).toBeNull();
  });
  it("requires conflict reload and retains the entered policy while adopting the current version", async () => {
    const { result } = await setup(true);
    act(() => result.current.update({ maxPercent: "15" }));
    mocks.patch.mockRejectedValueOnce(error(409, "TRADE.CONCURRENCY.STALE_VERSION"));
    await act(async () => { await result.current.submit(); });
    expect(result.current.conflicted).toBe(true); expect(result.current.canSubmit).toBe(false);
    mocks.get.mockResolvedValue(reply({ items: [{ ...row(3), maxPercent: "20" }], total: 1, page: 1, limit: 25 }));
    act(() => result.current.retry()); await settle();
    expect(result.current.draft.maxPercent).toBe("15"); expect(result.current.limit?.version).toBe(3);
    mocks.patch.mockResolvedValue(reply({ ...row(4), maxPercent: "15" }));
    await act(async () => { await result.current.submit(); });
    expect(mocks.patch.mock.calls[1][2].headers["if-match"]).toBe('"3"');
  });
  it("quarantines another branch's limit instead of editing its identity", async () => {
    mocks.get.mockResolvedValue(reply({ items: [{ ...row(), branchId: DISCOUNT_IDS.actor }], total: 1, page: 1, limit: 25 }));
    const { result } = renderHook(() => useQuotationDiscountLimits(DISCOUNT_HEADERS, true, vi.fn()));
    act(() => { result.current.setOpen(true); result.current.selectUser(DISCOUNT_IDS.actor); }); await settle();
    expect(result.current.error).not.toBeNull(); expect(result.current.limit).toBeNull(); expect(result.current.canSubmit).toBe(false);
    await act(async () => { await result.current.submit(); }); expect(mocks.patch).not.toHaveBeenCalled(); expect(mocks.post).not.toHaveBeenCalled();
  });
  it("does not accept an arbitrary UUID absent from the user directory or an unauthorized manager", async () => {
    const { result } = renderHook(() => useQuotationDiscountLimits(DISCOUNT_HEADERS, false, vi.fn()));
    act(() => { result.current.setOpen(true); result.current.selectUser(DISCOUNT_IDS.branch); }); await settle();
    expect(result.current.open).toBe(false); expect(result.current.selected).toBeNull();
    await act(async () => { await result.current.submit(); }); expect(mocks.post).not.toHaveBeenCalled();
  });
});

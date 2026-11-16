// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { DISCOUNT_HEADERS, DISCOUNT_IDS } from "../quotation-discount.test-fixtures";
import { parseQuotationDiscountPolicy, useQuotationDiscountPolicy } from "./useQuotationDiscountPolicy";
const mocks = vi.hoisted(() => ({ get: vi.fn(), auth: { user: { id: "actor", isTenantOwner: true }, realtimeAuthGeneration: 1 } }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => mocks.auth }));
vi.mock("../../trade-api", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../trade-api")>()), tradeGet: mocks.get }));
const policy = () => ({ canApply: true, hasApplyPermission: true, canManage: true, configured: true, limit: { id: DISCOUNT_IDS.policy, version: 2, maxPercent: "15", allowFreeItems: false, reasonRequired: true } });
const reply = (data: unknown) => ({ data, status: 200, headers: new Headers() });
async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }
beforeEach(() => { mocks.get.mockReset(); mocks.auth.realtimeAuthGeneration = 1; });
afterEach(cleanup);

describe("authoritative scoped quotation discount policy", () => {
  it("does not turn an owner's missing limit into implicit permission", async () => {
    mocks.get.mockResolvedValue(reply({ canApply: false, hasApplyPermission: true, canManage: true, configured: false, limit: null }));
    const { result } = renderHook(() => useQuotationDiscountPolicy(DISCOUNT_HEADERS, true)); await settle();
    expect(result.current.policy).toEqual({ canApply: false, hasApplyPermission: true, canManage: true, configured: false, limit: null });
  });
  it("reads configured limits and hides them immediately after branch changes", async () => {
    mocks.get.mockResolvedValue(reply(policy()));
    const { result, rerender } = renderHook((headers) => useQuotationDiscountPolicy(headers, true), { initialProps: DISCOUNT_HEADERS }); await settle();
    expect(result.current.policy?.limit?.maxPercent).toBe("15");
    rerender({ ...DISCOUNT_HEADERS, "x-mutakamel-branch-id": DISCOUNT_IDS.actor });
    expect(result.current.policy).toBeNull(); expect(result.current.loading).toBe(true);
  });
  it("invalidates policy when authorization generation changes", async () => {
    mocks.get.mockResolvedValue(reply(policy()));
    const { result, rerender } = renderHook(() => useQuotationDiscountPolicy(DISCOUNT_HEADERS, true)); await settle();
    mocks.auth.realtimeAuthGeneration += 1; rerender();
    expect(result.current.policy).toBeNull(); await settle(); expect(mocks.get).toHaveBeenCalledTimes(2);
  });
  it("keeps403 as refusal and retries a transient failure on demand", async () => {
    mocks.get.mockRejectedValueOnce(new TenantApiClientError("Denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: { code: "AUTHORIZATION_DENIED" } }));
    const { result } = renderHook(() => useQuotationDiscountPolicy(DISCOUNT_HEADERS, true)); await settle();
    expect(result.current.policy).toBeNull(); expect(result.current.error?.status).toBe(403);
    mocks.get.mockResolvedValue(reply(policy())); act(() => result.current.retry()); await settle();
    expect(result.current.error).toBeNull(); expect(result.current.policy?.canApply).toBe(true);
  });
  it.each([
    { ...policy(), configured: false }, { ...policy(), limit: null },
    { ...policy(), canApply: "true" }, { ...policy(), limit: { ...policy().limit, maxPercent: "101" } },
  ])("rejects inconsistent policy envelopes", (value) => expect(() => parseQuotationDiscountPolicy(value)).toThrow());
});

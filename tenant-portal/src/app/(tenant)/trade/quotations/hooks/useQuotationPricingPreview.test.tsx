// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { DISCOUNT_HEADERS, DISCOUNT_IDS, quotationPricingCalculation, quotationPricingRequest } from "../quotation-discount.test-fixtures";
import { useQuotationPricingPreview } from "./useQuotationPricingPreview";
const mocks = vi.hoisted(() => ({ post: vi.fn(), auth: { user: { id: "actor-a" }, realtimeAuthGeneration: 0 } }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => mocks.auth }));
vi.mock("../../trade-api", () => ({ tradePost: mocks.post }));
const props = () => ({ request: quotationPricingRequest(), headers: DISCOUNT_HEADERS, enabled: true, stale: false });
function reply(data: unknown) { return { data, status: 200, headers: new Headers() }; }
async function settle() { await act(async () => { await vi.advanceTimersByTimeAsync(300); }); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => { vi.useFakeTimers(); mocks.post.mockReset(); mocks.auth.user = { id: "actor-a" }; mocks.auth.realtimeAuthGeneration = 0; });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("whole-quotation preview lifecycle", () => {
  it("sends exact intent through the quote-owned route and validates authoritative totals", async () => {
    mocks.post.mockResolvedValue(reply(quotationPricingCalculation()));
    const { result } = renderHook(useQuotationPricingPreview, { initialProps: props() });
    expect(result.current.loading).toBe(true); await settle();
    expect(mocks.post).toHaveBeenCalledWith("/api/tenant/trade/v1/quotations/pricing-preview", quotationPricingRequest(), expect.objectContaining({ headers: DISCOUNT_HEADERS, skipAutoIdempotency: true }));
    expect(result.current.calculation?.totals.grandTotal).toBe("100"); expect(result.current.ready).toBe(true);
  });
  it("hides previous prices immediately after quantity changes", async () => {
    mocks.post.mockResolvedValueOnce(reply(quotationPricingCalculation()));
    const { result, rerender } = renderHook(useQuotationPricingPreview, { initialProps: props() }); await settle();
    const waiting = deferred<ReturnType<typeof reply>>(); mocks.post.mockReturnValue(waiting.promise);
    const next = props(); next.request.lines[0].quantity = "2";
    rerender(next);
    expect(result.current.calculation).toBeNull(); expect(result.current.ready).toBe(false); await settle();
    expect(result.current.loading).toBe(true);
    waiting.resolve(reply(quotationPricingCalculation())); await act(async () => { await Promise.resolve(); });
    expect(result.current.ready).toBe(false); expect(result.current.error).not.toBeNull();
  });
  it("discards an old request that resolves after a new scope request", async () => {
    const old = deferred<ReturnType<typeof reply>>(); mocks.post.mockReturnValueOnce(old.promise);
    const { result, rerender } = renderHook(useQuotationPricingPreview, { initialProps: props() }); await settle();
    mocks.post.mockResolvedValueOnce(reply(quotationPricingCalculation()));
    rerender({ ...props(), headers: { ...DISCOUNT_HEADERS, "x-mutakamel-branch-id": DISCOUNT_IDS.actor } }); await settle();
    const current = result.current.calculation;
    old.resolve(reply({ ...quotationPricingCalculation(), fingerprint: "b".repeat(64) })); await act(async () => { await Promise.resolve(); });
    expect(result.current.calculation).toBe(current); expect(result.current.calculation?.fingerprint).toBe("a".repeat(64));
  });
  it("quarantines cached evidence on actor change", async () => {
    mocks.post.mockResolvedValue(reply(quotationPricingCalculation()));
    const { result, rerender } = renderHook(useQuotationPricingPreview, { initialProps: props() }); await settle();
    mocks.auth.user = { id: "actor-b" }; rerender(props());
    expect(result.current.calculation).toBeNull(); await settle(); expect(mocks.post).toHaveBeenCalledTimes(2);
  });
  it("quarantines evidence when the current actor's permission generation changes", async () => {
    mocks.post.mockResolvedValue(reply(quotationPricingCalculation()));
    const { result, rerender } = renderHook(useQuotationPricingPreview, { initialProps: props() }); await settle();
    mocks.auth.realtimeAuthGeneration = 1; rerender(props());
    expect(result.current.calculation).toBeNull(); expect(result.current.ready).toBe(false);
    await settle(); expect(mocks.post).toHaveBeenCalledTimes(2);
  });
  it("keeps authoritative permission refusal distinct and retries only on request", async () => {
    mocks.post.mockRejectedValueOnce(new TenantApiClientError("Denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: { code: "TRADE.QUOTE.DISCOUNT_FORBIDDEN" } }));
    const { result } = renderHook(useQuotationPricingPreview, { initialProps: props() }); await settle();
    expect(result.current.error?.status).toBe(403); expect(result.current.ready).toBe(false);
    await settle(); expect(mocks.post).toHaveBeenCalledOnce();
    mocks.post.mockResolvedValue(reply(quotationPricingCalculation())); act(() => result.current.retry()); await settle();
    expect(result.current.ready).toBe(true); expect(result.current.error).toBeNull();
  });
  it("retains safe maximum values and affected identities from a refusal", async () => {
    mocks.post.mockRejectedValue(new TenantApiClientError("Limit", { status: 422, statusText: "Refused", headers: new Headers(), data: { code: "TRADE.QUOTE.DISCOUNT_EXCEEDS_ALLOWED", details: { maxDiscountAmount: ["10.25"], maxDiscountPercent: ["5"], clientLineId: [DISCOUNT_IDS.line, "invalid"] } } }));
    const { result } = renderHook(useQuotationPricingPreview, { initialProps: props() }); await settle();
    expect(result.current.error).toMatchObject({ maxDiscountAmount: "10.25", maxDiscountPercent: "5", clientLineIds: [DISCOUNT_IDS.line] });
  });
  it("requires an explicit refresh after the saved pricing fingerprint becomes stale", async () => {
    mocks.post.mockResolvedValue(reply(quotationPricingCalculation()));
    const { result, rerender } = renderHook(useQuotationPricingPreview, { initialProps: props() }); await settle();
    rerender({ ...props(), stale: true });
    expect(result.current.ready).toBe(false); expect(result.current.calculation).toBeNull();
    act(() => result.current.retry()); rerender(props()); await settle();
    expect(result.current.ready).toBe(true);
  });
  it("does not submit an incomplete request or run after close", async () => {
    const { result } = renderHook(() => useQuotationPricingPreview({ ...props(), request: null })); await settle();
    expect(mocks.post).not.toHaveBeenCalled(); expect(result.current.ready).toBe(false);
  });
});

// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { isUUIDv7 } from "@/lib/uuid";
import { TRADE_ACTION_RESPONSE_BYTES } from "../../documents/trade-document-contract";
import { tradePost } from "../../trade-api";
import { parsePurchaseOrderDetail } from "../purchase-order-contract";
import { usePurchaseOrderScreen } from "./usePurchaseOrderScreen";

const mocks = vi.hoisted(() => ({
  detail: vi.fn(), language: "en" as "en" | "ar",
  toast: { success: vi.fn(), error: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn(() => false) },
}));
vi.mock("@/design-system", () => ({ useToast: () => mocks.toast }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: mocks.language === "ar" ? ar : en }),
}));
vi.mock("../../documents/hooks/useTradeDocumentDetail", () => ({ useTradeDocumentDetail: mocks.detail }));
vi.mock("../../documents/hooks/useTradePdfJob", () => ({ useTradePdfJob: () => ({}) }));
vi.mock("../../trade-api", () => ({
  tradePost: vi.fn(), tradeIfMatch: (version: number) => `"${version}"`,
  isTradeReplay: (headers: Headers) => headers.get("idempotency-replayed") === "true",
}));
vi.mock("@/lib/api/errors", () => ({ normalizeApiError: (error: unknown) => error }));

const id = "019f1000-0000-7000-8000-000000000001";
const headers = { "x-mutakamel-company-id": id, "x-mutakamel-branch-id": id };
const response = { status: 200, headers: new Headers(), data: {} };
const reload = vi.fn().mockResolvedValue(null);

function order() {
  return parsePurchaseOrderDetail({
    id, version: 7, companyId: id, branchId: id, partyId: id, contactPartyId: null,
    currencyCode: "EGP", businessDate: "2026-10-30", lifecycleStatus: "CONFIRMED",
    approvalStatus: "APPROVED", fulfillmentStatus: "UNPLANNED", billingStatus: "NOT_BILLED",
    grandTotal: "100", documentNumber: "PO-1", draftReference: null, partySnapshot: {},
    createdBy: id, createdAt: "2026-10-30T00:00:00.000Z", updatedAt: "2026-10-30T00:00:00.000Z",
    dispatchStatus: "FAILED", supplierAccountId: id, receivingNodeId: id, totalsSnapshot: null,
    lines: [], delivery: { status: "FAILED", attemptCount: 1,
      lastErrorCode: "TRADE.PURCHASE_ORDER.DELIVERY_EMAIL_NOT_FOUND" },
  });
}

describe("purchase-order supplier delivery retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.language = "en";
    mocks.detail.mockReturnValue({
      document: order(), reload, scope: { headers, canWrite: () => true, userId: id },
    });
    vi.mocked(tradePost).mockResolvedValue(response);
  });

  it("posts scoped current-version retries with fresh UUIDv7 keys and refreshes on success", async () => {
    const { result, rerender } = renderHook(() => usePurchaseOrderScreen(id));
    await act(async () => { await result.current.retryDelivery(); });
    expect(tradePost).toHaveBeenCalledWith(`/api/tenant/trade/v1/purchase-orders/${id}/delivery/retry`, {}, {
      headers: { ...headers, "if-match": '"7"', "x-idempotency-key": expect.any(String) },
      maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
    });
    const firstKey = new Headers(vi.mocked(tradePost).mock.calls[0]![2]!.headers).get("x-idempotency-key");
    expect(isUUIDv7(firstKey)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    const updated = { ...order(), version: 8 };
    mocks.detail.mockReturnValue({ document: updated, reload,
      scope: { headers, canWrite: () => true, userId: id } });
    rerender();
    await act(async () => { await result.current.retryDelivery(); });
    const nextHeaders = new Headers(vi.mocked(tradePost).mock.calls[1]![2]!.headers);
    expect(nextHeaders.get("x-idempotency-key")).not.toBe(firstKey);
    expect(nextHeaders.get("if-match")).toBe('"8"');
  });

  it.each(["ar", "en"] as const)("localizes both retry conflicts in %s without claiming success", async (language) => {
    mocks.language = language;
    const dictionary = { ar, en }[language];
    const { result } = renderHook(() => usePurchaseOrderScreen(id));
    for (const [code, message] of [
      ["TRADE.PURCHASE_ORDER.DELIVERY_RETRY_NOT_ALLOWED", dictionary.tradeDocuments.errors.purchaseOrderDeliveryRetryNotAllowed],
      ["TRADE.CONCURRENCY.STALE_VERSION", dictionary.tradeDocuments.errors.concurrencyStale],
    ]) {
      vi.mocked(tradePost).mockRejectedValueOnce({ status: 409, code });
      await act(async () => { await result.current.retryDelivery(); });
      expect(mocks.toast.error).toHaveBeenLastCalledWith(dictionary.tradeDocuments.purchaseOrders.retryDelivery, message);
      expect(result.current.write.writeError?.code).toBe(code);
    }
    expect(reload).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("blocks new writes after a lost response and refreshes on same-key recovery", async () => {
    vi.mocked(tradePost).mockRejectedValueOnce({ status: 0 });
    const { result } = renderHook(() => usePurchaseOrderScreen(id));
    await act(async () => { await result.current.retryDelivery(); });
    expect(result.current.write.isBlocked).toBe(true);
    expect(reload).not.toHaveBeenCalled();
    await act(async () => { await result.current.retryDelivery(); });
    expect(tradePost).toHaveBeenCalledOnce();
    await act(async () => { await result.current.write.ambiguous!.retry(); });
    expect(vi.mocked(tradePost).mock.calls[1]).toEqual(vi.mocked(tradePost).mock.calls[0]);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("guards against two submissions before the disabled state renders", async () => {
    let finish!: (value: typeof response) => void;
    vi.mocked(tradePost).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => usePurchaseOrderScreen(id));
    await act(async () => {
      const first = result.current.retryDelivery();
      await result.current.retryDelivery();
      finish(response);
      await first;
    });
    expect(tradePost).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
  });

  it.each([false, true])("refuses an ineligible retry even if called directly (grant: %s)", async (hasGrant) => {
    mocks.detail.mockReturnValue({ document: hasGrant ? null : order(), reload,
      scope: { headers, canWrite: () => hasGrant, userId: id } });
    const { result } = renderHook(() => usePurchaseOrderScreen(id));
    expect(result.current.canRetryDelivery).toBe(false);
    await act(async () => { await result.current.retryDelivery(); });
    expect(tradePost).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tradeGet, tradePost } from "../../trade-api";
import type { SalesOrderDetail } from "../sales-order-contract";
import { useSalesOrderConfirmation } from "./useSalesOrderConfirmation";

const toast = vi.hoisted(() => ({
  success: vi.fn(), error: vi.fn(), errorFromApi: vi.fn(), outcomeFromApi: vi.fn(() => false),
}));
vi.mock("@/design-system", () => ({ useToast: () => toast }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: {
  tradeDocuments: {
    salesOrders: {
      confirm: "Confirm", requestedDeadline: "Requested deadline",
      requestedDeadlineInvalid: "Enter a valid date and time for the requested deadline.",
    }, savedDescription: "Saved",
    replayedDescription: "Replayed", errors: {},
  },
} }) }));
vi.mock("../../trade-api", () => ({
  tradePost: vi.fn(), tradeGet: vi.fn(),
  tradeIfMatch: (version: number) => `"${version}"`,
  isTradeReplay: (headers: Headers) => headers.get("idempotency-replayed") === "true",
}));
vi.mock("@/lib/api/errors", () => ({ normalizeApiError: (error: unknown) => error }));

const order = { id: "019f1000-0000-7000-8000-000000000001", version: 4 } as SalesOrderDetail;
const headers = { "x-mutakamel-company-id": "019f1000-0000-7000-8000-000000000002" };
const receipt = {
  status: 200, headers: new Headers(),
  data: {
    statusCode: 200, status: "COMPLETED", orderId: order.id,
    attemptId: "019f1000-0000-7000-8000-000000000003",
  },
};

describe("synchronous sales order confirmation", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(["not-a-date", "   ", "999999-01-01T12:00"])(
    "blocks an invalid deadline (%s) with a translated field message",
    async (deadline) => {
      const settled = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useSalesOrderConfirmation(order, headers, settled));
      act(() => { result.current.setRequestedDeadline(deadline); });
      await act(async () => { await result.current.confirm(); });
      expect(tradePost).not.toHaveBeenCalled();
      expect(settled).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        "Requested deadline", "Enter a valid date and time for the requested deadline.",
      );
      expect(toast.errorFromApi).not.toHaveBeenCalled();
      expect(result.current.write.writeError).toBeNull();
      expect(result.current.write.isBlocked).toBe(false);
    },
  );

  it("sends a valid deadline as ISO after an invalid value is corrected", async () => {
    vi.mocked(tradePost).mockResolvedValue(receipt);
    const settled = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSalesOrderConfirmation(order, headers, settled));
    act(() => { result.current.setRequestedDeadline("invalid"); });
    await act(async () => { await result.current.confirm(); });
    act(() => { result.current.setRequestedDeadline("2030-05-20T13:45:00+02:00"); });
    await act(async () => { await result.current.confirm(); });
    expect(tradePost).toHaveBeenCalledTimes(1);
    expect(tradePost).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/sales-orders/${order.id}/confirm`,
      { requestedDeadline: "2030-05-20T11:45:00.000Z" },
      expect.objectContaining({ headers: expect.objectContaining({
        ...headers, "if-match": '"4"', "x-idempotency-key": expect.any(String),
      }) }),
    );
    expect(settled).toHaveBeenCalledOnce();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("posts once with the order version, then refreshes without polling", async () => {
    vi.mocked(tradePost).mockResolvedValue(receipt);
    const settled = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSalesOrderConfirmation(order, headers, settled));
    await act(async () => { await result.current.confirm(); });
    expect(tradePost).toHaveBeenCalledTimes(1);
    expect(tradePost).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/sales-orders/${order.id}/confirm`, {},
      expect.objectContaining({ headers: expect.objectContaining({
        ...headers, "if-match": '"4"', "x-idempotency-key": expect.any(String),
      }) }),
    );
    expect(settled).toHaveBeenCalledOnce();
    expect(tradeGet).not.toHaveBeenCalled();
  });

  it("preserves same-key recovery after a lost confirmation response", async () => {
    vi.mocked(tradePost).mockRejectedValueOnce({ status: 0 }).mockResolvedValue(receipt);
    const settled = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSalesOrderConfirmation(order, headers, settled));
    await act(async () => { await result.current.confirm(); });
    expect(settled).not.toHaveBeenCalled();
    expect(result.current.write.isBlocked).toBe(true);
    await act(async () => { await result.current.write.ambiguous!.retry(); });
    expect(vi.mocked(tradePost).mock.calls[1]).toEqual(vi.mocked(tradePost).mock.calls[0]);
    expect(settled).toHaveBeenCalledOnce();
    expect(tradeGet).not.toHaveBeenCalled();
  });

  it("retains a rejected confirmation as a write error without refreshing", async () => {
    vi.mocked(tradePost).mockRejectedValue({ status: 409, code: "TRADE.SALES_ORDER.CONFIRM_NOT_ALLOWED" });
    const settled = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSalesOrderConfirmation(order, headers, settled));
    await act(async () => { await result.current.confirm(); });
    expect(result.current.write.writeError?.status).toBe(409);
    expect(settled).not.toHaveBeenCalled();
    expect(tradeGet).not.toHaveBeenCalled();
  });
});

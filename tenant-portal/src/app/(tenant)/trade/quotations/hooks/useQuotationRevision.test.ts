// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuotationDetail } from "../quotation-contract";
import { useQuotationRevision } from "./useQuotationRevision";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  runWrite: vi.fn(),
  isBlocked: false,
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { tradeDocuments: {
    quotations: { newRevision: "New revision" },
    executive: { revisionTermIntegerInvalid: "Enter a complete non-negative integer" },
  } } }),
}));
vi.mock("../../documents/hooks/useTradeWrite", () => ({
  useTradeWrite: () => ({ isBlocked: mocks.isBlocked, runWrite: mocks.runWrite }),
}));
vi.mock("../../documents/hooks/useTradeLineDraft", () => ({
  useTradeLineDraft: () => ({
    invalidLineIndex: null,
    lines: [{ clientLineId: "line", itemId: "item", uomId: "uom", quantity: "1" }],
  }),
}));
vi.mock("../../trade-api", () => ({
  tradePost: mocks.post,
  tradeIfMatch: (version: number) => `"${version}"`,
}));

// Only these quotation fields are consumed by this hook; its collaborators are mocked.
const quotation = { id: "01900500-0000-7000-8000-000000000001", version: 7, currencyCode: "SAR", partyId: "01900500-0000-7000-8000-000000000002" } as unknown as QuotationDetail;

function setup() {
  const hook = renderHook(() => useQuotationRevision(quotation, {}, vi.fn()));
  act(() => { hook.result.current.setValidUntil("2026-12-31"); });
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isBlocked = false;
  mocks.runWrite.mockResolvedValue(true);
  mocks.post.mockResolvedValue({});
});

describe("quotation revision duration terms", () => {
  it.each<[string, string, number, number]>([
    ["0", "0", 0, 0],
    ["", "", 14, 12],
    ["  ", "\t", 14, 12],
    [" 7 ", "24", 7, 24],
    ["9007199254740991", "9007199254740991", Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  ])("serializes delivery %j and warranty %j exactly", async (delivery, warranty, expectedDelivery, expectedWarranty) => {
    const { result } = setup();
    act(() => {
      result.current.setDeliveryDays(delivery);
      result.current.setWarrantyMonths(warranty);
    });
    expect(result.current.canSubmit).toBe(true);
    expect(result.current.deliveryDaysError).toBeUndefined();
    expect(result.current.warrantyMonthsError).toBeUndefined();
    await act(async () => { await result.current.submit(); });
    expect(mocks.runWrite).toHaveBeenCalledOnce();
    const request = mocks.runWrite.mock.calls[0][0];
    await request.send({ "x-idempotency-key": "key" });
    expect(mocks.post).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/quotations/${quotation.id}/revisions`,
      expect.objectContaining({ terms: {
        paymentTermCode: "NET_30", incotermCode: "EXW",
        deliveryDays: expectedDelivery, warrantyMonths: expectedWarranty,
      } }),
      expect.objectContaining({ headers: { "x-idempotency-key": "key", "if-match": '"7"' } }),
    );
  });

  it.each(["12months", "7abc", "-1", "1.5", "1e2", "+1", "1 2", "NaN", "Infinity", "9007199254740992", "9".repeat(400)])(
    "rejects %j in either field without replacing the input", async (invalid) => {
      const { result } = setup();
      act(() => { result.current.setDeliveryDays(invalid); });
      expect(result.current.deliveryDays).toBe(invalid);
      expect(result.current.deliveryDaysError).toBe("Enter a complete non-negative integer");
      expect(result.current.canSubmit).toBe(false);
      await act(async () => { await result.current.submit(); });
      expect(mocks.runWrite).not.toHaveBeenCalled();

      act(() => {
        result.current.setDeliveryDays("0");
        result.current.setWarrantyMonths(invalid);
      });
      expect(result.current.deliveryDaysError).toBeUndefined();
      expect(result.current.warrantyMonths).toBe(invalid);
      expect(result.current.warrantyMonthsError).toBe("Enter a complete non-negative integer");
      expect(result.current.canSubmit).toBe(false);
      await act(async () => { await result.current.submit(); });
      expect(mocks.runWrite).not.toHaveBeenCalled();
      expect(mocks.post).not.toHaveBeenCalled();

      act(() => { result.current.setWarrantyMonths("0"); });
      expect(result.current.warrantyMonthsError).toBeUndefined();
      expect(result.current.canSubmit).toBe(true);
    },
  );

  it("still refuses valid durations while a write is blocked", async () => {
    mocks.isBlocked = true;
    const { result } = setup();
    expect(result.current.canSubmit).toBe(false);
    await act(async () => { await result.current.submit(); });
    expect(mocks.runWrite).not.toHaveBeenCalled();
  });
});

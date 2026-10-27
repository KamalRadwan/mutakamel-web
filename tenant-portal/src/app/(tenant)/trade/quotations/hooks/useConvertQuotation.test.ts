// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuotationDetail } from "../quotation-contract";
import type { ConvertQuotationRequest } from "../quotation-conversion-contract";
import { useConvertQuotation } from "./useConvertQuotation";

const mocks = vi.hoisted(() => ({
  build: vi.fn(), post: vi.fn(), runWrite: vi.fn(),
  write: { isWriting: false, ambiguous: null as { idempotencyKey: string } | null },
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: {
  tradeDocuments: {
    quotations: { convert: "Convert" },
    quotationConversion: { sourceInvalid: "Reload the accepted revision", evidenceInvalid: "Complete evidence" },
  },
} }) }));
vi.mock("../../documents/hooks/useTradeWrite", () => ({
  useTradeWrite: () => ({ ...mocks.write, runWrite: mocks.runWrite }),
}));
vi.mock("../quotation-conversion-contract", () => ({ buildConvertQuotationToSalesOrder: mocks.build }));
vi.mock("../../trade-api", () => ({ tradePost: mocks.post, tradeIfMatch: (version: number) => `"${version}"` }));

const ID = "01890000-0000-7000-8000-000000000001";
// The serializer is mocked at this boundary; this hook only consumes these source fields.
const quotation = { id: ID, version: 7, currentLines: [{ clientLineId: ID }], revisions: [] } as unknown as QuotationDetail;
const payload: ConvertQuotationRequest = {
  lines: [{ clientLineId: ID, financial: {
    discountTotal: "0", chargeTotal: "0", taxTotal: "15", lineTotal: "115",
    taxSnapshot: { taxCode: "VAT-15", category: "STANDARD", rateBps: 1500 },
  } }],
  totals: { subtotal: "100", discountTotal: "0", chargeTotal: "0", taxTotal: "15", roundingTotal: "0", grandTotal: "115", amountPaid: "0", amountDue: "115" },
  terms: { paymentTermCode: "NET_30" },
};

function setup() {
  const onOpenChange = vi.fn();
  const onConverted = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(() => useConvertQuotation({
    quotation,
    headers: { "x-mutakamel-company-id": ID, "x-mutakamel-branch-id": ID },
    onOpenChange, onConverted,
  }));
  return { ...hook, onOpenChange, onConverted };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.write.isWriting = false;
  mocks.write.ambiguous = null;
  mocks.build.mockReturnValue(payload);
  mocks.runWrite.mockResolvedValue(true);
  mocks.post.mockResolvedValue({ data: {}, status: 201, headers: {} });
});

describe("conversion evidence review and write admission", () => {
  it("starts without inferred tax treatment or rate and refuses an unreviewed submit", async () => {
    const { result } = setup();
    expect(result.current.evidence[0]).toMatchObject({ taxCode: "", category: "", ratePercent: "" });
    await act(async () => { await result.current.handleSubmit(); });
    expect(mocks.runWrite).not.toHaveBeenCalled();
  });

  it("clears review whenever any line evidence changes", async () => {
    const { result } = setup();
    act(() => { result.current.setReviewed(true); });
    act(() => { result.current.updateEvidence(ID, "ratePercent", "15"); });
    expect(result.current.reviewed).toBe(false);
    expect(result.current.evidence[0].ratePercent).toBe("15");
    await act(async () => { await result.current.handleSubmit(); });
    expect(mocks.runWrite).not.toHaveBeenCalled();
  });

  it("blocks invalid evidence and renders a localized source refusal", async () => {
    mocks.build.mockImplementation(() => { throw new Error("QUOTATION_CONVERSION_SOURCE"); });
    const { result } = setup();
    act(() => { result.current.setReviewed(true); });
    expect(result.current.payload).toBeNull();
    expect(result.current.error).toBe("Reload the accepted revision");
    await act(async () => { await result.current.handleSubmit(); });
    expect(mocks.runWrite).not.toHaveBeenCalled();
  });

  it.each(["writing", "ambiguous"])("locks changes and another submit while %s", async (state) => {
    const { result, rerender } = setup();
    act(() => { result.current.setReviewed(true); });
    if (state === "writing") mocks.write.isWriting = true;
    else mocks.write.ambiguous = { idempotencyKey: ID };
    rerender();
    act(() => { result.current.updateEvidence(ID, "taxCode", "CHANGED"); });
    expect(result.current.evidence[0].taxCode).toBe("");
    await act(async () => { await result.current.handleSubmit(); });
    expect(mocks.runWrite).not.toHaveBeenCalled();
  });

  it("sends one reviewed payload with canonical routing, scope, version and supplied replay key", async () => {
    const { result, onOpenChange, onConverted } = setup();
    act(() => { result.current.setReviewed(true); });
    await act(async () => { await result.current.handleSubmit(); });
    expect(mocks.runWrite).toHaveBeenCalledTimes(1);
    const request = mocks.runWrite.mock.calls[0][0];
    await request.send({ "x-idempotency-key": ID });
    expect(mocks.post).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/quotations/${ID}/convert-to-sales-order`,
      payload,
      expect.objectContaining({ headers: {
        "x-mutakamel-company-id": ID, "x-mutakamel-branch-id": ID,
        "x-idempotency-key": ID, "if-match": '"7"',
      } }),
    );
    expect(onConverted).not.toHaveBeenCalled();
    request.onSuccess();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConverted).toHaveBeenCalledOnce();
  });
});

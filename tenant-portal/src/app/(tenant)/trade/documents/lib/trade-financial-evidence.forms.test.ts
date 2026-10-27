// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { useInvoiceFormDrawer } from "../../invoices/hooks/useInvoiceFormDrawer";
import { useContractFormDrawer } from "../../contracts/hooks/useContractFormDrawer";
import { useTradeOrderPricing } from "../hooks/useTradeOrderPricing";
import { createEmptyEvidenceLineDraft } from "./trade-financial-evidence";
import { invoiceResponse, contractResponse } from "../financial-document.test-fixtures";
import { parseInvoiceDetail } from "../../invoices/invoice-contract";
import { parseContractDetail } from "../../contracts/contract-contract";

const mocks = vi.hoisted(() => ({ post: vi.fn(), runWrite: vi.fn() }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("../../trade-api", () => ({ tradePost: mocks.post, tradePatch: vi.fn(), tradeIfMatch: vi.fn() }));
vi.mock("../hooks/useTradeWrite", () => ({
  useTradeWrite: () => ({ isBlocked: false, runWrite: mocks.runWrite }),
}));
vi.mock("../hooks/useTradeDocumentPricing", () => ({
  useTradeDocumentPricing: () => ({ ready: true, prices: [{ unitPrice: "0", error: null }] }),
}));

const ID = "0192f3a0-0000-7000-8000-000000000001";
const options = { open: true, headers: {}, onOpenChange: vi.fn(), onSaved: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.runWrite.mockImplementation(async ({ send }: { send: (headers: Record<string, string>) => Promise<unknown> }) => {
    await send({ "x-idempotency-key": ID });
  });
});
afterEach(cleanup);

describe("financial input submission guards", () => {
  it.each(["", "bad", "-1", "10000000000000000", "0.123456789"])("blocks invalid edited amounts %s", async (raw) => {
    const invoice = renderHook(() => useInvoiceFormDrawer({ ...options, invoice: parseInvoiceDetail(invoiceResponse) }));
    const contract = renderHook(() => useContractFormDrawer({ ...options, contract: parseContractDetail(contractResponse) }));
    act(() => {
      invoice.result.current.updateEditLine(0, { unitPrice: raw });
      contract.result.current.updateTotal("taxTotal", raw);
    });
    expect(invoice.result.current.canSubmit).toBe(false);
    expect(contract.result.current.canSubmit).toBe(false);
    expect(invoice.result.current.editLines[0].unitPrice).toBe(raw);
    expect(contract.result.current.editTotals.taxTotal).toBe(raw);
    await act(async () => {
      await invoice.result.current.handleSubmit();
      await contract.result.current.handleSubmit();
    });
    expect(mocks.runWrite).not.toHaveBeenCalled();
  });

  it.each([
    ["quantity", ""], ["quantity", "-1"], ["quantity", "0"],
    ["unitPrice", "bad"], ["unitPrice", "-1"], ["unitPrice", "10000000000000000"],
    ["taxRatePercent", "15oops"], ["taxRatePercent", "101"],
    ["discountAmount", "1"],
  ])("keeps invalid %s=%s in invoice/contract drafts and sends no write", async (field, value) => {
    const invoice = renderHook(() => useInvoiceFormDrawer(options));
    const contract = renderHook(() => useContractFormDrawer(options));
    const line = { ...createEmptyEvidenceLineDraft(), itemId: ID, uomCode: ID, [field]: value };
    act(() => {
      invoice.result.current.setPartyId(ID);
      invoice.result.current.setLines([line]);
      contract.result.current.setPartyId(ID);
      contract.result.current.setMode("FINANCIAL");
      contract.result.current.setLines([line]);
      contract.result.current.updateClause(0, { title: "Terms", body: "Agreed terms" });
    });
    expect(invoice.result.current.canSubmit).toBe(false);
    expect(contract.result.current.canSubmit).toBe(false);
    expect(invoice.result.current.lines[0]).toMatchObject({ [field]: value });
    expect(contract.result.current.lines[0]).toMatchObject({ [field]: value });
    await act(async () => {
      await invoice.result.current.handleSubmit();
      await contract.result.current.handleSubmit();
    });
    expect(mocks.runWrite).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("permits a valid zero-priced invoice", async () => {
    const { result } = renderHook(() => useInvoiceFormDrawer(options));
    act(() => {
      result.current.setPartyId(ID);
      result.current.setLines([{ ...createEmptyEvidenceLineDraft(), itemId: ID, uomCode: ID }]);
    });
    expect(result.current.canSubmit).toBe(true);
    await act(async () => { await result.current.handleSubmit(); });
    expect(mocks.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      totalsSnapshot: expect.objectContaining({ grandTotal: "0" }),
    }), expect.any(Object));
  });

  it("requires valid evidence even after order pricing is ready", () => {
    const line = { ...createEmptyEvidenceLineDraft(), quantity: "-1" };
    const { result, rerender } = renderHook(({ draft }) =>
      useTradeOrderPricing({}, "SAR", ID, "SALES", [draft], true), { initialProps: { draft: line } });
    expect(result.current.pricing.ready).toBe(true);
    expect(result.current.computed).toBeNull();
    rerender({ draft: { ...line, quantity: "1" } });
    expect(result.current.computed?.grandTotal).toBe("0");
  });
});

// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tradePatch, tradePost } from "../../trade-api";
import { DOCUMENT_ID, ITEM_ID, PARTY_ID, PROFILE_ID, invoiceResponse } from "../../documents/financial-document.test-fixtures";
import { parseInvoiceDetail } from "../invoice-contract";
import { useInvoiceFormDrawer } from "./useInvoiceFormDrawer";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { tradeDocuments: { executive: {
  editInvoice: "Edit invoice", newInvoice: "New invoice",
} } } }) }));
vi.mock("../../trade-api", () => ({
  tradePatch: vi.fn().mockResolvedValue({}), tradePost: vi.fn().mockResolvedValue({}),
  tradeIfMatch: (version: number) => `"${version}"`,
}));
vi.mock("../../documents/hooks/useTradeWrite", () => ({ useTradeWrite: () => ({
  isWriting: false,
  isBlocked: false,
  runWrite: async ({ send, onSuccess }: {
    send: (headers: Record<string, string>) => Promise<unknown>;
    onSuccess?: () => Promise<unknown>;
  }) => {
    await send({ "x-idempotency-key": DOCUMENT_ID });
    await onSuccess?.();
    return true;
  },
}) }));

describe("useInvoiceFormDrawer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a notes-only PATCH with complete persisted evidence and no create-only keys", async () => {
    const invoice = parseInvoiceDetail(invoiceResponse);
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useInvoiceFormDrawer({
      open: true, invoice, headers: {}, onOpenChange: vi.fn(), onSaved,
    }));
    expect(result.current.canSubmit).toBe(true);
    expect(result.current.editLines[0]!.itemId).toBe(ITEM_ID);
    expect(result.current.editLines[0]!.taxTotal).toBe("9.5375");
    act(() => result.current.setNotes("Changed notes"));
    await act(async () => result.current.handleSubmit());
    expect(tradePost).not.toHaveBeenCalled();
    const [path, body, options] = vi.mocked(tradePatch).mock.calls[0]!;
    expect(path).toBe(`/api/tenant/trade/v1/invoices/${DOCUMENT_ID}`);
    expect(body).toEqual({
      dueDate: invoice.dueDate, reference: invoice.reference, notes: "Changed notes",
      termsSnapshot: invoice.termsSnapshot, totalsSnapshot: invoice.totalsSnapshot,
      lines: result.current.editLines,
    });
    expect(options?.headers).toMatchObject({ "if-match": '"2"', "x-idempotency-key": DOCUMENT_ID });
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("round-trips multiple lines with distinct item identities, taxes and exact decimals", async () => {
    const source = invoiceResponse.lines[0]!;
    const response = {
      ...invoiceResponse,
      totalsSnapshot: {
        subtotal: "250", discountTotal: "13", chargeTotal: "4", taxTotal: "9.53750001",
        roundingTotal: "0.01249999", grandTotal: "250.55", amountPaid: "0", amountDue: "250.55",
      },
      lines: [source, {
        ...source, id: ITEM_ID, clientLineId: PROFILE_ID, itemCompanyProfileId: PARTY_ID,
        quantity: "1.00000000", unitPrice: "50.00000000", lineTotal: "50.25000001",
        descriptionSnapshot: null,
        printSnapshot: {
          item: { id: DOCUMENT_ID, companyProfileId: PARTY_ID },
          financial: {
            unitPrice: "50", discountTotal: "0.5", chargeTotal: "0.75", taxTotal: "0.00000001",
            lineTotal: "50.25000001", priceEvidence: { source: "CONTRACT", agreement: PROFILE_ID },
            taxEvidence: { rate: "0.00000002", jurisdiction: "EG", taxAmount: "0.00000001" },
          },
        },
      }],
    };
    const invoice = parseInvoiceDetail(response);
    const { result } = renderHook(() => useInvoiceFormDrawer({
      open: true, invoice, headers: {}, onOpenChange: vi.fn(), onSaved: vi.fn().mockResolvedValue(undefined),
    }));
    act(() => result.current.setNotes("Changed notes"));
    await act(async () => result.current.handleSubmit());
    expect(vi.mocked(tradePatch).mock.calls[0]![1]).toEqual({
      dueDate: response.dueDate, reference: response.reference, notes: "Changed notes",
      termsSnapshot: response.termsSnapshot, totalsSnapshot: response.totalsSnapshot,
      lines: response.lines.map((line) => ({
        clientLineId: line.clientLineId, itemId: line.printSnapshot.item.id, uomId: line.uomId,
        quantity: line.quantity, unitPrice: line.printSnapshot.financial.unitPrice,
        discountTotal: line.printSnapshot.financial.discountTotal,
        chargeTotal: line.printSnapshot.financial.chargeTotal,
        taxTotal: line.printSnapshot.financial.taxTotal, lineTotal: line.printSnapshot.financial.lineTotal,
        priceSnapshot: line.printSnapshot.financial.priceEvidence,
        taxSnapshot: line.printSnapshot.financial.taxEvidence,
        ...(line.descriptionSnapshot !== null ? { description: line.descriptionSnapshot } : {}),
      })),
    });
  });

  it("retains required party/currency fields and create defaults on POST", async () => {
    const { result } = renderHook(() => useInvoiceFormDrawer({
      open: true, headers: {}, onOpenChange: vi.fn(), onSaved: vi.fn().mockResolvedValue(undefined),
    }));
    act(() => {
      result.current.setPartyId(PARTY_ID);
      result.current.setLines([{ ...result.current.lines[0]!, itemId: ITEM_ID, uomCode: DOCUMENT_ID, unitPrice: "100" }]);
    });
    await act(async () => result.current.handleSubmit());
    expect(tradePatch).not.toHaveBeenCalled();
    expect(vi.mocked(tradePost).mock.calls[0]![1]).toMatchObject({
      partyId: PARTY_ID, currencyCode: "SAR",
      termsSnapshot: { paymentTermDays: 30, paymentMethodHint: "BANK_TRANSFER" },
    });
  });
});

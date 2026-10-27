// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tradePatch, tradePost } from "../../trade-api";
import { DOCUMENT_ID, PARTY_ID, contractResponse } from "../../documents/financial-document.test-fixtures";
import { parseContractDetail } from "../contract-contract";
import { useContractFormDrawer } from "./useContractFormDrawer";

vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: { tradeDocuments: { executive: {
  editContract: "Edit contract", newContract: "New contract",
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

describe("useContractFormDrawer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves tax, rounding, negotiated terms and provenance on a notes-only PATCH", async () => {
    const contract = parseContractDetail(contractResponse);
    const { result } = renderHook(() => useContractFormDrawer({
      open: true, contract, headers: {}, onOpenChange: vi.fn(), onSaved: vi.fn().mockResolvedValue(undefined),
    }));
    expect(result.current.editTotals).toEqual(contract.totalsSnapshot);
    expect(result.current.canSubmit).toBe(true);
    act(() => result.current.setNotes("Changed notes"));
    await act(async () => result.current.handleSubmit());
    expect(tradePost).not.toHaveBeenCalled();
    const [path, body, options] = vi.mocked(tradePatch).mock.calls[0]!;
    expect(path).toBe(`/api/tenant/trade/v1/contracts/${DOCUMENT_ID}`);
    expect(body).toEqual({
      effectiveFrom: contract.effectiveFrom, effectiveTo: contract.effectiveTo,
      reference: contract.reference, notes: "Changed notes", termsSnapshot: contract.termsSnapshot,
      financialTerms: contract.financialTerms,
      clauses: [{ clientClauseId: DOCUMENT_ID, title: "Term", body: "Negotiated agreement." }],
    });
    expect(options?.headers).toMatchObject({ "if-match": '"2"', "x-idempotency-key": DOCUMENT_ID });
  });

  it("edits actual tax totals while retaining rounding, custom terms and provenance", async () => {
    const contract = parseContractDetail(contractResponse);
    const { result } = renderHook(() => useContractFormDrawer({
      open: true, contract, headers: {}, onOpenChange: vi.fn(), onSaved: vi.fn().mockResolvedValue(undefined),
    }));
    act(() => result.current.updateTotal("taxTotal", "19.9"));
    expect(result.current.editTotals.grandTotal).toBe("1015.15");
    await act(async () => result.current.handleSubmit());
    expect(vi.mocked(tradePatch).mock.calls[0]![1]).toMatchObject({
      termsSnapshot: contract.termsSnapshot,
      financialTerms: { sourceEvidence: contract.financialTerms.sourceEvidence,
        totalsSnapshot: { taxTotal: "19.9", roundingTotal: "0.25", grandTotal: "1015.15" } },
    });
  });

  it("preserves the original snapshot after changing and restoring an amount", async () => {
    const contract = parseContractDetail(contractResponse);
    const { result } = renderHook(() => useContractFormDrawer({
      open: true, contract, headers: {}, onOpenChange: vi.fn(), onSaved: vi.fn().mockResolvedValue(undefined),
    }));
    act(() => result.current.updateTotal("taxTotal", "19.9"));
    act(() => {
      result.current.updateTotal("taxTotal", contract.totalsSnapshot.taxTotal);
      result.current.updateTotal("subtotal", "1000");
      result.current.setNotes("Changed notes");
    });
    await act(async () => result.current.handleSubmit());
    expect(vi.mocked(tradePatch).mock.calls[0]![1]).toMatchObject({
      notes: "Changed notes", termsSnapshot: contractResponse.termsSnapshot,
      financialTerms: { ...contract.financialTerms, totalsSnapshot: contractResponse.totalsSnapshot },
    });
  });

  it("preserves eight-decimal contract totals, source evidence and clause text on a notes-only save", async () => {
    const response = {
      ...contractResponse, currencyCode: "KWD",
      totalsSnapshot: {
        subtotal: "1000.12345678", discountTotal: "10.12345678", chargeTotal: "5.5", taxTotal: "49.775",
        roundingTotal: "0.00000001", grandTotal: "1045.27500001", amountPaid: "0", amountDue: "1045.27500001",
      },
      clauses: [{ ...contractResponse.clauses[0]!, title: "  Negotiated term  ", body: "First paragraph.\n\nSecond paragraph.\n" }],
    };
    const contract = parseContractDetail(response);
    const { result } = renderHook(() => useContractFormDrawer({
      open: true, contract, headers: {}, onOpenChange: vi.fn(), onSaved: vi.fn().mockResolvedValue(undefined),
    }));
    act(() => result.current.setNotes("Changed notes"));
    await act(async () => result.current.handleSubmit());
    expect(vi.mocked(tradePatch).mock.calls[0]![1]).toEqual({
      effectiveFrom: response.effectiveFrom, effectiveTo: response.effectiveTo,
      reference: response.reference, notes: "Changed notes", termsSnapshot: response.termsSnapshot,
      financialTerms: { mode: "FINANCIAL", sourceEvidence: response.termsSnapshot.financial.sourceEvidence,
        totalsSnapshot: response.totalsSnapshot },
      clauses: response.clauses.map((clause) => ({ clientClauseId: clause.id, title: clause.title, body: clause.body })),
    });
  });

  it("retains required identity fields and create defaults on POST", async () => {
    const { result } = renderHook(() => useContractFormDrawer({
      open: true, headers: {}, onOpenChange: vi.fn(), onSaved: vi.fn().mockResolvedValue(undefined),
    }));
    act(() => {
      result.current.setPartyId(PARTY_ID);
      result.current.updateClause(0, { title: "Term", body: "Agreement" });
    });
    await act(async () => result.current.handleSubmit());
    expect(tradePatch).not.toHaveBeenCalled();
    expect(vi.mocked(tradePost).mock.calls[0]![1]).toMatchObject({
      partyId: PARTY_ID, currencyCode: "SAR",
      termsSnapshot: { governingLawCountry: "SA", terminationNoticeDays: 30 },
      financialTerms: { sourceEvidence: { origin: "DIRECT_CONTRACT_DRAFT", currencyCode: "SAR" } },
    });
  });
});

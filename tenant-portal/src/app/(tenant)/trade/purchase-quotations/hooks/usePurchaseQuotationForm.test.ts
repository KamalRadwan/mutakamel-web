// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PurchaseQuotationDetail } from "../purchase-quotation-contract";
import { purchaseQuotationFixture } from "../purchase-quotation.fixture";
import { usePurchaseQuotationForm } from "./usePurchaseQuotationForm";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), patch: vi.fn(), runWrite: vi.fn(), saved: true,
}));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: {
  tradeDocuments: {
    purchaseQuotations: { editTitle: "Edit", createTitle: "Create", supplierEmpty: "Choose supplier" },
    currencyHint: "Choose currency",
    errors: { purchaseQuotationValidityInvalid: "Choose validity" },
  },
} }) }));
vi.mock("../../documents/hooks/useTradeWrite", () => ({
  useTradeWrite: () => ({ isWriting: false, isBlocked: false, runWrite: mocks.runWrite }),
}));
vi.mock("../../trade-api", () => ({
  tradeGet: mocks.get, tradePost: mocks.post, tradePatch: mocks.patch,
  tradeIfMatch: (version: number) => `"${version}"`,
}));

const HEADERS = { "x-mutakamel-company-id": purchaseQuotationFixture().companyId };
const REPLAY_HEADERS = { "x-idempotency-key": "019f0000-0000-7000-8000-000000000099" };

function setup(existing: PurchaseQuotationDetail | null = null) {
  const onSaved = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(() => usePurchaseQuotationForm(HEADERS, false, existing, onSaved));
  return { ...hook, onSaved };
}

function draftLines() {
  return purchaseQuotationFixture().lines.map(({ clientLineId, itemId, uomId, quantity, unitPrice }) => ({
    clientLineId, itemId, uomId, quantity, unitPrice, isPricing: false, priceError: null,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saved = true;
  mocks.get.mockRejectedValue(new Error("Catalogue unavailable"));
  mocks.post.mockImplementation(async (path: string, body: { itemId?: string; currencyCode?: string }) => ({
    data: path.endsWith("/pricing/evaluate") ? {
      unitPrice: purchaseQuotationFixture().lines.find((line) => line.itemId === body.itemId)?.unitPrice,
      currencyCode: body.currencyCode,
      priceBookId: purchaseQuotationFixture().id,
      minimumAllowedPrice: null,
    } : {},
    status: 201, headers: {},
  }));
  mocks.patch.mockResolvedValue({ data: {}, status: 200, headers: {} });
  mocks.runWrite.mockImplementation(async ({ send, onSuccess }: {
    send: (headers: Record<string, string>) => Promise<unknown>;
    onSuccess?: () => Promise<unknown>;
  }) => {
    await send(REPLAY_HEADERS);
    if (mocks.saved) await onSuccess?.();
    return mocks.saved;
  });
});

describe("purchase quotation form line lifecycle", () => {
  it("hydrates every existing line and omits them from a header-only PATCH", async () => {
    const existing = purchaseQuotationFixture();
    const { result, onSaved } = setup(existing);
    await act(async () => { result.current.open(); });
    await waitFor(() => expect(result.current.lineDraft.lines).toEqual(draftLines()));
    expect(result.current.canSubmit).toBe(true);
    act(() => { result.current.setValue({ reference: "Changed reference" }); });
    await act(async () => { await result.current.submit(); });
    expect(mocks.patch).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/purchase-quotations/${existing.id}`,
      expect.objectContaining({ reference: "Changed reference" }),
      expect.objectContaining({ headers: { ...HEADERS, ...REPLAY_HEADERS, "if-match": '"3"' } }),
    );
    expect(mocks.patch.mock.calls[0]?.[1]).not.toHaveProperty("lines");
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("submits every line, including untouched siblings, after a quantity edit", async () => {
    const { result } = setup(purchaseQuotationFixture());
    await act(async () => { result.current.open(); });
    await act(async () => { result.current.lineDraft.setQuantity(0, "4"); });
    await act(async () => { await result.current.submit(); });
    expect(mocks.patch.mock.calls[0]?.[1].lines).toEqual(
      purchaseQuotationFixture().lines.map(({ clientLineId, itemId, uomId, quantity }, index) => ({
        clientLineId, itemId, uomId, quantity: index === 0 ? "4" : quantity,
      })),
    );
  });

  it("discards unsaved edit lines before reopening the same document", async () => {
    const { result } = setup(purchaseQuotationFixture());
    await act(async () => { result.current.open(); });
    act(() => { result.current.lineDraft.removeLine(0); result.current.close(); });
    await act(async () => { result.current.open(); });
    await waitFor(() => expect(result.current.lineDraft.lines).toEqual(draftLines()));
  });

  it.each(["cancel", "save"])("starts a fresh create draft after %s", async (action) => {
    const { result, onSaved } = setup();
    const existing = purchaseQuotationFixture();
    await act(async () => { result.current.open(); });
    act(() => {
      result.current.setValue({
        supplierPartyId: existing.partyId, currencyCode: "EGP", validUntil: "2099-12-31",
      });
      result.current.lineDraft.reset(draftLines());
    });
    if (action === "save") {
      await act(async () => { await result.current.submit(); });
      expect(onSaved).toHaveBeenCalledOnce();
      expect(result.current.lineDraft.lines).toHaveLength(1);
      expect(result.current.lineDraft.lines[0]?.itemId).toBe("");
    } else {
      act(() => { result.current.close(); });
    }
    await act(async () => { result.current.open(); });
    expect(result.current.lineDraft.lines).toHaveLength(1);
    expect(result.current.lineDraft.lines[0]).toMatchObject({
      itemId: "", uomId: "", quantity: "1", unitPrice: null,
    });
    expect(existing.lines.map((line) => line.clientLineId))
      .not.toContain(result.current.lineDraft.lines[0]?.clientLineId);
    expect(result.current.values.supplierPartyId).toBe("");
  });

  it("retains the draft when a write is unsuccessful", async () => {
    mocks.saved = false;
    const { result, onSaved } = setup(purchaseQuotationFixture());
    await act(async () => { result.current.open(); });
    act(() => { result.current.setValue({ notes: "Retry this change" }); });
    await act(async () => { await result.current.submit(); });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.values.notes).toBe("Retry this change");
    await waitFor(() => expect(result.current.lineDraft.lines).toEqual(draftLines()));
    expect(onSaved).not.toHaveBeenCalled();
  });
});

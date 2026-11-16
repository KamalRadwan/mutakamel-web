// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTradeLineDraft } from "./useTradeLineDraft";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../trade-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../trade-api")>()),
  tradeGet: get,
  tradePost: post,
}));

const HEADERS = {
  "x-mutakamel-company-id": "0192f3a0-0000-7000-8000-000000000010",
  "x-mutakamel-branch-id": "0192f3a0-0000-7000-8000-000000000011",
};
const UOM_ID = "0192f3a0-0000-7000-8000-000000000012";

function item(id: string, code: string, barcode: string) {
  return {
    id,
    canonicalCode: code,
    barcode,
    localizedNames: { en: code },
    quotationDescription: `${code} quotation description`,
    salesOrderDescription: null,
    receiptDescription: null,
    deliveryOrderDescription: null,
    status: "ACTIVE",
    eligibility: {
      companyProfileId: "0192f3a0-0000-7000-8000-000000000013",
      companyProfileVersion: 1,
      companyProfileStatus: "ACTIVE",
      canSell: true,
      canPurchase: false,
      canPos: false,
      baseUomId: UOM_ID,
      defaultSalesUomId: UOM_ID,
      defaultPurchaseUomId: UOM_ID,
      branchProfileId: "0192f3a0-0000-7000-8000-000000000014",
      branchProfileVersion: 1,
      isAssorted: true,
    },
  };
}

const FIRST = item("0192f3a0-0000-7000-8000-000000000001", "SKU-FIRST", "111");
const MATCH = item("0192f3a0-0000-7000-8000-000000000002", "SKU-MATCH", "622123");

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation(async (path: string) => ({
    data: {
      items: path.includes("search=622123") ? [MATCH] : [FIRST],
      total: 1,
      page: 1,
      limit: 100,
    },
  }));
});

afterEach(cleanup);

describe("useTradeLineDraft item lookup", () => {
  it.each([
    ["1.", "1"],
    ["0.0", "0"],
    ["1.2500", "1.25"],
    ["10.0500", "10.05"],
    ["", ""],
    ["invalid", "invalid"],
    ["1.123456789", "1.123456789"],
  ])("keeps %j editable and commits it as %j without replacing invalid input", (raw, expected) => {
    const { result } = renderHook(() =>
      useTradeLineDraft(HEADERS, "EGP", null, "SALES", false),
    );
    act(() => result.current.setQuantity(0, raw));
    expect(result.current.lines[0]?.quantity).toBe(raw);
    act(() => result.current.commitQuantity(0));
    expect(result.current.lines[0]?.quantity).toBe(expected);
    if (raw === "0.0") expect(result.current.lineErrors[0]?.quantity).toBe("QUANTITY_INVALID");
  });

  it("searches the server with the document purpose and retains selected-result metadata", async () => {
    const { result } = renderHook(() =>
      useTradeLineDraft(HEADERS, "EGP", null, "SALES", true),
    );

    await waitFor(() => expect(result.current.items[0]?.id).toBe(FIRST.id));
    expect(get).toHaveBeenCalledWith(
      "/api/tenant/trade/v1/items?page=1&limit=100&purpose=SALES",
      expect.objectContaining({ headers: HEADERS }),
    );

    act(() => result.current.searchItems("622123"));

    await waitFor(() => expect(result.current.items[0]?.id).toBe(MATCH.id));
    expect(get).toHaveBeenCalledWith(
      "/api/tenant/trade/v1/items?page=1&limit=100&purpose=SALES&search=622123",
      expect.objectContaining({ headers: HEADERS }),
    );
    expect(result.current.itemsById[FIRST.id]?.canonicalCode).toBe("SKU-FIRST");
    expect(result.current.itemsById[MATCH.id]?.barcode).toBe("622123");
    expect(post).not.toHaveBeenCalled();
  });

  it("preserves padded server price evidence while normalizing only the arithmetic input", async () => {
    post.mockResolvedValue({ data: { unitPrice: "25.00000000", currencyCode: "EGP",
      priceBookId: FIRST.id, minimumAllowedPrice: null } });
    const { result } = renderHook(() =>
      useTradeLineDraft(HEADERS, "EGP", FIRST.id, "SALES", true),
    );
    act(() => result.current.reset([{ clientLineId: "0192f3a0-0000-7000-8000-000000000099",
      itemId: FIRST.id, uomId: UOM_ID, quantity: "1.12345678", unitPrice: null,
      isPricing: false, priceError: null }]));
    await waitFor(() => expect(result.current.lines[0]?.unitPrice).toBe("25.00000000"));
    expect(result.current.runningTotal).toBe("28.0864195");
    expect(result.current.invalidLineIndex).toBeNull();
    expect(result.current.lineErrors).toEqual([{}]);
  });

  it("does not retry a failed hydrated-item UOM lookup on every catalogue state update", async () => {
    get.mockImplementation(async (path: string) => {
      if (path.includes("/catalog/uoms")) throw new Error("UOM lookup unavailable");
      return { data: { items: [FIRST], total: 1, page: 1, limit: 100 } };
    });
    const { result } = renderHook(() =>
      useTradeLineDraft(HEADERS, "EGP", null, "SALES", true),
    );
    await waitFor(() => expect(result.current.items[0]?.id).toBe(FIRST.id));
    act(() => result.current.reset([{ clientLineId: "0192f3a0-0000-7000-8000-000000000099",
      itemId: FIRST.id, uomId: UOM_ID, quantity: "1", unitPrice: null,
      isPricing: false, priceError: null }]));
    await waitFor(() => expect(result.current.lookupError).not.toBeNull());
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(get.mock.calls.filter(([path]) => String(path).includes("/catalog/uoms"))).toHaveLength(1);
  });
});

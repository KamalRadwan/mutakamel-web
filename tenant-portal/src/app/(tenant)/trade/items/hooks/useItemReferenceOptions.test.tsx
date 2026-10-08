// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { useItemReferenceOptions } from "./useItemReferenceOptions";

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));

vi.mock("../../trade-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../trade-api")>(),
  tradeGet: get,
  tradePost: post,
}));

const ITEM_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const UOM_ID = "01890a5d-ac96-774b-bcce-b302099a8058";
const item = {
  id: ITEM_ID,
  canonicalCode: "SKU-1",
  itemKind: "PRODUCT",
  baseUomId: UOM_ID,
  localizedNames: { en: "Widget" },
  categoryId: null,
  categorySummary: null,
  variantIdentity: null,
  barcode: "ABC-1",
  notes: null,
  ownerUserId: null,
  weightKg: null,
  volumeM3: null,
  quotationDescription: null,
  salesOrderDescription: null,
  receiptDescription: null,
  deliveryOrderDescription: null,
  status: "ACTIVE",
  version: 1,
  updatedAt: "2026-09-27T09:00:00.000Z",
};
const page = (items: unknown[]) => ({ data: { items, total: items.length, page: 1, limit: 25 } });

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue(page([item]));
  post.mockResolvedValue(page([item]));
});

afterEach(cleanup);

describe("useItemReferenceOptions", () => {
  it("loads active products from tenant master and searches names, code or barcode", async () => {
    const { result } = renderHook(() => useItemReferenceOptions(true, []));

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(get).toHaveBeenCalledWith(
      "/api/tenant/trade/v1/items?page=1&limit=25&itemKind=PRODUCT&status=ACTIVE",
      expect.objectContaining({ headers: {} }),
    );

    await act(async () => result.current.search("  widget  "));
    expect(post).toHaveBeenCalledWith(
      "/api/tenant/trade/v1/items/search",
      {
        page: 1,
        limit: 25,
        itemKind: "PRODUCT",
        status: "ACTIVE",
        search: "widget",
        filters: [],
      },
      expect.objectContaining({ headers: {} }),
    );
    expect(result.current.labelFor(ITEM_ID)).toBe("Widget · SKU-1");
  });

  it("does not fetch while its form surface is closed", () => {
    renderHook(() => useItemReferenceOptions(false, []));
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});

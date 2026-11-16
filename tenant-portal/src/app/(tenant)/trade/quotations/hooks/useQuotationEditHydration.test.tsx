// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { CHANNEL_SCOPE_HEADER } from "../../trade-api";
import type { QuotationDetail, QuotationLine } from "../quotation-contract";
import { useQuotationEditHydration } from "./useQuotationEditHydration";

const { tradeGetMock, tradePostMock } = vi.hoisted(() => ({
  tradeGetMock: vi.fn(),
  tradePostMock: vi.fn(),
}));

vi.mock("../../trade-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../trade-api")>();
  return { ...actual, tradeGet: tradeGetMock, tradePost: tradePostMock };
});

const QUOTE_1 = "01890000-0000-7000-8000-000000000001";
const QUOTE_2 = "01890000-0000-7000-8000-000000000099";
const COMPANY_ID = "01890000-0000-7000-8000-000000000002";
const BRANCH_ID = "01890000-0000-7000-8000-000000000003";
const CHANNEL_ID = "01890000-0000-7000-8000-000000000004";
const PARTY_ID = "01890000-0000-7000-8000-000000000005";
const ITEM_MODERN = "01890000-0000-7000-8000-000000000011";
const ITEM_LEGACY = "01890000-0000-7000-8000-000000000012";
const ITEM_REPLACEMENT = "01890000-0000-7000-8000-000000000013";
const COMP_PROF_MODERN = "01890000-0000-7000-8000-000000000021";
const COMP_PROF_LEGACY = "01890000-0000-7000-8000-000000000022";
const COMP_PROF_OTHER = "01890000-0000-7000-8000-000000000023";
const UOM_EA = "01890000-0000-7000-8000-000000000031";
const LINE_1 = "01890000-0000-7000-8000-000000000051";
const LINE_2 = "01890000-0000-7000-8000-000000000052";

function makeQuotation(id: string, lines: QuotationLine[]): QuotationDetail {
  return {
    id, version: 1, companyId: COMPANY_ID, branchId: BRANCH_ID, channelId: CHANNEL_ID,
    partyId: PARTY_ID, contactPartyId: null, currencyCode: "EGP", businessDate: "2026-08-31",
    lifecycleStatus: "DRAFT", approvalStatus: "NOT_REQUIRED", fulfillmentStatus: "UNPLANNED",
    billingStatus: "NOT_BILLED", grandTotal: "100", documentNumber: "QT-1", draftReference: null,
    partySnapshot: { displayName: "Customer" }, createdBy: null,
    createdAt: "2026-08-31T00:00:00.000Z", updatedAt: "2026-08-31T00:00:00.000Z",
    currentRevisionId: null, acceptedRevisionId: null, crmCustomerProfileId: null,
    customerEligibilitySource: "ACTIVE_COMMERCIAL_ACCOUNT", revisions: [], currentLines: lines,
  };
}

const MODERN_LINE: QuotationLine = {
  id: LINE_1, printLineNumber: 1, clientLineId: LINE_1, descriptionSnapshot: "Saved modern desc",
  uomId: UOM_EA, quantity: "2.0000", unitPrice: "50.00000000", discountTotal: "0", lineTotal: "100.00000000",
  itemCompanyProfileId: COMP_PROF_MODERN,
  discountSnapshot: { itemId: ITEM_MODERN, uomId: UOM_EA, clientLineId: LINE_1 },
};

const LEGACY_LINE: QuotationLine = {
  id: LINE_2, printLineNumber: 2, clientLineId: LINE_2, descriptionSnapshot: "Saved legacy desc",
  uomId: UOM_EA, quantity: "1.0000", unitPrice: "30.00000000", discountTotal: "0", lineTotal: "30.00000000",
  itemCompanyProfileId: COMP_PROF_LEGACY, taxSnapshot: { sku: "LEG-100", uomCode: "EA" },
  discountSnapshot: {},
};

const UOM_RESPONSE = {
  data: {
    items: [{ id: UOM_EA, code: "EA", displayName: "Each", isBaseUom: true, canSell: true, canPurchase: true }],
    total: 1, page: 1, limit: 100,
  },
};

describe("useQuotationEditHydration", () => {
  beforeEach(() => {
    tradeGetMock.mockReset();
    tradePostMock.mockReset();
  });

  it("resolves off-page modern GET /items/:id and legacy POST /items/search with pinned scope headers", async () => {
    tradeGetMock.mockImplementation(async (path: string) => {
      if (path.endsWith(`/items/${ITEM_MODERN}`)) {
        return {
          data: {
            id: ITEM_MODERN, canonicalCode: "MOD-100", localizedNames: { en: "Modern Valve" },
            status: "ACTIVE", baseUomId: UOM_EA,
            companyProfile: {
              id: COMP_PROF_MODERN, version: 1, status: "ACTIVE",
              canSell: true, canPurchase: true, canPos: false, defaultSalesUomId: UOM_EA, defaultPurchaseUomId: UOM_EA,
            },
            branchProfile: { id: BRANCH_ID, version: 1, isAssorted: true },
          },
        };
      }
      return UOM_RESPONSE;
    });
    tradePostMock.mockResolvedValue({
      data: {
        items: [{
          id: ITEM_LEGACY, canonicalCode: "LEG-100", localizedNames: { en: "Legacy Gasket" }, status: "ACTIVE",
          eligibility: {
            companyProfileId: COMP_PROF_LEGACY, companyProfileVersion: 1, companyProfileStatus: "ACTIVE",
            canSell: true, canPurchase: true, canPos: false, baseUomId: UOM_EA, defaultSalesUomId: UOM_EA,
            defaultPurchaseUomId: UOM_EA, branchProfileId: BRANCH_ID, branchProfileVersion: 1, isAssorted: true,
          },
        }],
        total: 1, page: 1, limit: 100,
      },
    });

    const onHydrated = vi.fn();
    const onCatalogResolved = vi.fn();
    const quotation = makeQuotation(QUOTE_1, [MODERN_LINE, LEGACY_LINE]);
    const { result } = renderHook(() =>
      useQuotationEditHydration({ quotation, enabled: true, onHydrated, onCatalogResolved }),
    );

    expect(result.current.isHydrating).toBe(true);
    expect(result.current.canPreviewPricing).toBe(false);

    await waitFor(() => expect(result.current.isHydrating).toBe(false));

    expect(tradeGetMock).toHaveBeenCalledWith(
      `/api/tenant/trade/v1/items/${ITEM_MODERN}`,
      expect.objectContaining({
        headers: {
          [COMPANY_SCOPE_HEADER]: COMPANY_ID,
          [BRANCH_SCOPE_HEADER]: BRANCH_ID,
          [CHANNEL_SCOPE_HEADER]: CHANNEL_ID,
        },
      }),
    );
    expect(tradePostMock).toHaveBeenCalledWith(
      "/api/tenant/trade/v1/items/search",
      { page: 1, limit: 100, filters: [{ field: "canonicalCode", value: "LEG-100" }] },
      expect.objectContaining({
        headers: {
          [COMPANY_SCOPE_HEADER]: COMPANY_ID,
          [BRANCH_SCOPE_HEADER]: BRANCH_ID,
          [CHANNEL_SCOPE_HEADER]: CHANNEL_ID,
        },
      }),
    );
    expect(result.current.canPreviewPricing).toBe(true);
    expect(result.current.lineDisplayById[LINE_1]?.itemName).toBe("Modern Valve");
    expect(result.current.lineDisplayById[LINE_1]?.uomCode).toBe("EA");
    expect(result.current.lineDisplayById[LINE_2]?.itemName).toBe("Legacy Gasket");
    expect(onHydrated).toHaveBeenCalledTimes(1);
    expect(onCatalogResolved).toHaveBeenCalledWith(
      expect.objectContaining({ resolvedLegacyItemByLineId: { [LINE_2]: ITEM_LEGACY }, ineligibleLineIds: [] }),
    );
  });

  it("blocks 404 item lookup and mismatched legacy companyProfileId until replaced, while degrading gracefully on 403", async () => {
    tradeGetMock.mockRejectedValueOnce(
      new TenantApiClientError("Not found", { status: 404, statusText: "Not Found", headers: new Headers(), data: {} }, "http"),
    );
    tradePostMock.mockResolvedValueOnce({
      data: {
        items: [{
          id: ITEM_LEGACY, canonicalCode: "LEG-100", localizedNames: { en: "Wrong Company Item" }, status: "ACTIVE",
          eligibility: {
            companyProfileId: COMP_PROF_OTHER, companyProfileVersion: 1, companyProfileStatus: "ACTIVE",
            canSell: true, canPurchase: true, canPos: false, baseUomId: UOM_EA, defaultSalesUomId: UOM_EA,
            defaultPurchaseUomId: UOM_EA, branchProfileId: BRANCH_ID, branchProfileVersion: 1, isAssorted: true,
          },
        }],
        total: 1, page: 1, limit: 100,
      },
    });

    const quotation = makeQuotation(QUOTE_1, [MODERN_LINE, LEGACY_LINE]);
    const replacementItem = {
      id: ITEM_REPLACEMENT, canonicalCode: "REP-1", barcode: null, localizedNames: { en: "Replacement" },
      quotationDescription: null, salesOrderDescription: null, receiptDescription: null, deliveryOrderDescription: null,
      status: "ACTIVE", image: null,
      eligibility: {
        companyProfileId: COMP_PROF_MODERN, companyProfileVersion: 1, companyProfileStatus: "ACTIVE",
        canSell: true, canPurchase: true, canPos: false, baseUomId: UOM_EA, defaultSalesUomId: UOM_EA,
        defaultPurchaseUomId: UOM_EA, branchProfileId: BRANCH_ID, branchProfileVersion: 1, isAssorted: true,
      },
    };

    const { result, rerender } = renderHook(
      ({ activeLines }) => useQuotationEditHydration({
        quotation, enabled: true, activeLines, catalogItemsById: { [ITEM_REPLACEMENT]: replacementItem },
      }),
      {
        initialProps: {
          activeLines: [
            { clientLineId: LINE_1, itemId: ITEM_MODERN, uomId: UOM_EA, quantity: "2", unitPrice: "50", isPricing: false, priceError: null },
            { clientLineId: LINE_2, itemId: "", uomId: UOM_EA, quantity: "1", unitPrice: "30", isPricing: false, priceError: null },
          ],
        },
      },
    );

    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    expect(result.current.lineDisplayById[LINE_1]?.status).toBe("INELIGIBLE_ITEM");
    expect(result.current.lineDisplayById[LINE_2]?.status).toBe("UNRESOLVED_LEGACY");
    expect(result.current.canPreviewPricing).toBe(false);

    rerender({
      activeLines: [
        { clientLineId: LINE_1, itemId: ITEM_REPLACEMENT, uomId: UOM_EA, quantity: "2", unitPrice: "50", isPricing: false, priceError: null },
      ],
    });
    expect(result.current.canPreviewPricing).toBe(true);
    expect(result.current.canSubmitRevision).toBe(true);

    // 403 on modern item lookup degrades without erasing verified modern itemId, and retryHydrationLookups re-queries.
    tradeGetMock.mockRejectedValueOnce(
      new TenantApiClientError("Forbidden", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} }, "http"),
    );
    const quote2 = makeQuotation(QUOTE_2, [MODERN_LINE]);
    const { result: degraded } = renderHook(() => useQuotationEditHydration({ quotation: quote2, enabled: true }));
    await waitFor(() => expect(degraded.current.isHydrating).toBe(false));
    expect(degraded.current.lineDisplayById[LINE_1]).toMatchObject({
      itemId: ITEM_MODERN, status: "READY", lookupDegraded: true,
    });
    expect(degraded.current.canPreviewPricing).toBe(true);

    tradeGetMock.mockImplementation(async (path: string) =>
      path.endsWith(`/items/${ITEM_MODERN}`)
        ? {
            data: {
              id: ITEM_MODERN, canonicalCode: "MOD-100", localizedNames: { en: "Recovered Valve" }, status: "ACTIVE", baseUomId: UOM_EA,
              companyProfile: {
                id: COMP_PROF_MODERN, version: 1, status: "ACTIVE",
                canSell: true, canPurchase: true, canPos: false, defaultSalesUomId: UOM_EA, defaultPurchaseUomId: UOM_EA,
              },
              branchProfile: { id: BRANCH_ID, version: 1, isAssorted: true },
            },
          }
        : UOM_RESPONSE,
    );
    act(() => degraded.current.retryHydrationLookups());
    await waitFor(() => expect(degraded.current.lineDisplayById[LINE_1]?.itemName).toBe("Recovered Valve"));
    expect(degraded.current.lineDisplayById[LINE_1]?.lookupDegraded).toBe(false);
  });
});

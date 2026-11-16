// @vitest-environment jsdom

import { createContext, useCallback, useContext, useState, type PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import type { PriceBook, PricingReferenceAccount } from "../../price-books/pricing-contract";
import { usePricingWorkbench } from "./usePricingWorkbench";

const COMPANY = "0192f3a0-0000-7000-8000-000000000001";
const ITEM = "0192f3a0-0000-7000-8000-000000000002";
const UOM = "0192f3a0-0000-7000-8000-000000000003";
const SUPPLIER = "0192f3a0-0000-7000-8000-000000000004";
const PURCHASE_BOOK = "0192f3a0-0000-7000-8000-000000000005";
const CHANNEL_A = "0192f3a0-0000-7000-8000-000000000006";
const CHANNEL_B = "0192f3a0-0000-7000-8000-000000000007";
const SALES_BOOK = "0192f3a0-0000-7000-8000-000000000008";

const harness = vi.hoisted(() => ({
  post: vi.fn(),
  channelChanged: vi.fn(),
  channelsLoading: false,
  initialChannelId: null as string | null,
  toast: { outcomeFromApi: vi.fn(() => false) },
}));

interface TestScope {
  channelId: string | null;
  selectChannel: (channelId: string) => void;
}

const ScopeContext = createContext<TestScope>({
  channelId: null,
  selectChannel: () => { throw new Error("Missing test scope provider"); },
});

function ScopeHarness({ children }: PropsWithChildren) {
  const [channelId, selectChannel] = useState(harness.initialChannelId);
  return (
    <ScopeContext.Provider value={{ channelId, selectChannel }}>
      {children}
    </ScopeContext.Provider>
  );
}

const purchaseBook: PriceBook = {
  id: PURCHASE_BOOK, code: "PURCHASE", purpose: "PURCHASE", currencyCode: "EGP",
  status: "ACTIVE", version: 1, versionCount: 0, versions: [],
};
const supplier: PricingReferenceAccount = {
  id: SUPPLIER, partyId: SUPPLIER, displayName: "Supplier", partyType: "ORGANIZATION",
  accountRole: "SUPPLIER", priceBookId: PURCHASE_BOOK, status: "ACTIVE",
};
const currencies = [{ code: "EGP", name: "Egyptian Pound", isDefault: true }];
const reference = {
  data: { items: [], uoms: [], branches: [], commercialAccounts: [supplier] },
  books: [purchaseBook], isLoading: false,
  itemById: new Map(), uomById: new Map(), bookById: new Map([[PURCHASE_BOOK, purchaseBook]]),
};

vi.mock("../../trade-api", () => ({ tradePost: harness.post }));
vi.mock("@/design-system", () => ({ useToast: () => harness.toast }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("../../price-books/hooks/usePricingReferenceData", () => ({
  usePricingReferenceData: () => reference,
}));
vi.mock("./usePricingCurrencies", () => ({ usePricingCurrencies: () => ({ currencies }) }));
vi.mock("../../useTradeScope", () => ({
  useTradeScope: function useSharedScope() {
    const scope = useContext(ScopeContext);
    return {
      context: { companyId: COMPANY, branchId: null, channelId: scope.channelId },
      branchIds: [], selectBranch: vi.fn(),
    };
  },
}));
vi.mock("../../trade-advanced-scope", () => ({
  hasTradePermission: () => true,
  useTradeScope: function useRequestScope() {
    const { channelId } = useContext(ScopeContext);
    return {
      headers: {
        "x-mutakamel-company-id": COMPANY,
        ...(channelId ? { "x-mutakamel-channel-id": channelId } : {}),
      },
      isResolved: true, permissions: ["trade.pricing.read"], isTenantOwner: true,
    };
  },
}));
vi.mock("./usePricingScopeOptions", () => ({
  usePricingScopeOptions: function useScopeOptions(options?: { onChannelScopeChange?: () => void }) {
    const { channelId, selectChannel } = useContext(ScopeContext);
    const onScopeChange = options?.onChannelScopeChange;
    const changeChannel = useCallback((next: string) => {
      harness.channelChanged(next);
      selectChannel(next);
      onScopeChange?.();
    }, [selectChannel, onScopeChange]);
    return {
      context: { companyId: COMPANY, branchId: null, channelId },
      channelOptions: [{ value: CHANNEL_A, label: "Channel A" }, { value: CHANNEL_B, label: "Channel B" }],
      isLoadingChannels: harness.channelsLoading,
      changeChannel,
    };
  },
}));

beforeEach(() => {
  window.history.replaceState({}, "", "/trade/pricing");
  harness.initialChannelId = null;
  harness.channelsLoading = false;
  harness.channelChanged.mockClear();
  harness.post.mockReset().mockResolvedValue({ data: {
    decisionId: ITEM, outcome: "ALLOW", unitPrice: "100", baselineUnitPrice: "100",
    currencyCode: "EGP", priceBookId: SALES_BOOK, priceBookVersionId: UOM,
    minimumAllowedPrice: null, matchedPromotions: [],
  } });
});
afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/trade/pricing");
});

describe("pricing workbench transitions", () => {
  it("clears the supplier and purchase book when retail changes PURCHASE to SALES", async () => {
    const { result } = renderHook(() => usePricingWorkbench(), { wrapper: ScopeHarness });
    await act(async () => {
      result.current.setValue({
        purpose: "PURCHASE", itemId: ITEM, uomId: UOM, quantity: "25",
        currencyCode: "EGP", partyId: SUPPLIER, priceBookId: PURCHASE_BOOK,
      });
    });
    expect(result.current.values).toMatchObject({ purpose: "PURCHASE", partyId: SUPPLIER, priceBookId: PURCHASE_BOOK });
    expect(result.current.allAccountOptions).toContainEqual(expect.objectContaining({ value: SUPPLIER }));

    await act(async () => { result.current.selectScenarioPreset("retail"); });

    expect(result.current.values).toMatchObject({
      purpose: "SALES", quantity: "10.00", partyId: "", priceBookId: "",
      itemId: ITEM, uomId: UOM, currencyCode: "EGP",
    });
    expect(result.current.activePreset).toBe("retail");
    expect(result.current.allAccountOptions).toEqual([]);
    await act(async () => { await result.current.evaluate(); });
    expect(harness.post).toHaveBeenCalledOnce();
    expect(harness.post.mock.calls[0]![1]).toMatchObject({ purpose: "SALES", quantity: "10.00" });
    expect(harness.post.mock.calls[0]![1]).not.toHaveProperty("partyId");
    expect(harness.post.mock.calls[0]![1]).not.toHaveProperty("priceBookId");
  });

  it.each([null, CHANNEL_A])("waits to show URL channel B and clear its DTO override before auto-evaluating from %s", async (initialChannelId) => {
    harness.initialChannelId = initialChannelId;
    harness.channelsLoading = true;
    const query = new URLSearchParams({ itemId: ITEM, uomId: UOM, quantity: "10", currencyCode: "EGP", channelId: CHANNEL_B });
    window.history.replaceState({}, "", `/trade/pricing?${query}`);
    const { result, rerender } = renderHook(() => usePricingWorkbench(), { wrapper: ScopeHarness });

    await act(async () => { await Promise.resolve(); });
    expect(result.current.scopeOptions.context.channelId).toBe(initialChannelId);
    expect(result.current.values.channelId).toBe(CHANNEL_B);
    expect(harness.channelChanged).not.toHaveBeenCalled();
    expect(harness.post).not.toHaveBeenCalled();

    harness.channelsLoading = false;
    rerender();
    await waitFor(() => expect(harness.post).toHaveBeenCalledOnce());

    expect(harness.channelChanged).toHaveBeenCalledWith(CHANNEL_B);
    expect(result.current.scopeOptions.context.channelId).toBe(CHANNEL_B);
    expect(result.current.values.channelId).toBe("");
    const [, request, options] = harness.post.mock.calls[0]!;
    expect(request).not.toHaveProperty("channelId");
    expect(options.headers).toMatchObject({ "x-mutakamel-channel-id": CHANNEL_B });
    expect(result.current.formError).toBeNull();
    expect(result.current.result?.unitPrice).toBe("100");

    rerender();
    await act(async () => { await Promise.resolve(); });
    expect(harness.post).toHaveBeenCalledOnce();
  });
});

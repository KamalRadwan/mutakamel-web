// @vitest-environment jsdom

import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { emptyTradeLine, type TradeLineDraft, type TradeLineDraftState } from "../../documents/hooks/useTradeLineDraft";
import type { TradeItemOption, TradeUomOption } from "../../documents/trade-lookup-contract";
import { useQuotationPricing } from "../hooks/useQuotationPricing";
import { defaultQuotationDiscount, type QuotationDiscountDraft } from "../quotation-discount-draft";
import { DISCOUNT_HEADERS, DISCOUNT_IDS, quotationPricingCalculation, quotationPricingRequest } from "../quotation-discount.test-fixtures";
import { QuotationLineWorkspace, type QuotationLineDisplayMap } from "./QuotationLineWorkspace";

const mocks = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  policy: {
    canApply: true,
    hasApplyPermission: true,
    canManage: true,
    configured: true,
    limit: {
      id: "019f0000-0000-7000-8000-000000000009",
      version: 1,
      maxPercent: "20",
      allowFreeItems: false,
      reasonRequired: false,
    },
  },
}));

const DICT_BY_LANG = { en, ar } as const;
const DIR_BY_LANG = { en: "ltr", ar: "rtl" } as const;

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: DICT_BY_LANG[mocks.lang],
    lang: mocks.lang,
    dir: DIR_BY_LANG[mocks.lang],
  }),
}));
vi.mock("../hooks/useQuotationDiscountPolicy", () => ({
  useQuotationDiscountPolicy: () => ({ policy: mocks.policy, loading: false, error: null, retry: vi.fn() }),
}));
vi.mock("../hooks/useQuotationPricingPreview", () => ({
  useQuotationPricingPreview: ({ request }: { request: ReturnType<typeof quotationPricingRequest> | null }) => ({
    calculation: request ? quotationPricingCalculation(request) : quotationPricingCalculation(),
    ready: true,
    error: null,
    loading: false,
    stale: false,
    retry: vi.fn(),
  }),
}));
vi.mock("../hooks/useQuotationDiscountLimits", () => ({
  useQuotationDiscountLimits: () => ({ setOpen: vi.fn() }),
}));
vi.mock("../../documents/hooks/useTradeDocumentPricing", () => ({
  useTradeDocumentPricing: ({ lines }: { lines: Array<{ itemId: string }> }) => ({
    ready: true,
    prices: lines.map(() => ({ unitPrice: "100", decision: null, isPricing: false, error: null })),
  }),
}));

const REPLACEMENT_ITEM_ID = "019f0000-0000-7000-8000-000000000016";
const LEGACY_LINE_ID = "019f0000-0000-7000-8000-000000000015";

const CATALOG_ITEM: TradeItemOption = {
  id: DISCOUNT_IDS.item,
  canonicalCode: "SRV-R760",
  barcode: null,
  localizedNames: { en: "PowerEdge Rack Server", ar: "خادم راك باور إيدج" },
  quotationDescription: "2U Dual Xeon Gold 6430, 128GB ECC DDR5, redundant 1400W PSU",
  salesOrderDescription: null,
  receiptDescription: null,
  deliveryOrderDescription: null,
  status: "ACTIVE",
  itemKind: "PRODUCT",
  image: null,
  eligibility: {
    companyProfileId: "019f0000-0000-7000-8000-000000000021",
    companyProfileVersion: 1,
    companyProfileStatus: "ACTIVE",
    canSell: true,
    canPurchase: true,
    canPos: false,
    baseUomId: DISCOUNT_IDS.uom,
    defaultSalesUomId: DISCOUNT_IDS.uom,
    defaultPurchaseUomId: DISCOUNT_IDS.uom,
    branchProfileId: "019f0000-0000-7000-8000-000000000022",
    branchProfileVersion: 1,
    isAssorted: true,
  },
};

const REPLACEMENT_ITEM: TradeItemOption = {
  ...CATALOG_ITEM,
  id: REPLACEMENT_ITEM_ID,
  canonicalCode: "DOCK-PRO-2",
  localizedNames: { en: "Thunderbolt 4 Pro Dock", ar: "قاعدة توصيل ثندربولت 4" },
  quotationDescription: "12-in-1 96W PD USB4 Thunderbolt workstation dock",
};

const EA_UOM: TradeUomOption = {
  id: DISCOUNT_IDS.uom,
  code: "EA",
  displayName: "Each",
  isBaseUom: true,
  canSell: true,
  canPurchase: true,
};

function WorkspaceHarness({
  initialLines,
  initialDiscount = defaultQuotationDiscount(),
  lineDisplayById,
}: {
  initialLines: TradeLineDraft[];
  initialDiscount?: QuotationDiscountDraft;
  lineDisplayById?: QuotationLineDisplayMap;
}) {
  const [lines, setLines] = useState<TradeLineDraft[]>(initialLines);
  const [discountDraft, setDiscountDraft] = useState<QuotationDiscountDraft>(initialDiscount);

  const items = [CATALOG_ITEM, REPLACEMENT_ITEM];
  const itemsById = { [CATALOG_ITEM.id]: CATALOG_ITEM, [REPLACEMENT_ITEM.id]: REPLACEMENT_ITEM };
  const uomsByItem = { [CATALOG_ITEM.id]: [EA_UOM], [REPLACEMENT_ITEM.id]: [EA_UOM] };

  const draft: TradeLineDraftState = {
    lines,
    items,
    itemsById,
    uomsByItem,
    lookupError: null,
    isLoadingItems: false,
    runningTotal: "100",
    invalidLineIndex: null,
    lineErrors: lines.map(() => ({})),
    purpose: "SALES",
    searchItems: vi.fn(),
    addLine: () => setLines((prev) => [...prev, emptyTradeLine()]),
    removeLine: (index) =>
      setLines((prev) => (prev.length > 1 ? prev.filter((_, pos) => pos !== index) : [emptyTradeLine()])),
    setItem: (index, itemId) =>
      setLines((prev) => prev.map((row, pos) => (pos === index ? { ...row, itemId } : row))),
    setUom: (index, uomId) =>
      setLines((prev) => prev.map((row, pos) => (pos === index ? { ...row, uomId } : row))),
    setQuantity: (index, quantity) =>
      setLines((prev) => prev.map((row, pos) => (pos === index ? { ...row, quantity } : row))),
    commitQuantity: vi.fn(),
    reset: (next) => setLines(next.length > 0 ? next : [emptyTradeLine()]),
    appendItems: (selected) =>
      setLines((prev) => [
        ...prev.filter((row) => row.itemId || row.uomId || row.quantity !== "1"),
        ...selected.map((sel) => ({ ...emptyTradeLine(), ...sel })),
      ]),
    ensureItemUoms: vi.fn(async () => [EA_UOM]),
    retryLookups: vi.fn(),
    restore: vi.fn(),
  };

  const pricing = useQuotationPricing({
    draft: discountDraft,
    update: setDiscountDraft,
    headers: DISCOUNT_HEADERS,
    currencyCode: "SAR",
    partyId: DISCOUNT_IDS.party,
    contextKey: "customer-1",
    lines,
    enabled: true,
    locked: false,
    stale: false,
    clearWriteError: vi.fn(),
  });

  return (
    <QuotationLineWorkspace
      draft={draft}
      pricing={pricing}
      currencyCode="SAR"
      partyId={DISCOUNT_IDS.party}
      headers={DISCOUNT_HEADERS}
      lineDisplayById={lineDisplayById}
      compact
    />
  );
}

afterEach(cleanup);
beforeEach(() => {
  mocks.lang = "en";
});

describe("QuotationLineWorkspace dense editable grid", () => {
  it("renders numbered rows and spans the empty table when no discount is selected", async () => {
    render(<WorkspaceHarness initialLines={[emptyTradeLine()]} />);
    await act(async () => {
      await Promise.resolve();
    });

    const table = screen.getByRole("table");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers).toHaveLength(8);
    expect(headers[0]).toHaveAccessibleName(en.common.rowNumber);
    for (const header of headers) {
      expect(header).toHaveAttribute("scope", "col");
    }
    expect(within(table).getByRole("columnheader", { name: en.dashboard.description })).toBeTruthy();

    const bodyRows = table.querySelectorAll("tbody tr");
    expect(bodyRows).toHaveLength(1);
    expect(bodyRows[0]?.querySelector("td")).toHaveAttribute("colspan", "9");
    expect(within(bodyRows[0] as HTMLElement).getByText(en.quotationExperience.itemEmpty)).toBeTruthy();
  });

  it("renders independent read-only Description from itemDescriptionPreview, honors frozen snapshot override, and keeps the full multiline copy visible", async () => {
    const longFrozenDescription = `Frozen spec snapshot:\n${"X".repeat(450)} END-SPEC`;
    const populatedLine: TradeLineDraft = {
      clientLineId: DISCOUNT_IDS.line,
      itemId: DISCOUNT_IDS.item,
      uomId: DISCOUNT_IDS.uom,
      quantity: "2",
      unitPrice: "100",
      isPricing: false,
      priceError: null,
    };

    const { rerender } = render(<WorkspaceHarness initialLines={[populatedLine]} />);
    await act(async () => {
      await Promise.resolve();
    });

    const table = screen.getByRole("table");
    const cells = table.querySelector("tbody tr")?.querySelectorAll("td");
    expect(cells?.[0]).toHaveTextContent("1");
    expect(cells?.[1]).toHaveAttribute("aria-hidden", "true");
    expect(cells?.[1]?.querySelector("svg")).toBeInTheDocument();
    expect(cells?.[2]).toHaveTextContent("PowerEdge Rack Server");
    expect(within(table).getByText("PowerEdge Rack Server")).toBeTruthy();
    expect(within(table).queryByText("SRV-R760")).toBeNull();
    expect(within(table).getByText(/2U Dual Xeon Gold 6430/)).toBeVisible();
    expect(screen.queryByRole("textbox", { name: /description/i })).toBeNull();

    rerender(
      <WorkspaceHarness
        initialLines={[populatedLine]}
        lineDisplayById={{ [DISCOUNT_IDS.line]: { description: longFrozenDescription, uomCode: "EA" } }}
      />,
    );

    const description = within(table).getByText(/Frozen spec snapshot:/i);
    expect(within(table).queryByText(/2U Dual Xeon Gold 6430/)).toBeNull();
    expect(description).toHaveAttribute("dir", "auto");
    expect(description).toHaveClass("whitespace-pre-wrap", "wrap-anywhere");
    expect(description.textContent).toBe(longFrozenDescription);
  });
  it("applies natural first-strong bidi wrapping directly on <bdi dir='auto'> without destabilizing cell width bounds", async () => {
    const arabicCloudPbxSpec = "باقة سنترال سحابى شاملة التسجيل والتوجيه الذكى والتقارير اللحظية";
    const mixedArabicIpPhoneSpec = "هاتف IP احترافى بشاشة ملونة ودعم Wi-Fi و Bluetooth مدمج";
    const secondLineId = "019f0000-0000-7000-8000-000000000017";

    const lineOne: TradeLineDraft = {
      clientLineId: DISCOUNT_IDS.line,
      itemId: DISCOUNT_IDS.item,
      uomId: DISCOUNT_IDS.uom,
      quantity: "2",
      unitPrice: "100",
      isPricing: false,
      priceError: null,
    };
    const lineTwo: TradeLineDraft = {
      clientLineId: secondLineId,
      itemId: REPLACEMENT_ITEM_ID,
      uomId: DISCOUNT_IDS.uom,
      quantity: "3",
      unitPrice: "100",
      isPricing: false,
      priceError: null,
    };

    const { rerender } = render(
      <WorkspaceHarness
        initialLines={[lineOne, lineTwo]}
        lineDisplayById={{
          [DISCOUNT_IDS.line]: { description: arabicCloudPbxSpec, uomCode: "EA" },
          [secondLineId]: { description: mixedArabicIpPhoneSpec, uomCode: "EA" },
        }}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });

    const table = screen.getByRole("table");
    for (const text of [arabicCloudPbxSpec, mixedArabicIpPhoneSpec]) {
      const description = within(table).getByText(text);
      expect(description).toHaveAttribute("dir", "auto");
      expect(description).toHaveClass("whitespace-pre-wrap", "wrap-anywhere");
      expect(description.closest("td")).toHaveClass("min-w-44", "max-w-80", "text-start");
    }
    mocks.lang = "ar";
    rerender(<WorkspaceHarness initialLines={[lineOne]} />);
    const rtlDescription = within(table).getByText(/2U Dual Xeon Gold 6430/);
    expect(rtlDescription).toHaveAttribute("dir", "auto");
    expect(rtlDescription).toHaveClass("whitespace-pre-wrap");
  });
  it("supports replacing an unavailable line using the bin and Add items", async () => {
    const unresolvedLine: TradeLineDraft = {
      clientLineId: LEGACY_LINE_ID,
      itemId: "",
      uomId: "",
      quantity: "3",
      unitPrice: null,
      isPricing: false,
      priceError: null,
    };
    const activeLine: TradeLineDraft = {
      clientLineId: DISCOUNT_IDS.line,
      itemId: DISCOUNT_IDS.item,
      uomId: DISCOUNT_IDS.uom,
      quantity: "1",
      unitPrice: "100",
      isPricing: false,
      priceError: null,
    };
    const displayMap: QuotationLineDisplayMap = {
      [LEGACY_LINE_ID]: {
        itemName: "Legacy Dock D1",
        sku: "LEG-DOCK-1",
        description: "4-port legacy docking station",
        uomCode: "EA",
        unavailable: true,
      },
    };

    render(<WorkspaceHarness initialLines={[unresolvedLine, activeLine]} lineDisplayById={displayMap} />);
    await act(async () => {
      await Promise.resolve();
    });

    const table = screen.getByRole("table");
    expect(within(table).getByText("Legacy Dock D1")).toBeTruthy();
    expect(within(table).queryByText("LEG-DOCK-1")).toBeNull();
    expect(within(table).getByText(en.audit.valueUnavailable)).toBeTruthy();
    expect(within(table).getByText(/4-port legacy docking station/i)).toBeTruthy();

    const row = within(table).getByRole("row", { name: /Legacy Dock D1/ });
    const actions = within(row).getAllByRole("button");
    expect(actions).toHaveLength(1);
    fireEvent.click(within(row).getByRole("button", { name: `${en.quotationExperience.removeItem}: Legacy Dock D1` }));
    fireEvent.click(screen.getByRole("button", { name: en.quotationExperience.addItems }));
    const reopenedDialog = screen.getByRole("dialog");
    const replacementCheckbox = within(reopenedDialog).getAllByRole("checkbox", {
      name: `${en.quotationExperience.addItems}: Thunderbolt 4 Pro Dock`,
    })[0];
    fireEvent.click(replacementCheckbox);
    const commitAdd = within(reopenedDialog).getByRole("button", {
      name: en.quotationExperience.addItemsCount.replace("{count}", "1"),
    });
    fireEvent.click(commitAdd);

    expect(within(table).queryByText("Legacy Dock D1")).toBeNull();
    expect(within(table).getByText("Thunderbolt 4 Pro Dock")).toBeTruthy();
    expect(within(table).getByText("PowerEdge Rack Server")).toBeTruthy();

    // Add items appends the new line and preserves the untouched line.
    const rows = table.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("PowerEdge Rack Server");
    expect(rows[1]?.textContent).toContain("Thunderbolt 4 Pro Dock");
  });

  it("removes an unavailable row directly via the inline Remove action", async () => {
    const unresolvedLine: TradeLineDraft = {
      clientLineId: LEGACY_LINE_ID,
      itemId: "",
      uomId: "",
      quantity: "1",
      unitPrice: null,
      isPricing: false,
      priceError: null,
    };
    const displayMap: QuotationLineDisplayMap = {
      [LEGACY_LINE_ID]: {
        itemName: "Obsolete Adapter",
        sku: "OBS-01",
        description: "Discontinued legacy adapter",
        uomCode: "EA",
        unavailable: true,
      },
    };

    render(<WorkspaceHarness initialLines={[unresolvedLine]} lineDisplayById={displayMap} />);
    await act(async () => {
      await Promise.resolve();
    });

    const table = screen.getByRole("table");
    expect(within(table).getByText("Obsolete Adapter")).toBeTruthy();

    fireEvent.click(
      within(table).getByRole("button", {
        name: `${en.quotationExperience.removeItem}: Obsolete Adapter`,
      }),
    );

    expect(within(table).queryByText("Obsolete Adapter")).toBeNull();
    expect(within(table).getByText(en.quotationExperience.itemEmpty)).toBeTruthy();
  });

  it("subtracts promotion savings once in the last table row and the totals", async () => {
    render(<WorkspaceHarness initialLines={[{
      clientLineId: DISCOUNT_IDS.line,
      itemId: DISCOUNT_IDS.item,
      uomId: DISCOUNT_IDS.uom,
      quantity: "1",
      unitPrice: "100",
      isPricing: false,
      priceError: null,
    }]} initialDiscount={{ ...defaultQuotationDiscount(), mode: "PROMOTIONS" }} />);
    await act(async () => { await Promise.resolve(); });

    const table = within(screen.getByRole("table"));
    const rows = table.getAllByRole("row");
    expect(within(rows[1]).getAllByText(/120\.00/)).toHaveLength(2);
    expect(rows.at(-1)).toHaveClass("bg-destructive/10");
    expect(within(rows.at(-1)!).getByRole("rowheader", { name: en.quotationDiscount.promotionDiscount })).toBeTruthy();
    expect(within(rows.at(-1)!).getByText(/-.*20\.00/)).toBeTruthy();

    const totals = screen.getByText(en.quotationDiscount.subtotal, { selector: "dt" }).closest("dl")!;
    expect(Array.from(totals.querySelectorAll("dt"), (label) => label.textContent)).toEqual([
      en.quotationDiscount.subtotal, en.quotationDiscount.discount, en.quotationDiscount.total,
    ]);
    expect(Array.from(totals.querySelectorAll("dd"), (value) => value.textContent)).toEqual([
      expect.stringMatching(/120\.00/), expect.stringMatching(/-.*20\.00/), expect.stringMatching(/100\.00/),
    ]);
  });

  it("supports compact LTR decimal inputs for Qty and LINE discounts and renders localized Arabic RTL labels", async () => {
    mocks.lang = "ar";
    const populatedLine: TradeLineDraft = {
      clientLineId: DISCOUNT_IDS.line,
      itemId: DISCOUNT_IDS.item,
      uomId: DISCOUNT_IDS.uom,
      quantity: "2",
      unitPrice: "100",
      isPricing: false,
      priceError: null,
    };
    const lineDiscountDraft: QuotationDiscountDraft = {
      ...defaultQuotationDiscount(),
      mode: "DISCOUNT",
      scope: "LINE",
      lineDiscounts: { [DISCOUNT_IDS.line]: { type: "PERCENT", value: "5" } },
    };

    render(<WorkspaceHarness initialLines={[populatedLine]} initialDiscount={lineDiscountDraft} />);
    await act(async () => {
      await Promise.resolve();
    });

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: ar.dashboard.description })).toBeTruthy();
    expect(within(table).getByRole("columnheader", { name: ar.quotationDiscount.lineDiscount })).toBeTruthy();

    // Mobile card renders separately labelled Arabic Description ("الوصف")
    expect(screen.getAllByText(ar.dashboard.description).length).toBeGreaterThanOrEqual(2);

    const qtyInput = within(table).getByRole("textbox", { name: `${ar.quotationExperience.quantity} 1` });
    expect(qtyInput).toHaveAttribute("dir", "ltr");
    expect(qtyInput).toHaveValue("2");
    fireEvent.keyDown(qtyInput, { key: "ArrowUp" });
    expect(qtyInput).toHaveValue("3");

    const discountInput = within(table).getByRole("textbox", { name: `${ar.quotationDiscount.lineDiscount} 1` });
    expect(discountInput).toHaveAttribute("dir", "ltr");
    expect(discountInput).toHaveValue("5");
    fireEvent.change(discountInput, { target: { value: "12.5" } });
    expect(discountInput).toHaveValue("12.5");
  });
});

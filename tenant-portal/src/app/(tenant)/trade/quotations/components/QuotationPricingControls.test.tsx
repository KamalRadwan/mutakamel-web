// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { QUOTATION_PERMISSIONS } from "../quotation-contract";
import { defaultQuotationDiscount, type QuotationDiscountDraft } from "../quotation-discount-draft";
import { DISCOUNT_HEADERS, DISCOUNT_IDS, quotationPricingCalculation } from "../quotation-discount.test-fixtures";
import { useQuotationPricing } from "../hooks/useQuotationPricing";
import { QuotationPricingControls } from "./QuotationPricingControls";

const mocks = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  permissions: ["trade.quotations.create", "trade.quotations.update", "trade.quotations.discount"],
  previewNull: false,
  previewError: null as {
    status: number;
    code: string;
    clientLineIds: string[];
    fieldErrors?: Record<string, string[]>;
  } | null,
  policyLoading: false,
  policyError: null as { status: number; code: string } | null,
  policyRetry: vi.fn(),
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
  manage: vi.fn(),
  renderedLimitsDialog: 0,
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: mocks.lang === "ar" ? ar : en,
    lang: mocks.lang,
    dir: mocks.lang === "ar" ? "rtl" : "ltr",
  }),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { id: DISCOUNT_IDS.actor, permissions: mocks.permissions } }),
}));
vi.mock("../hooks/useQuotationDiscountPolicy", () => ({
  useQuotationDiscountPolicy: () => ({
    policy: mocks.policyError || mocks.policyLoading ? null : mocks.policy,
    loading: mocks.policyLoading,
    error: mocks.policyError,
    retry: mocks.policyRetry,
  }),
}));
vi.mock("../hooks/useQuotationPricingPreview", () => ({
  useQuotationPricingPreview: () => ({
    calculation: mocks.previewError || mocks.previewNull ? null : quotationPricingCalculation(),
    ready: !mocks.previewError && !mocks.previewNull,
    error: mocks.previewError,
    loading: false,
    stale: false,
    retry: vi.fn(),
  }),
}));
vi.mock("../hooks/useQuotationDiscountLimits", () => ({
  useQuotationDiscountLimits: () => ({ setOpen: mocks.manage }),
}));
vi.mock("./QuotationDiscountLimitsDialog", () => ({
  QuotationDiscountLimitsDialog: () => {
    mocks.renderedLimitsDialog += 1;
    return <div data-testid="limits-dialog-mounted" />;
  },
}));

function Harness({
  initialDraft,
  currencyCode = "EGP",
  requiredPermission,
}: {
  initialDraft?: QuotationDiscountDraft;
  currencyCode?: string;
  requiredPermission?: string;
}) {
  const [draft, update] = useState<QuotationDiscountDraft>(() => initialDraft ?? defaultQuotationDiscount());
  const state = useQuotationPricing({
    draft,
    update,
    headers: DISCOUNT_HEADERS,
    currencyCode,
    partyId: DISCOUNT_IDS.party,
    contextKey: "customer-a",
    lines: [
      {
        clientLineId: DISCOUNT_IDS.line,
        itemId: DISCOUNT_IDS.item,
        uomId: DISCOUNT_IDS.uom,
        quantity: "1",
        unitPrice: null,
        isPricing: false,
        priceError: null,
      },
    ],
    enabled: true,
    locked: false,
    stale: false,
    clearWriteError: vi.fn(),
  });
  return <>
    <QuotationPricingControls state={state} currencyCode={currencyCode} requiredPermission={requiredPermission} />
    {/* Test-only probes: the exact DTO the preview/save path receives, plus the per-line
        type/value hooks the editable grid calls for LINE scope. */}
    <pre data-testid="pricing-request">{JSON.stringify(state.request)}</pre>
    <pre data-testid="pricing-draft">{JSON.stringify(draft)}</pre>
    <button type="button" data-testid="line-amount" onClick={() => {
      state.discount.setLineType(DISCOUNT_IDS.line, "AMOUNT");
    }} />
    <button type="button" data-testid="line-value" onClick={() => {
      state.discount.setLineValue(DISCOUNT_IDS.line, draft.lineDiscounts[DISCOUNT_IDS.line]?.type === "AMOUNT" ? "25.5" : "7");
    }} />
  </>;
}

afterEach(cleanup);
beforeEach(() => {
  mocks.lang = "en";
  mocks.permissions = ["trade.quotations.create", "trade.quotations.update", "trade.quotations.discount"];
  mocks.previewNull = false;
  mocks.previewError = null;
  mocks.policyLoading = false;
  mocks.policyError = null;
  mocks.policyRetry.mockReset();
  mocks.policy.canApply = true;
  mocks.policy.hasApplyPermission = true;
  mocks.policy.canManage = true;
  mocks.policy.configured = true;
  mocks.policy.limit.reasonRequired = false;
  mocks.manage.mockReset();
  mocks.renderedLimitsDialog = 0;
});

describe("quotation pricing mode controls", () => {
  it("uses a labeled mode switch, mounts limits dialog, and hides duplicate add-item actions by default", async () => {
    render(<Harness />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("radio", { name: en.quotationDiscount.none })).toHaveAttribute("data-state", "on");
    expect(screen.getByTestId("limits-dialog-mounted")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /add item/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.quotationDiscount.manageLimits }));
    expect(mocks.manage).toHaveBeenCalledWith(true);
  });

  it("leaves calculated promotion savings to the quotation items and totals", async () => {
    mocks.previewNull = true;
    const promotionDraft = { ...defaultQuotationDiscount(), mode: "PROMOTIONS" } as const;
    const { rerender } = render(<Harness initialDraft={promotionDraft} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText(new RegExp(en.quotationDiscount.promotionSavings))).toBeNull();
    mocks.previewNull = false;
    rerender(<Harness initialDraft={promotionDraft} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText(new RegExp(en.quotationDiscount.promotionSavings))).toBeNull();
  });

  it("starts with None, keeps the reason optional and retains intent when cancelling a mode change", async () => {
    mocks.policy.limit.reasonRequired = true;
    render(<Harness />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("radio", { name: en.quotationDiscount.none })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Discount" }));
    const valueInput = screen.getByRole("textbox", { name: en.quotationDiscount.percentValue });
    expect(valueInput).toHaveAttribute("dir", "ltr");
    expect(screen.queryByText(en.quotationDiscount.reasonRequired)).toBeNull();
    fireEvent.change(valueInput, { target: { value: "15" } });
    fireEvent.change(screen.getByRole("textbox", { name: en.quotationDiscount.reasonOptional }), {
      target: { value: "Approved enterprise tier" },
    });
    expect(screen.queryByText(en.quotationDiscount.reasonRequired)).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Promotions" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.quotationDiscount.keepCurrent }));
    expect(screen.getByRole("textbox", { name: en.quotationDiscount.percentValue })).toHaveValue("15");
    fireEvent.click(screen.getByRole("radio", { name: "Promotions" }));
    fireEvent.click(screen.getByRole("button", { name: en.quotationDiscount.confirmChange }));
    expect(screen.queryByRole("textbox", { name: en.quotationDiscount.percentValue })).toBeNull();
  });

  it("renders loading, policyMissing, policyDenied, mode-aware 403 PermissionGate, and retryable non-403 policy errors", async () => {
    mocks.policyLoading = true;
    const { unmount } = render(<Harness />);
    expect(screen.getByRole("status")).toHaveTextContent(en.quotationDiscount.policyLoading);
    unmount();

    mocks.policyLoading = false;
    mocks.policy.canApply = false;
    mocks.policy.configured = false;
    mocks.policy.hasApplyPermission = true;
    const missingView = render(<Harness />);
    expect(screen.getByRole("radio", { name: "Discount" })).toBeDisabled();
    expect(screen.getByText(en.quotationDiscount.policyMissing)).toBeTruthy();
    expect(screen.getByRole("button", { name: en.quotationDiscount.manageLimits })).not.toBeDisabled();
    missingView.unmount();

    mocks.policy.hasApplyPermission = false;
    const deniedView = render(<Harness />);
    expect(screen.getByText(en.quotationDiscount.policyDenied)).toBeTruthy();
    deniedView.unmount();

    mocks.policyError = { status: 403, code: "TRADE.AUTH.DENIED" };
    const forbiddenEditView = render(<Harness requiredPermission={QUOTATION_PERMISSIONS.update} />);
    expect(screen.getByText(en.permissionGate.title)).toBeTruthy();
    forbiddenEditView.unmount();

    mocks.policyError = { status: 500, code: "INTERNAL" };
    render(<Harness />);
    expect(screen.getByRole("alert")).toHaveTextContent(en.quotationDiscount.policyUnavailable);
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(mocks.policyRetry).toHaveBeenCalledTimes(1);
  });

  it("surfaces policy status and keeps Promotions clickable when a hydrated DISCOUNT quote opens under canApply=false", async () => {
    mocks.policy.canApply = false;
    mocks.policy.hasApplyPermission = true;
    render(
      <Harness
        initialDraft={{
          mode: "DISCOUNT",
          scope: "DOCUMENT",
          type: "PERCENT",
          value: "10",
          lineDiscounts: {},
          reason: "Maker discount",
        }}
      />,
    );
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("status")).toHaveTextContent(en.quotationDiscount.policyMissing);
    const promotionsRadio = screen.getByRole("radio", { name: "Promotions" });
    expect(promotionsRadio).not.toBeDisabled();
    fireEvent.click(promotionsRadio);
    fireEvent.click(screen.getByRole("button", { name: en.quotationDiscount.confirmChange }));
    expect(screen.getByRole("radio", { name: "Promotions" })).toHaveAttribute("data-state", "on");
  });

  it("surfaces currency reset notice when currency changes on an AMOUNT discount and allows dismissal", async () => {
    const { rerender } = render(
      <Harness
        currencyCode="EGP"
        initialDraft={{
          mode: "DISCOUNT",
          scope: "DOCUMENT",
          type: "AMOUNT",
          value: "250",
          lineDiscounts: {},
          reason: "Cash rebate",
        }}
      />,
    );
    await act(async () => { await Promise.resolve(); });
    rerender(<Harness currencyCode="USD" />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(en.quotationDiscount.currencyReset)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.common.close }));
    expect(screen.queryByText(en.quotationDiscount.currencyReset)).toBeNull();
  });

  it.each(["en", "ar"] as const)("explains an unspecified server discount refusal with currency-aware guidance in %s", async (lang) => {
    mocks.lang = lang;
    mocks.previewError = { status: 422, code: "TRADE.QUOTE.DISCOUNT_INVALID", clientLineIds: [] };
    render(<Harness />);
    await act(async () => { await Promise.resolve(); });
    const copy = (lang === "ar" ? ar : en).quotationDiscount;
    expect(screen.getByRole("alert")).toHaveTextContent(copy.invalidDiscount);
    expect(screen.queryByText(copy.invalidValue)).toBeNull();
  });

  it("retains precise currency guidance when the server supplies that reason", async () => {
    mocks.previewError = {
      status: 422,
      code: "TRADE.QUOTE.DISCOUNT_INVALID",
      clientLineIds: [],
      fieldErrors: { value: ["CURRENCY_PRECISION"] },
    };
    render(<Harness />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("alert")).toHaveTextContent(en.quotationDiscount.currencyPrecision);
  });

  it("maps TRADE.PRICE.* preview errors and distinguishes 403 BOOK_OVERRIDE_FORBIDDEN from discount PermissionGate", async () => {
    mocks.previewError = {
      status: 422,
      code: "TRADE.PRICE.NO_ELIGIBLE_PRICE",
      clientLineIds: [],
    };
    const noPriceView = render(<Harness />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("alert")).toHaveTextContent(en.tradeDocuments.errors.priceNoEligiblePrice);
    expect(screen.getByText("TRADE.PRICE.NO_ELIGIBLE_PRICE")).toBeTruthy();
    noPriceView.unmount();

    mocks.previewError = {
      status: 403,
      code: "TRADE.PRICE.BOOK_OVERRIDE_FORBIDDEN",
      clientLineIds: [],
    };
    const overrideForbiddenView = render(<Harness />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("alert")).toHaveTextContent(en.quotationExperience.writePermission);
    expect(screen.getByText("TRADE.PRICE.BOOK_OVERRIDE_FORBIDDEN")).toBeTruthy();
    expect(screen.queryByText(en.permissionGate.title)).toBeNull();
    overrideForbiddenView.unmount();

    mocks.previewError = {
      status: 403,
      code: "TRADE.AUTH.TARGET_DENIED",
      clientLineIds: [],
    };
    render(<Harness />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(en.permissionGate.title)).toBeTruthy();
  });
});

describe("discount scope and type segmented controls (live select regression)", () => {
  const requestDto = () => JSON.parse(screen.getByTestId("pricing-request").textContent ?? "null");
  const draftState = () => JSON.parse(screen.getByTestId("pricing-draft").textContent ?? "null");
  const flush = () => act(async () => { await Promise.resolve(); });
  // Radix focus-return work is deferred to a macrotask; the live bug was a dismissal that
  // only happened after that tick, so every confirmation assertion waits one past it.
  const macrotask = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  const confirm = async () => {
    await macrotask();
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en.quotationDiscount.confirmChange }));
    await flush();
  };

  it("renders scope and type as labelled radio groups with no popup combobox", async () => {
    render(<Harness />);
    await flush();
    fireEvent.click(screen.getByRole("radio", { name: "Discount" }));
    await flush();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.getByRole("radiogroup", { name: en.quotationDiscount.scope })).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: en.quotationDiscount.type })).toBeTruthy();
    expect(screen.getByRole("radio", { name: en.quotationDiscount.documentScope })).toHaveAttribute("data-state", "on");
    expect(screen.getByRole("radio", { name: en.quotationDiscount.percent })).toHaveAttribute("data-state", "on");
  });

  it("reproduces the live case: Fixed amount with value 9 and reason survives the confirmation and changes the DTO", async () => {
    render(<Harness initialDraft={{ mode: "DISCOUNT", scope: "DOCUMENT", type: "PERCENT", value: "9",
      lineDiscounts: {}, reason: "QA-DENSE-DOC-PCT" }} />);
    await flush();
    expect(requestDto().pricing).toEqual({ mode: "DISCOUNT", scope: "DOCUMENT", type: "PERCENT", value: "9",
      reason: "QA-DENSE-DOC-PCT" });

    fireEvent.click(screen.getByRole("radio", { name: en.quotationDiscount.amount }));
    await macrotask();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(draftState().type).toBe("PERCENT");
    fireEvent.click(screen.getByRole("button", { name: en.quotationDiscount.keepCurrent }));
    await macrotask();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("radio", { name: en.quotationDiscount.percent })).toHaveAttribute("data-state", "on");
    expect(draftState()).toMatchObject({ type: "PERCENT", value: "9" });

    fireEvent.click(screen.getByRole("radio", { name: en.quotationDiscount.amount }));
    await confirm();
    await macrotask();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("radio", { name: en.quotationDiscount.amount })).toHaveAttribute("data-state", "on");
    expect(screen.getByRole("radio", { name: en.quotationDiscount.percent })).toHaveAttribute("data-state", "off");
    expect(draftState()).toMatchObject({ scope: "DOCUMENT", type: "AMOUNT", value: "0", reason: "QA-DENSE-DOC-PCT" });
    fireEvent.change(screen.getByRole("textbox", { name: en.quotationDiscount.value }), { target: { value: "250.75" } });
    await flush();
    expect(requestDto().pricing).toEqual({ mode: "DISCOUNT", scope: "DOCUMENT", type: "AMOUNT", value: "250.75",
      reason: "QA-DENSE-DOC-PCT" });
  });

  it("walks all four scope/type combinations by click and emits the exact pricing and line DTOs", async () => {
    render(<Harness />);
    await flush();
    fireEvent.click(screen.getByRole("radio", { name: "Discount" }));
    await flush();

    // 1. DOCUMENT + PERCENT
    fireEvent.change(screen.getByRole("textbox", { name: en.quotationDiscount.percentValue }), { target: { value: "12.5" } });
    await flush();
    expect(requestDto().pricing).toEqual({ mode: "DISCOUNT", scope: "DOCUMENT", type: "PERCENT", value: "12.5" });
    expect(requestDto().lines[0]).not.toHaveProperty("discount");

    // 2. DOCUMENT + AMOUNT (entries exist -> confirmation)
    fireEvent.click(screen.getByRole("radio", { name: en.quotationDiscount.amount }));
    await confirm();
    fireEvent.change(screen.getByRole("textbox", { name: en.quotationDiscount.value }), { target: { value: "40" } });
    await flush();
    expect(requestDto().pricing).toEqual({ mode: "DISCOUNT", scope: "DOCUMENT", type: "AMOUNT", value: "40" });
    expect(requestDto().lines[0]).not.toHaveProperty("discount");

    // 3. LINE + PERCENT (entries exist -> confirmation; document type control disappears)
    fireEvent.click(screen.getByRole("radio", { name: en.quotationDiscount.lineScope }));
    await confirm();
    expect(screen.getByRole("radio", { name: en.quotationDiscount.lineScope })).toHaveAttribute("data-state", "on");
    expect(screen.queryByRole("radiogroup", { name: en.quotationDiscount.type })).toBeNull();
    expect(draftState()).toMatchObject({ scope: "LINE", type: "PERCENT", value: "0", lineDiscounts: {} });
    expect(requestDto().pricing).toEqual({ mode: "DISCOUNT", scope: "LINE" });
    fireEvent.click(screen.getByTestId("line-value"));
    await flush();
    expect(requestDto().lines[0].discount).toEqual({ type: "PERCENT", value: "7" });

    // 4. LINE + AMOUNT
    fireEvent.click(screen.getByTestId("line-amount"));
    await flush();
    fireEvent.click(screen.getByTestId("line-value"));
    await flush();
    expect(requestDto().pricing).toEqual({ mode: "DISCOUNT", scope: "LINE" });
    expect(requestDto().lines[0].discount).toEqual({ type: "AMOUNT", value: "25.5" });

    // Back to the whole quotation: cancel keeps line entries, confirm resets to DOCUMENT/PERCENT/0.
    fireEvent.click(screen.getByRole("radio", { name: en.quotationDiscount.documentScope }));
    await macrotask();
    fireEvent.click(screen.getByRole("button", { name: en.quotationDiscount.keepCurrent }));
    await flush();
    expect(requestDto().lines[0].discount).toEqual({ type: "AMOUNT", value: "25.5" });
    fireEvent.click(screen.getByRole("radio", { name: en.quotationDiscount.documentScope }));
    await confirm();
    expect(draftState()).toMatchObject({ scope: "DOCUMENT", type: "PERCENT", value: "0", lineDiscounts: {} });
    expect(requestDto().pricing).toEqual({ mode: "DISCOUNT", scope: "DOCUMENT", type: "PERCENT", value: "0" });
  });

  it("switches without confirmation when nothing is entered and keeps RTL direction on the groups", async () => {
    mocks.lang = "ar";
    render(<Harness initialDraft={{ mode: "DISCOUNT", scope: "DOCUMENT", type: "PERCENT", value: "0",
      lineDiscounts: {}, reason: "" }} />);
    await flush();
    const copy = ar.quotationDiscount;
    expect(screen.getByRole("radiogroup", { name: copy.scope })).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("radiogroup", { name: copy.type })).toHaveAttribute("dir", "rtl");
    fireEvent.click(screen.getByRole("radio", { name: copy.amount }));
    await macrotask();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("radio", { name: copy.amount })).toHaveAttribute("data-state", "on");
    expect(requestDto().pricing).toEqual({ mode: "DISCOUNT", scope: "DOCUMENT", type: "AMOUNT", value: "0" });
    fireEvent.click(screen.getByRole("radio", { name: copy.lineScope }));
    await macrotask();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(requestDto().pricing).toEqual({ mode: "DISCOUNT", scope: "LINE" });
    // Re-clicking the active segment must not deselect into an invalid empty value.
    fireEvent.click(screen.getByRole("radio", { name: copy.lineScope }));
    await flush();
    expect(draftState().scope).toBe("LINE");
  });

  it("keeps the pricing mode first and preserves mobile hit areas in RTL", async () => {
    mocks.lang = "ar";
    mocks.policy.limit.reasonRequired = true;
    render(<Harness initialDraft={{ mode: "DISCOUNT", scope: "DOCUMENT", type: "AMOUNT", value: "7500",
      lineDiscounts: {}, reason: "QA-DENSE-DOC-AMT" }} />);
    await flush();
    const copy = ar.quotationDiscount;

    const modeGroup = screen.getByRole("radiogroup", { name: copy.mode });
    const scopeGroup = screen.getByRole("radiogroup", { name: copy.scope });
    const typeGroup = screen.getByRole("radiogroup", { name: copy.type });
    const manageButton = screen.getByRole("button", { name: copy.manageLimits });
    const valueInput = screen.getByRole("textbox", { name: copy.value });
    const reasonInput = screen.getByRole("textbox", { name: copy.reasonOptional });

    expect(modeGroup).toHaveAttribute("dir", "rtl");
    expect(modeGroup).toHaveClass("rounded-full");
    expect(modeGroup.compareDocumentPosition(scopeGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(scopeGroup.compareDocumentPosition(manageButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(manageButton.className).toContain("min-h-11");
    expect(manageButton.className).toContain("min-w-11");
    expect(manageButton.className).toContain("ds-hit-area");

    const manualBand = scopeGroup.parentElement;
    expect(manualBand?.className).toContain("basis-full");
    expect(manualBand?.className).toContain("flex-wrap");
    expect(manualBand?.className).toContain("sm:basis-auto");

    expect(scopeGroup.className).toContain("w-full");
    expect(scopeGroup.className).toContain("max-w-full");
    expect(typeGroup.className).toContain("max-w-full");
    expect(typeGroup.className).toContain("flex-auto");

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.className).toContain("min-h-9");
      expect(radio.className).toContain("sm:min-h-0");
      expect(radio.className).toContain("ds-hit-target");
    }
    expect(valueInput).toHaveAttribute("dir", "ltr");
    expect(valueInput.className).toContain("min-h-11");
    expect(valueInput.className).toContain("sm:min-h-0");
    expect(reasonInput.className).toContain("min-h-11");
    expect(reasonInput.className).toContain("sm:min-h-0");
  });
});

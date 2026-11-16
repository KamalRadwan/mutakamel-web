import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { isUUIDv7 } from "@/lib/uuid";
import { CHANNEL_SCOPE_HEADER } from "../trade-api";
import { canonicalizeDecimalInput } from "../documents/fixed-decimal";
import { partyDisplayName, record } from "../documents/trade-document-contract";
import { isItemEligibleForPurpose, type TradeItemOption } from "../documents/trade-lookup-contract";
import { emptyTradeLine, type TradeLineDraft } from "../documents/hooks/useTradeLineDraft";
import { parseItemImageSummary } from "../items/item-image-contract";
import type { Quotation, QuotationCustomerOption, QuotationDetail, QuotationLine, QuotationRevision } from "./quotation-contract";
import type { QuotationPricingIntent, QuotationPricingLineInput } from "./quotation-discount-contract";
import { defaultQuotationDiscount, type QuotationDiscountDraft } from "./quotation-discount-draft";
import { readQuotationSavedPricing } from "./quotation-discount-snapshots";

// Exact forbidden monetary keys from backend CreateQuotationRevisionDto (documents.dto.ts:157-170).
const FORBIDDEN_TERM_KEYS = new Set([
  "presentationTotals", "commercialTotals", "totals", "totalsSnapshot",
  "subtotal", "discountTotal", "chargeTotal", "taxTotal",
  "roundingTotal", "grandTotal", "amountPaid", "amountDue",
]);
const EDITABLE_TERM_KEYS = new Set(["paymentTermCode", "incotermCode", "deliveryDays", "warrantyMonths"]);
const MAX_TERMS_JSON_LENGTH = 16_384;

export interface QuotationLineDisplay {
  description?: string;
  itemName?: string;
  sku?: string;
  uomCode?: string;
  unavailable?: boolean;
}
export type QuotationLineDisplayMap = Record<string, QuotationLineDisplay>;

export interface HydratedQuotationTerms {
  paymentTermCode: string;
  incotermCode: string;
  deliveryDays: string;
  warrantyMonths: string;
  extraTerms: Record<string, unknown>;
}

export interface HydratedQuotationWorkspaceData {
  validUntil: string;
  terms: HydratedQuotationTerms;
  discount: QuotationDiscountDraft;
  corruptedDiscountSnapshot: boolean;
  lines: TradeLineDraft[];
  priceBooksByLineId: Record<string, string>;
  lineDisplayById: QuotationLineDisplayMap;
  rawLinesByClientId: Record<string, QuotationLine>;
}

export function quotationScopedHeaders(
  quotation: Pick<Quotation, "companyId" | "branchId" | "channelId">,
): Record<string, string> {
  return {
    [COMPANY_SCOPE_HEADER]: quotation.companyId,
    [BRANCH_SCOPE_HEADER]: quotation.branchId,
    ...(quotation.channelId ? { [CHANNEL_SCOPE_HEADER]: quotation.channelId } : {}),
  };
}

export function findCurrentQuotationRevision(quotation: QuotationDetail): QuotationRevision | null {
  if (!quotation.currentRevisionId) return null;
  return quotation.revisions.find((entry) => entry.id === quotation.currentRevisionId) ?? null;
}

export function hydrateQuotationTerms(termsSnapshot?: Record<string, unknown> | null): HydratedQuotationTerms {
  if (!termsSnapshot) {
    return { paymentTermCode: "NET_30", incotermCode: "EXW", deliveryDays: "14", warrantyMonths: "12", extraTerms: {} };
  }
  const extraTerms: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(termsSnapshot)) {
    if (!FORBIDDEN_TERM_KEYS.has(key) && !EDITABLE_TERM_KEYS.has(key)) extraTerms[key] = value;
  }
  const readText = (raw: unknown, fallback: string) => (typeof raw === "string" ? raw : fallback);
  const readInt = (raw: unknown, fallback: string) =>
    typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0 ? String(raw)
      : typeof raw === "string" ? raw : fallback;
  return {
    paymentTermCode: readText(termsSnapshot.paymentTermCode, "NET_30"),
    incotermCode: readText(termsSnapshot.incotermCode, "EXW"),
    deliveryDays: readInt(termsSnapshot.deliveryDays, "14"),
    warrantyMonths: readInt(termsSnapshot.warrantyMonths, "12"),
    extraTerms,
  };
}

export function buildSanitizedQuotationTerms(input: {
  paymentTermCode: string;
  incotermCode: string;
  deliveryDays: number;
  warrantyMonths: number;
  extraTerms?: Record<string, unknown>;
}): Record<string, unknown> {
  const safeExtras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input.extraTerms ?? {})) {
    if (!FORBIDDEN_TERM_KEYS.has(key) && !EDITABLE_TERM_KEYS.has(key)) safeExtras[key] = value;
  }
  const merged: Record<string, unknown> = {
    ...safeExtras,
    paymentTermCode: input.paymentTermCode.trim() || "NET_30",
    incotermCode: input.incotermCode.trim() || "EXW",
    deliveryDays: input.deliveryDays,
    warrantyMonths: input.warrantyMonths,
  };
  if (JSON.stringify(merged).length <= MAX_TERMS_JSON_LENGTH) return merged;
  return {
    paymentTermCode: merged.paymentTermCode,
    incotermCode: merged.incotermCode,
    deliveryDays: input.deliveryDays,
    warrantyMonths: input.warrantyMonths,
  };
}

export function hydrateQuotationDiscountFromDetail(
  revision: QuotationRevision | null,
  sortedLines: readonly QuotationLine[],
): QuotationDiscountDraft {
  if (!revision) return defaultQuotationDiscount();
  if (revision.pricingMode !== "DISCOUNT") return { ...defaultQuotationDiscount(), mode: revision.pricingMode };
  let saved: ReturnType<typeof readQuotationSavedPricing> = null;
  try { saved = readQuotationSavedPricing(revision.discountSnapshot); } catch { saved = null; }
  if (!saved || saved.pricing.mode !== "DISCOUNT") return defaultQuotationDiscount();
  if (saved.pricing.scope === "DOCUMENT" && saved.pricing.type && saved.pricing.value !== undefined) {
    return {
      mode: "DISCOUNT",
      scope: "DOCUMENT",
      type: saved.pricing.type,
      value: canonicalizeDecimalInput(saved.pricing.value) ?? saved.pricing.value,
      reason: saved.pricing.reason ?? "",
      lineDiscounts: {},
    };
  }
  const lineDiscounts: QuotationDiscountDraft["lineDiscounts"] = {};
  for (const line of sortedLines) {
    const rawDiscount = record(line.discountSnapshot.discount);
    if (!rawDiscount) continue;
    const type = rawDiscount.type;
    const value = rawDiscount.value;
    if ((type === "PERCENT" || type === "AMOUNT") && typeof value === "string") {
      const canonical = canonicalizeDecimalInput(value) ?? value;
      lineDiscounts[line.clientLineId] = { type, value: canonical };
    }
  }
  return {
    mode: "DISCOUNT",
    scope: "LINE",
    type: "PERCENT",
    value: "0",
    reason: saved.pricing.reason ?? "",
    lineDiscounts,
  };
}

function isDiscountSnapshotCorrupted(revision: QuotationRevision | null): boolean {
  if (!revision || revision.pricingMode !== "DISCOUNT") return false;
  try {
    const saved = readQuotationSavedPricing(revision.discountSnapshot);
    return !saved || saved.pricing.mode !== "DISCOUNT";
  } catch {
    return true;
  }
}

function extractLineMetadata(line: QuotationLine): {
  itemId: string; priceBookId?: string; sku?: string; uomCode?: string; companyProfileId?: string;
} {
  const snapshot = line.discountSnapshot;
  const extended = line as QuotationLine & {
    itemCompanyProfileId?: unknown;
    skuSnapshot?: unknown;
    uomCodeSnapshot?: unknown;
    taxSnapshot?: unknown;
  };
  const tax = record(extended.taxSnapshot);
  const itemId = isUUIDv7(snapshot.itemId) ? snapshot.itemId : "";
  const priceBookId = isUUIDv7(snapshot.priceBookId) ? snapshot.priceBookId : undefined;
  const sku = typeof extended.skuSnapshot === "string" && extended.skuSnapshot
    ? extended.skuSnapshot
    : typeof tax?.sku === "string" && tax.sku ? tax.sku : undefined;
  const uomCode = typeof extended.uomCodeSnapshot === "string" && extended.uomCodeSnapshot
    ? extended.uomCodeSnapshot
    : typeof tax?.uomCode === "string" && tax.uomCode ? tax.uomCode : undefined;
  const companyProfileId = isUUIDv7(extended.itemCompanyProfileId) ? extended.itemCompanyProfileId : undefined;
  return { itemId, priceBookId, sku, uomCode, companyProfileId };
}

export function hydrateQuotationWorkspace(quotation: QuotationDetail, fallbackValidUntil: string): HydratedQuotationWorkspaceData {
  const revision = findCurrentQuotationRevision(quotation);
  const sortedLines = [...quotation.currentLines].sort((a, b) => a.printLineNumber - b.printLineNumber);
  const terms = hydrateQuotationTerms(revision?.termsSnapshot);
  const discount = hydrateQuotationDiscountFromDetail(revision, sortedLines);
  const corruptedDiscountSnapshot = isDiscountSnapshotCorrupted(revision);
  if (sortedLines.length === 0) {
    return {
      validUntil: revision?.validUntil ?? fallbackValidUntil,
      terms, discount, corruptedDiscountSnapshot,
      lines: [emptyTradeLine()],
      priceBooksByLineId: {},
      lineDisplayById: {},
      rawLinesByClientId: {},
    };
  }
  const lines: TradeLineDraft[] = [];
  const priceBooksByLineId: Record<string, string> = {};
  const lineDisplayById: QuotationLineDisplayMap = {};
  const rawLinesByClientId: Record<string, QuotationLine> = {};
  for (const line of sortedLines) {
    const meta = extractLineMetadata(line);
    const quantity = canonicalizeDecimalInput(line.quantity) ?? line.quantity;
    rawLinesByClientId[line.clientLineId] = line;
    if (meta.priceBookId) priceBooksByLineId[line.clientLineId] = meta.priceBookId;
    lines.push({
      clientLineId: line.clientLineId,
      itemId: meta.itemId,
      uomId: line.uomId,
      quantity,
      unitPrice: line.unitPrice,
      priceBreakdown: null,
      isPricing: false,
      priceError: null,
    });
    lineDisplayById[line.clientLineId] = {
      description: line.descriptionSnapshot,
      itemName: line.descriptionSnapshot,
      ...(meta.sku ? { sku: meta.sku } : {}),
      ...(meta.uomCode ? { uomCode: meta.uomCode } : {}),
      ...(meta.itemId === "" ? { unavailable: true } : {}),
    };
  }
  return {
    validUntil: revision?.validUntil ?? fallbackValidUntil,
    terms, discount, corruptedDiscountSnapshot, lines, priceBooksByLineId, lineDisplayById, rawLinesByClientId,
  };
}

export function buildHydratedCustomerOption(
  quotation: QuotationDetail,
  partyType: "PERSON" | "ORGANIZATION",
): QuotationCustomerOption {
  return {
    partyId: quotation.partyId,
    partyType,
    displayName: partyDisplayName(quotation.partySnapshot) ?? quotation.partyId,
    crmCustomerProfileId: quotation.crmCustomerProfileId,
    commercialAccountStatus: quotation.customerEligibilitySource === "ACTIVE_COMMERCIAL_ACCOUNT" ? "ACTIVE" : "NONE",
    eligibilitySource: quotation.customerEligibilitySource,
    quotationSelectable: true,
    denialCode: null,
  };
}

export function attachLinePriceBooks(
  lines: readonly QuotationPricingLineInput[],
  draftLines: readonly TradeLineDraft[],
  priceBooksByLineId: Readonly<Record<string, string>>,
  initialItemsByLineId: Readonly<Record<string, string>>,
): QuotationPricingLineInput[] {
  const currentItemByLine = new Map(draftLines.map((line) => [line.clientLineId, line.itemId]));
  return lines.map((line) => {
    const bookId = priceBooksByLineId[line.clientLineId];
    const originalItem = initialItemsByLineId[line.clientLineId];
    if (!bookId || !isUUIDv7(bookId) || currentItemByLine.get(line.clientLineId) !== originalItem) return line;
    return { ...line, priceBookId: bookId };
  });
}

export function serializeCommercialState(input: {
  validUntil: string;
  lines: readonly {
    clientLineId: string;
    itemId: string;
    uomId: string;
    quantity: string;
    priceBookId?: string;
    discount?: { type: "PERCENT" | "AMOUNT"; value: string } | null;
  }[];
  pricing: QuotationPricingIntent | null;
  terms: Record<string, unknown> | null;
}): string {
  return JSON.stringify({
    validUntil: input.validUntil.trim(),
    lines: input.lines.map((line) => {
      const discountVal = line.discount ? (canonicalizeDecimalInput(line.discount.value) ?? line.discount.value.trim()) : null;
      return {
        clientLineId: line.clientLineId,
        itemId: line.itemId,
        uomId: line.uomId,
        quantity: canonicalizeDecimalInput(line.quantity) ?? line.quantity.trim(),
        ...(line.priceBookId ? { priceBookId: line.priceBookId } : {}),
        ...(line.discount && discountVal !== null ? { discount: { type: line.discount.type, value: discountVal } } : {}),
      };
    }),
    pricing: input.pricing,
    terms: input.terms ? Object.fromEntries(Object.entries(input.terms).sort(([a], [b]) => a.localeCompare(b))) : null,
  });
}

/** Dedicated parser for GET /api/tenant/trade/v1/items/:id (root baseUomId + companyProfile + branchProfile shape). */
export function parseTradeItemDetailForHydration(payload: unknown): {
  item: TradeItemOption | null;
  companyProfileId: string | null;
  canonicalCode: string | null;
} {
  const row = record(payload);
  if (!row || !isUUIDv7(row.id) || typeof row.canonicalCode !== "string") {
    return { item: null, companyProfileId: null, canonicalCode: null };
  }
  const companyProfile = record(row.companyProfile);
  const branchProfile = record(row.branchProfile);
  const companyProfileId = companyProfile && isUUIDv7(companyProfile.id) ? companyProfile.id : null;
  const baseUomId = isUUIDv7(row.baseUomId)
    ? row.baseUomId
    : companyProfile && isUUIDv7(companyProfile.baseUomId)
      ? companyProfile.baseUomId
      : null;
  if (
    !companyProfile || !companyProfileId || !baseUomId ||
    typeof companyProfile.version !== "number" ||
    typeof companyProfile.status !== "string" ||
    typeof companyProfile.canSell !== "boolean" ||
    typeof companyProfile.canPurchase !== "boolean" ||
    typeof companyProfile.canPos !== "boolean"
  ) {
    return { item: null, companyProfileId, canonicalCode: row.canonicalCode };
  }
  const defaultSalesUomId = isUUIDv7(companyProfile.defaultSalesUomId) ? companyProfile.defaultSalesUomId : baseUomId;
  const defaultPurchaseUomId = isUUIDv7(companyProfile.defaultPurchaseUomId) ? companyProfile.defaultPurchaseUomId : baseUomId;
  let parsedImage = null;
  try {
    parsedImage = parseItemImageSummary(row.image);
  } catch {
    parsedImage = null;
  }
  const candidate: TradeItemOption = {
    id: row.id,
    canonicalCode: row.canonicalCode,
    barcode: typeof row.barcode === "string" ? row.barcode : null,
    localizedNames: record(row.localizedNames) ?? {},
    quotationDescription: typeof row.quotationDescription === "string" ? row.quotationDescription : null,
    salesOrderDescription: typeof row.salesOrderDescription === "string" ? row.salesOrderDescription : null,
    receiptDescription: typeof row.receiptDescription === "string" ? row.receiptDescription : null,
    deliveryOrderDescription: typeof row.deliveryOrderDescription === "string" ? row.deliveryOrderDescription : null,
    status: typeof row.status === "string" ? row.status : "INACTIVE",
    ...(row.itemKind === "PRODUCT" || row.itemKind === "SERVICE" || row.itemKind === "COMBO" ? { itemKind: row.itemKind } : {}),
    image: parsedImage,
    eligibility: {
      companyProfileId,
      companyProfileVersion: companyProfile.version,
      companyProfileStatus: companyProfile.status,
      canSell: companyProfile.canSell,
      canPurchase: companyProfile.canPurchase,
      canPos: companyProfile.canPos,
      baseUomId,
      defaultSalesUomId,
      defaultPurchaseUomId,
      branchProfileId: branchProfile && isUUIDv7(branchProfile.id) ? branchProfile.id : null,
      branchProfileVersion: branchProfile && typeof branchProfile.version === "number" ? branchProfile.version : null,
      isAssorted: branchProfile && typeof branchProfile.isAssorted === "boolean" ? branchProfile.isAssorted : null,
    },
  };
  return {
    item: isItemEligibleForPurpose(candidate, "SALES") ? candidate : null,
    companyProfileId,
    canonicalCode: row.canonicalCode,
  };
}

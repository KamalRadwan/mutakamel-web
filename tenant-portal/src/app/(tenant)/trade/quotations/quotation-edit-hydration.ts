import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { isUUIDv7 } from "@/lib/uuid";
import { CHANNEL_SCOPE_HEADER } from "../trade-api";
import { canonicalizeDecimalInput } from "../documents/fixed-decimal";
import { isItemEligibleForPurpose, itemDisplayName, type TradeItemOption, type TradeUomOption } from "../documents/trade-lookup-contract";
import { canonicalTradeQuantity } from "../documents/trade-line-validation";
import { emptyTradeLine, type TradeLineDraft } from "../documents/hooks/useTradeLineDraft";
import { readQuotationLineSnapshot, type Quotation, type QuotationDetail, type QuotationItemDetailLookupResult, type QuotationLine, type QuotationRevision } from "./quotation-contract";
import { parseQuotationPricingIntent, type QuotationLineDiscountIntent, type QuotationPricingLineInput, type QuotationPricingRequest } from "./quotation-discount-contract";
import { buildQuotationPricingRequest, defaultQuotationDiscount, type QuotationDiscountDraft } from "./quotation-discount-draft";
import { defaultQuotationFields } from "./quotation-composer-draft";

// Monetary override keys rejected by `CreateQuotationRevisionDto.terms` (documents.dto.ts:157-170).
export const QUOTATION_FORBIDDEN_TERM_KEYS = [
  "presentationTotals", "commercialTotals", "totals", "totalsSnapshot", "subtotal", "discountTotal",
  "chargeTotal", "taxTotal", "roundingTotal", "grandTotal", "amountPaid", "amountDue",
] as const;
export const QUOTATION_TERMS_MAX_JSON_LENGTH = 16_384;
const FORBIDDEN_TERM_KEY_SET = new Set<string>(QUOTATION_FORBIDDEN_TERM_KEYS);
const EDITABLE_TERM_KEYS = new Set(["paymentTermCode", "incotermCode", "deliveryDays", "warrantyMonths"]);

export type QuotationLineHydrationStatus = "READY" | "PENDING_LOOKUP" | "UNRESOLVED_LEGACY" | "INELIGIBLE_ITEM" | "CORRUPTED_SNAPSHOT";
export type QuotationHydrationLookupOutcome = QuotationItemDetailLookupResult | "NOT_FOUND" | "DEGRADED";
export interface QuotationHydratedLineDisplay {
  clientLineId: string; description: string; itemName: string | null; sku: string | null; uomCode: string | null;
  itemImageId: string | null; itemId: string | null; itemCompanyProfileId: string | null; priceBookId: string | null;
  frozenUnitPrice: string; frozenLineTotal: string; frozenDiscountTotal: string; status: QuotationLineHydrationStatus;
  unavailable: boolean; requiresReplacement: boolean; lookupPending: boolean; lookupDegraded: boolean;
}
export interface QuotationHydratedTerms {
  hasRevision: boolean; validUntil: string; paymentTermCode: string; incotermCode: string;
  deliveryDays: string; warrantyMonths: string; preservedTerms: Record<string, unknown>; rawTermsSnapshot: Record<string, unknown>;
}
export interface QuotationTermsBuildResult { terms: Record<string, unknown> | null; deliveryDaysError: boolean; warrantyMonthsError: boolean; tooLargeError: boolean }
export interface HydratedQuotationLineInput extends QuotationPricingLineInput { priceBookId?: string }
export interface HydratedQuotationPricingRequest extends Omit<QuotationPricingRequest, "lines"> { lines: HydratedQuotationLineInput[] }
export interface QuotationEditHydrationSnapshot {
  hydrationKey: string; scopeHeaders: Record<string, string>; currentRevision: QuotationRevision | null; hasRevision: boolean;
  draftReference: string; contactPartyId: string; currencyCode: string; partyId: string; crmCustomerProfileId: string | null;
  terms: QuotationHydratedTerms; discount: QuotationDiscountDraft; lines: TradeLineDraft[];
  persistedLineIds: string[]; priceBookIdByLineId: Record<string, string>; hydratedItemIdByLineId: Record<string, string>;
  lineDisplayById: Record<string, QuotationHydratedLineDisplay>; blockingLineIds: string[];
  pendingItemIds: string[]; pendingLegacyLines: Array<{ clientLineId: string; itemCompanyProfileId: string; sku: string }>;
  hasBlockingLines: boolean; canPreviewPricing: boolean; canSubmitRevision: boolean;
}
export interface QuotationReconciledHydrationState {
  lineDisplayById: Record<string, QuotationHydratedLineDisplay>; priceBookIdByLineId: Record<string, string>;
  blockingLineIds: string[]; hasBlockingLines: boolean; canPreviewPricing: boolean; canSubmitRevision: boolean;
}

/** Pins exact saved document scope (`documents.service.ts:535, 589, 3008-3019`), omitting channel when null. */
export function quotationEditScopeHeaders(quotation: Pick<Quotation, "companyId" | "branchId" | "channelId">): Record<string, string> {
  return { [COMPANY_SCOPE_HEADER]: quotation.companyId, [BRANCH_SCOPE_HEADER]: quotation.branchId, ...(quotation.channelId ? { [CHANNEL_SCOPE_HEADER]: quotation.channelId } : {}) };
}
export function selectCurrentQuotationRevision(quotation: QuotationDetail): QuotationRevision | null {
  return quotation.currentRevisionId ? quotation.revisions.find((entry) => entry.id === quotation.currentRevisionId) ?? null : null;
}
export function sanitizeQuotationTermsSnapshot(termsSnapshot: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(termsSnapshot).filter(([key]) => !FORBIDDEN_TERM_KEY_SET.has(key)));
}

function readStoredTermInteger(value: unknown): string {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (typeof value === "string" && /^[0-9]+$/u.test(value.trim()) && Number.isSafeInteger(Number(value.trim()))) return value.trim();
  return "";
}
function parseTermInputInteger(input: string, blankFallback: number | null): { valid: boolean; value: number | null } {
  const trimmed = input.trim();
  if (trimmed === "") return { valid: true, value: blankFallback };
  const parsed = /^[0-9]+$/u.test(trimmed) ? Number(trimmed) : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? { valid: true, value: parsed } : { valid: false, value: null };
}

export function hydrateQuotationTerms(revision: QuotationRevision | null): QuotationHydratedTerms {
  if (!revision) {
    const d = defaultQuotationFields();
    return { hasRevision: false, validUntil: d.validUntil, paymentTermCode: d.paymentTermCode, incotermCode: d.incotermCode, deliveryDays: d.deliveryDays, warrantyMonths: d.warrantyMonths, preservedTerms: {}, rawTermsSnapshot: {} };
  }
  const sanitized = sanitizeQuotationTermsSnapshot(revision.termsSnapshot);
  return {
    hasRevision: true, validUntil: revision.validUntil,
    paymentTermCode: typeof sanitized.paymentTermCode === "string" ? sanitized.paymentTermCode : "",
    incotermCode: typeof sanitized.incotermCode === "string" ? sanitized.incotermCode : "",
    deliveryDays: readStoredTermInteger(sanitized.deliveryDays), warrantyMonths: readStoredTermInteger(sanitized.warrantyMonths),
    preservedTerms: Object.fromEntries(Object.entries(sanitized).filter(([key]) => !EDITABLE_TERM_KEYS.has(key))),
    rawTermsSnapshot: sanitized,
  };
}

export function buildHydratedQuotationTerms(
  hydrated: QuotationHydratedTerms,
  input: { paymentTermCode: string; incotermCode: string; deliveryDays: string; warrantyMonths: string },
): QuotationTermsBuildResult {
  const delivery = parseTermInputInteger(input.deliveryDays, hydrated.hasRevision ? null : 14);
  const warranty = parseTermInputInteger(input.warrantyMonths, hydrated.hasRevision ? null : 12);
  if (!delivery.valid || !warranty.valid) return { terms: null, deliveryDaysError: !delivery.valid, warrantyMonthsError: !warranty.valid, tooLargeError: false };
  const nextTerms: Record<string, unknown> = { ...hydrated.rawTermsSnapshot };
  for (const [key, raw, fallback] of [["paymentTermCode", input.paymentTermCode, "NET_30"], ["incotermCode", input.incotermCode, "EXW"]] as const) {
    const trimmed = raw.trim();
    if (trimmed) nextTerms[key] = trimmed;
    else if (!hydrated.hasRevision) nextTerms[key] = fallback;
    else if (typeof hydrated.rawTermsSnapshot[key] === "string") delete nextTerms[key];
  }
  if (delivery.value !== null) nextTerms.deliveryDays = delivery.value;
  else if (readStoredTermInteger(hydrated.rawTermsSnapshot.deliveryDays) !== "") delete nextTerms.deliveryDays;
  if (warranty.value !== null) nextTerms.warrantyMonths = warranty.value;
  else if (readStoredTermInteger(hydrated.rawTermsSnapshot.warrantyMonths) !== "") delete nextTerms.warrantyMonths;
  return JSON.stringify(nextTerms).length > QUOTATION_TERMS_MAX_JSON_LENGTH
    ? { terms: null, deliveryDaysError: false, warrantyMonthsError: false, tooLargeError: true }
    : { terms: nextTerms, deliveryDaysError: false, warrantyMonthsError: false, tooLargeError: false };
}

export function hydrateQuotationDiscountDraft(revision: QuotationRevision | null, lines: readonly QuotationLine[]): QuotationDiscountDraft {
  if (!revision) return defaultQuotationDiscount();
  if (revision.pricingMode !== "DISCOUNT") return { ...defaultQuotationDiscount(), mode: revision.pricingMode };
  if (revision.discountSnapshot.pricing === undefined) return defaultQuotationDiscount();
  let pricing: ReturnType<typeof parseQuotationPricingIntent>;
  try { pricing = parseQuotationPricingIntent(revision.discountSnapshot.pricing); } catch { return defaultQuotationDiscount(); }
  if (pricing.mode !== "DISCOUNT") return defaultQuotationDiscount();
  const reason = pricing.reason ?? "";
  if (pricing.scope === "DOCUMENT") {
    return { mode: "DISCOUNT", scope: "DOCUMENT", type: pricing.type ?? "PERCENT", value: canonicalizeDecimalInput(pricing.value ?? "0") ?? "0", reason, lineDiscounts: {} };
  }
  const lineDiscounts: Record<string, QuotationLineDiscountIntent> = {};
  for (const line of lines) {
    const { discount, corrupted } = readQuotationLineSnapshot(line);
    if (!corrupted && discount) lineDiscounts[line.clientLineId] = discount;
  }
  return { mode: "DISCOUNT", scope: "LINE", type: "PERCENT", value: "0", reason, lineDiscounts };
}

function localizedLabel(names: Record<string, unknown>, fallback: string, language: string): string {
  for (const key of [language, "en", "ar", ...Object.keys(names).sort()]) {
    const val = names[key];
    if (typeof val === "string" && val.trim().length > 0) return val.trim();
  }
  return fallback;
}

export function hydrateQuotationEditSnapshot(
  quotation: QuotationDetail,
  options: {
    itemsById?: Record<string, TradeItemOption>; uomsByItem?: Record<string, TradeUomOption[]>;
    resolvedLookups?: Record<string, QuotationHydrationLookupOutcome>; legacyLookups?: Record<string, QuotationHydrationLookupOutcome>;
    canLookup?: boolean; language?: string;
  } = {},
): QuotationEditHydrationSnapshot {
  const { itemsById = {}, uomsByItem = {}, resolvedLookups = {}, legacyLookups = {}, canLookup = true, language = "en" } = options;
  const currentRevision = selectCurrentQuotationRevision(quotation);
  const base = {
    hydrationKey: `${quotation.id}:${quotation.version}:${quotation.currentRevisionId ?? "none"}`,
    scopeHeaders: quotationEditScopeHeaders(quotation), currentRevision, hasRevision: currentRevision !== null,
    draftReference: quotation.draftReference ?? "", contactPartyId: quotation.contactPartyId ?? "",
    currencyCode: quotation.currencyCode, partyId: quotation.partyId, crmCustomerProfileId: quotation.crmCustomerProfileId,
    terms: hydrateQuotationTerms(currentRevision), discount: hydrateQuotationDiscountDraft(currentRevision, quotation.currentLines),
  };
  if (quotation.currentLines.length === 0) {
    return {
      ...base, lines: [emptyTradeLine()], persistedLineIds: [], priceBookIdByLineId: {}, hydratedItemIdByLineId: {},
      lineDisplayById: {}, blockingLineIds: [], pendingItemIds: [], pendingLegacyLines: [],
      hasBlockingLines: false, canPreviewPricing: true, canSubmitRevision: true,
    };
  }
  const lines: TradeLineDraft[] = [];
  const priceBookIdByLineId: Record<string, string> = {};
  const hydratedItemIdByLineId: Record<string, string> = {};
  const lineDisplayById: Record<string, QuotationHydratedLineDisplay> = {};
  const blockingLineIds: string[] = [];
  const pendingItemSet = new Set<string>();
  const pendingLegacyLines: Array<{ clientLineId: string; itemCompanyProfileId: string; sku: string }> = [];

  for (const line of quotation.currentLines) {
    const ev = readQuotationLineSnapshot(line);
    const qty = canonicalTradeQuantity(line.quantity);
    let status: QuotationLineHydrationStatus = "READY", draftItemId = "", lookupDegraded = false;
    let itemName: string | null = null, sku = ev.sku, imageId = ev.itemImageId;
    const applyItem = (item: TradeItemOption) => {
      itemName = itemDisplayName(item, language); sku = item.canonicalCode; imageId = imageId ?? item.image?.id ?? null;
      if (isItemEligibleForPurpose(item, "SALES")) draftItemId = item.id; else status = "INELIGIBLE_ITEM";
    };
    const applyDetail = (detail: QuotationItemDetailLookupResult) => {
      sku = detail.canonicalCode; imageId = imageId ?? detail.primaryImageId;
      if (detail.isSellEligible && detail.item) { draftItemId = detail.item.id; itemName = itemDisplayName(detail.item, language); }
      else { status = "INELIGIBLE_ITEM"; itemName = localizedLabel(detail.localizedNames, detail.canonicalCode, language); }
    };
    if (ev.corrupted || qty === null) status = "CORRUPTED_SNAPSHOT";
    else if (ev.itemId !== null) {
      const cached = itemsById[ev.itemId], detail = resolvedLookups[ev.itemId];
      if (cached) {
        if (ev.itemCompanyProfileId !== null && cached.eligibility.companyProfileId !== ev.itemCompanyProfileId) status = "CORRUPTED_SNAPSHOT";
        else applyItem(cached);
      } else if (detail === undefined) {
        draftItemId = ev.itemId;
        if (canLookup) { status = "PENDING_LOOKUP"; pendingItemSet.add(ev.itemId); } else lookupDegraded = true;
      } else if (detail === "DEGRADED") { draftItemId = ev.itemId; lookupDegraded = true; }
      else if (detail === "NOT_FOUND") status = "INELIGIBLE_ITEM";
      else if (ev.itemCompanyProfileId !== null && detail.companyProfileId !== ev.itemCompanyProfileId) status = "CORRUPTED_SNAPSHOT";
      else applyDetail(detail);
    } else if (ev.itemCompanyProfileId === null) status = "UNRESOLVED_LEGACY";
    else {
      const matches = Object.values(itemsById).filter((c) => c.eligibility.companyProfileId === ev.itemCompanyProfileId && (ev.sku === null || c.canonicalCode === ev.sku));
      if (matches.length === 1) applyItem(matches[0]!);
      else if (ev.sku !== null) {
        const legacy = legacyLookups[line.clientLineId];
        if (legacy === undefined) {
          if (canLookup) { status = "PENDING_LOOKUP"; pendingLegacyLines.push({ clientLineId: line.clientLineId, itemCompanyProfileId: ev.itemCompanyProfileId, sku: ev.sku }); }
          else { status = "UNRESOLVED_LEGACY"; lookupDegraded = true; }
        } else if (legacy === "NOT_FOUND") status = "UNRESOLVED_LEGACY";
        else if (legacy === "DEGRADED") { status = "UNRESOLVED_LEGACY"; lookupDegraded = true; }
        else if (legacy.companyProfileId !== ev.itemCompanyProfileId || legacy.canonicalCode !== ev.sku) status = "CORRUPTED_SNAPSHOT";
        else applyDetail(legacy);
      } else status = "UNRESOLVED_LEGACY";
    }
    const uomCode = (draftItemId ? uomsByItem[draftItemId]?.find((u) => u.id === line.uomId)?.code : undefined) ?? ev.uomCode;
    const unavailable = status === "UNRESOLVED_LEGACY" || status === "INELIGIBLE_ITEM" || status === "CORRUPTED_SNAPSHOT";
    if (status !== "READY") blockingLineIds.push(line.clientLineId);
    if (draftItemId) hydratedItemIdByLineId[line.clientLineId] = draftItemId;
    if (draftItemId && ev.priceBookId) priceBookIdByLineId[line.clientLineId] = ev.priceBookId;
    const unitPrice = canonicalizeDecimalInput(line.unitPrice) ?? line.unitPrice;
    lines.push({
      clientLineId: line.clientLineId, itemId: draftItemId, uomId: line.uomId,
      quantity: qty ?? canonicalizeDecimalInput(line.quantity) ?? line.quantity, unitPrice, isPricing: false, priceError: null,
    });
    lineDisplayById[line.clientLineId] = {
      clientLineId: line.clientLineId, description: line.descriptionSnapshot, itemName, sku, uomCode,
      itemImageId: imageId, itemId: draftItemId || ev.itemId, itemCompanyProfileId: ev.itemCompanyProfileId,
      priceBookId: draftItemId ? ev.priceBookId : null, frozenUnitPrice: unitPrice,
      frozenLineTotal: canonicalizeDecimalInput(line.lineTotal) ?? line.lineTotal,
      frozenDiscountTotal: canonicalizeDecimalInput(line.discountTotal) ?? line.discountTotal,
      status, unavailable, requiresReplacement: unavailable, lookupPending: status === "PENDING_LOOKUP", lookupDegraded,
    };
  }
  const hasBlockingLines = blockingLineIds.length > 0;
  return {
    ...base, lines, persistedLineIds: quotation.currentLines.map((l) => l.clientLineId),
    priceBookIdByLineId, hydratedItemIdByLineId, lineDisplayById, blockingLineIds,
    pendingItemIds: [...pendingItemSet], pendingLegacyLines,
    hasBlockingLines, canPreviewPricing: !hasBlockingLines, canSubmitRevision: !hasBlockingLines,
  };
}

export function reconcileHydratedLineDrafts(
  snapshot: QuotationEditHydrationSnapshot, activeLines: readonly TradeLineDraft[],
  options: { itemsById?: Record<string, TradeItemOption>; uomsByItem?: Record<string, TradeUomOption[]>; language?: string } = {},
): QuotationReconciledHydrationState {
  const { itemsById = {}, uomsByItem = {}, language = "en" } = options;
  const persistedSet = new Set(snapshot.persistedLineIds);
  const lineDisplayById: Record<string, QuotationHydratedLineDisplay> = {};
  const priceBookIdByLineId: Record<string, string> = {};
  const blockingLineIds: string[] = [];

  for (const draft of activeLines) {
    const initial = snapshot.lineDisplayById[draft.clientLineId];
    if (!initial) continue;
    const hydratedItemId = snapshot.hydratedItemIdByLineId[draft.clientLineId];
    const isReplaced = Boolean(draft.itemId && draft.itemId !== hydratedItemId && draft.itemId !== initial.itemId);
    if (isReplaced) {
      const replacement = itemsById[draft.itemId];
      const eligible = replacement ? isItemEligibleForPurpose(replacement, "SALES") : isUUIDv7(draft.itemId);
      if (!eligible) blockingLineIds.push(draft.clientLineId);
      lineDisplayById[draft.clientLineId] = {
        ...initial, itemId: draft.itemId, itemName: replacement ? itemDisplayName(replacement, language) : initial.itemName,
        sku: replacement ? replacement.canonicalCode : initial.sku,
        uomCode: uomsByItem[draft.itemId]?.find((u) => u.id === draft.uomId)?.code ?? null,
        itemImageId: replacement ? (replacement.image?.id ?? null) : null, priceBookId: null,
        status: eligible ? "READY" : "INELIGIBLE_ITEM", unavailable: !eligible, requiresReplacement: !eligible, lookupPending: false,
      };
      continue;
    }
    if (draft.itemId === "" && persistedSet.has(draft.clientLineId)) {
      blockingLineIds.push(draft.clientLineId);
      lineDisplayById[draft.clientLineId] = initial.unavailable || initial.lookupPending ? initial
        : { ...initial, itemId: null, priceBookId: null, status: "INELIGIBLE_ITEM", unavailable: true, requiresReplacement: true };
      continue;
    }
    if (initial.status !== "READY") blockingLineIds.push(draft.clientLineId);
    const sameItem = draft.itemId === hydratedItemId, preservedBook = snapshot.priceBookIdByLineId[draft.clientLineId];
    if (preservedBook && sameItem) priceBookIdByLineId[draft.clientLineId] = preservedBook;
    const uomCode = (draft.itemId ? uomsByItem[draft.itemId]?.find((u) => u.id === draft.uomId)?.code : undefined) ?? initial.uomCode;
    lineDisplayById[draft.clientLineId] = { ...initial, uomCode, priceBookId: sameItem ? initial.priceBookId : null };
  }
  const hasBlockingLines = blockingLineIds.length > 0;
  return { lineDisplayById, priceBookIdByLineId, blockingLineIds, hasBlockingLines, canPreviewPricing: !hasBlockingLines, canSubmitRevision: !hasBlockingLines };
}

export function buildHydratedQuotationPricingRequest(input: {
  draft: QuotationDiscountDraft; lines: readonly TradeLineDraft[]; partyId: string | null; currencyCode: string;
  crmCustomerProfileId?: string | null; persistedLineIds?: Iterable<string>; blockingLineIds?: Iterable<string>;
  priceBookIdByLineId?: Record<string, string>; hydratedItemIdByLineId?: Record<string, string>;
}): HydratedQuotationPricingRequest | null {
  const blocking = new Set(input.blockingLineIds ?? []), persisted = new Set(input.persistedLineIds ?? []);
  if (input.lines.some((line) => blocking.has(line.clientLineId) || (persisted.has(line.clientLineId) && line.itemId === ""))) return null;
  const base = buildQuotationPricingRequest(input.draft, input.lines, input.partyId, input.currencyCode, input.crmCustomerProfileId);
  if (!base) return null;
  return {
    ...base,
    lines: base.lines.map((l) => {
      const bookId = input.priceBookIdByLineId?.[l.clientLineId], orig = input.hydratedItemIdByLineId?.[l.clientLineId];
      return bookId && isUUIDv7(bookId) && (!orig || orig === l.itemId) ? { ...l, priceBookId: bookId } : l;
    }),
  };
}

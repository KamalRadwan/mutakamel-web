import type { TradePath } from "@/lib/api/envelope";
import { isUUIDv7 } from "@/lib/uuid";
import { canonicalizeDecimalInput, compareFixedDecimal } from "../documents/fixed-decimal";
import { parseItemImageSummary } from "../items/item-image-contract";
import {
  isItemEligibleForPurpose,
  type TradeItemOption,
} from "../documents/trade-lookup-contract";
import { parseQuotationLineDiscount, parseQuotationRevisionDiscount } from "./quotation-discount-snapshots";
import type { QuotationLineDiscountIntent, QuotationPricingMode } from "./quotation-discount-contract";
import {
  TRADE_CURSOR_MAX_LENGTH,
  TRADE_V1,
  isBoundedString,
  isCurrencyCode,
  isTradeDate,
  isTradeDecimal,
  isTradeStatus,
  isTradeTimestamp,
  isVersion,
  jsonObject,
  nullableString,
  optionalUuid,
  parseTradeDocumentHeader,
  parseTradeListPage,
  record,
  tradeInvalidResponse,
  type TradeDocumentHeader,
} from "../documents/trade-document-contract";

// Quotations — 14 routes, feature gate `trade.sales`, every route targeting
// `BRANCH`. Verified against
// trade-app/src/modules/documents/{documents.controller,documents.service}.ts
// and dto/documents.dto.ts.
//
// **S6 cannot be satisfied on this screen.** Trade publishes no capabilities
// endpoint (Q30), so action admission is the permission string plus
// `is_tenant_owner` and nothing more. A 403 is an authoritative refusal, not a
// bug — see `TradeGate`.

export const QUOTATIONS_PATH = `${TRADE_V1}/quotations`;

export const QUOTATION_PERMISSIONS = {
  read: "trade.quotations.read",
  create: "trade.quotations.create",
  update: "trade.quotations.update",
  send: "trade.quotations.send",
  accept: "trade.quotations.accept",
  reject: "trade.quotations.reject",
  cancel: "trade.quotations.cancel",
  convert: "trade.quotations.convert",
} as const;

/**
 * Quotation lifecycle values exposed by the list, including the EXPIRED filter.
 * Note: Sales Order conversion keeps `lifecycleStatus = "ACCEPTED"` and links
 * lineage on the downstream Sales Order (`sourceQuotationId`) — there is no
 * `"CONVERTED"` status column in `trade-app`.
 */
export const QUOTATION_LIFECYCLE_STATUSES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type QuotationLifecycleStatus = (typeof QUOTATION_LIFECYCLE_STATUSES)[number];

/** `DocumentReasonDto.evidenceRef` — `@MaxLength(240)`. */
export const TRADE_EVIDENCE_REF_MAX_LENGTH = 240;

/** `QuotationCustomerOptionsQueryDto.limit` — 1..100, default 25. */
const QUOTATION_CUSTOMER_PAGE_SIZE = 50;

/**
 * The revision's own status, written alongside the quotation's.
 *
 * `DRAFT` is proven, not assumed: `createQuotationRevision` assigns
 * `status: "DRAFT"` and `quotationAction`'s `send` branch refuses anything
 * else. trade-documents.md lists this literal under "Not verified"; it is
 * verified here.
 */
export interface QuotationRevision {
  id: string;
  revisionNumber: number;
  status: string;
  validUntil: string;
  grandTotal: string;
  subtotal: string;
  discountTotal: string;
  pricingMode: QuotationPricingMode;
  discountSnapshot: Record<string, unknown>;
  termsSnapshot: Record<string, unknown>;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  priceLockExpiresAt: string | null;
}

export interface QuotationLine {
  id: string;
  clientLineId: string;
  printLineNumber: number;
  itemCompanyProfileId?: string;
  itemImageId?: string | null;
  descriptionSnapshot: string;
  deliveryDescriptionSnapshot?: string | null;
  quantity: string;
  uomId: string;
  unitPrice: string;
  lineTotal: string;
  discountTotal: string;
  discountSnapshot: Record<string, unknown>;
  priceDecisionId?: string | null;
  taxSnapshot?: Record<string, unknown>;
}

export interface QuotationLineSnapshotEvidence {
  itemId: string | null;
  priceBookId: string | null;
  discount: QuotationLineDiscountIntent | null;
  itemCompanyProfileId: string | null;
  itemImageId: string | null;
  sku: string | null;
  uomCode: string | null;
  corrupted: boolean;
}

export interface Quotation extends TradeDocumentHeader {
  channelId?: string | null;
  currentRevisionId: string | null;
  acceptedRevisionId: string | null;
  crmCustomerProfileId: string | null;
  customerEligibilitySource: string;
}

export interface QuotationDetail extends Quotation {
  revisions: QuotationRevision[];
  currentLines: QuotationLine[];
}

/** One row of `GET /quotations/customer-options`. */
export interface QuotationCustomerOption {
  partyId: string;
  partyType: "PERSON" | "ORGANIZATION";
  displayName: string;
  crmCustomerProfileId: string | null;
  commercialAccountStatus: string;
  eligibilitySource: string;
  quotationSelectable: boolean;
  denialCode: string | null;
}

export interface QuotationCustomerPage {
  items: QuotationCustomerOption[];
  /**
   * **Omitted entirely on the last page — not `null`.** The cursor is
   * base64url JSON and unsigned, but it is an opaque token here: passed back
   * verbatim, never parsed. An unparseable cursor is *silently ignored* by the
   * service and the first page comes back, so a paging bug looks like a loop
   * rather than a failure.
   */
  nextCursor: string | null;
}

export interface QuotationExtensionValueInput {
  fieldKey: string;
  value: unknown;
}

export interface CreateQuotationRequest {
  partyId: string;
  currencyCode: string;
  crmCustomerProfileId?: string;
  contactPartyId?: string | null;
  draftReference?: string;
  sourceCrmOpportunityId?: string;
  sourceCrmOpportunityVersion?: number;
  extensionProfileVersionId?: string;
  extensionValues?: QuotationExtensionValueInput[];
}

export interface UpdateQuotationHeaderRequest {
  draftReference?: string | null;
  contactPartyId?: string | null;
  extensionProfileVersionId?: string;
  extensionValues?: QuotationExtensionValueInput[];
}

export interface QuotationReasonPayload {
  reasonCode: string;
  evidenceRef?: string;
}

// `UpdateQuotationDto` accepts a nullable `contactPartyId` and a nullable
// `draftReference` and nothing else — party, currency and lines cannot be
// patched. `CreateQuotationRevisionDto` takes `validUntil`, the line set and an
// optional `terms`. Both bodies are two or three keys built at their call
// sites; a named type for each would be a second place to keep in step with
// the DTO.

/**
 * `GET /quotations/customer-options` — the only cursor-paged route in Trade.
 *
 * Gated on **`trade.quotations.create`**, not `.read`: a user who may read
 * quotations and not create them gets a 403 from the customer picker, so it is
 * never fetched on the detail screen.
 */
export function quotationCustomerOptionsPath(search: string, cursor: string | null): TradePath {
  const query = new URLSearchParams({ limit: String(QUOTATION_CUSTOMER_PAGE_SIZE) });
  if (search.trim()) query.set("search", search.trim().slice(0, 120));
  if (cursor && cursor.length <= TRADE_CURSOR_MAX_LENGTH) query.set("cursor", cursor);
  return `${QUOTATIONS_PATH}/customer-options?${query.toString()}` as TradePath;
}

export function parseQuotation(payload: unknown): Quotation {
  const header = parseTradeDocumentHeader(payload);
  const row = record(payload);
  if (!row || !isTradeStatus(row.customerEligibilitySource)) tradeInvalidResponse();
  return {
    ...header,
    ...(row.channelId !== undefined ? { channelId: optionalUuid(row.channelId) } : {}),
    currentRevisionId: optionalUuid(row.currentRevisionId),
    acceptedRevisionId: optionalUuid(row.acceptedRevisionId),
    crmCustomerProfileId: optionalUuid(row.crmCustomerProfileId),
    customerEligibilitySource: row.customerEligibilitySource,
  };
}

export function parseQuotationDetail(payload: unknown): QuotationDetail {
  const quotation = parseQuotation(payload);
  const row = record(payload);
  if (!row || !Array.isArray(row.revisions) || !Array.isArray(row.currentLines) || row.currentLines.length > 1_000) {
    tradeInvalidResponse();
  }
  // `DocumentsService.getQuotation` reads `currentLines` via `findBy` with no SQL ORDER BY;
  // pricing fingerprints hash lines in array order, so print rank is authoritative.
  return {
    ...quotation,
    revisions: row.revisions.map(parseRevision),
    currentLines: row.currentLines
      .map(parseLine)
      .sort((left, right) => left.printLineNumber - right.printLineNumber),
  };
}

/** A successful revision command is confirmed evidence even if the next detail read fails. */
export function parseQuotationRevisionResult(payload: unknown): {
  revision: QuotationRevision;
  lines: QuotationLine[];
} {
  const row = record(payload);
  if (!row || !Array.isArray(row.lines) || row.lines.length > 1_000) tradeInvalidResponse();
  return { revision: parseRevision(payload), lines: row.lines.map(parseLine)
    .sort((left, right) => left.printLineNumber - right.printLineNumber) };
}

export function parseQuotationCustomerPage(payload: unknown): QuotationCustomerPage {
  const page = record(payload);
  if (!page || !Array.isArray(page.items)) tradeInvalidResponse();
  return {
    items: page.items.map(parseCustomerOption),
    // Absent means "last page". `null` would be a value the service never
    // sends, so treating absence as the terminator is the whole contract.
    nextCursor:
      typeof page.nextCursor === "string" && page.nextCursor.length <= TRADE_CURSOR_MAX_LENGTH
        ? page.nextCursor
        : null,
  };
}

function parseRevision(payload: unknown): QuotationRevision {
  const revision = record(payload);
  if (
    !revision ||
    !isUUIDv7(revision.id) ||
    typeof revision.revisionNumber !== "number" ||
    !isTradeStatus(revision.status) ||
    !isTradeDate(revision.validUntil) ||
    !isTradeDecimal(revision.grandTotal)
  ) {
    tradeInvalidResponse();
  }
  return {
    id: revision.id,
    revisionNumber: revision.revisionNumber,
    status: revision.status,
    validUntil: revision.validUntil,
    grandTotal: revision.grandTotal,
    ...parseQuotationRevisionDiscount(revision, revision.grandTotal),
    termsSnapshot: jsonObject(revision.termsSnapshot),
    sentAt: optionalTimestamp(revision.sentAt),
    acceptedAt: optionalTimestamp(revision.acceptedAt),
    rejectedAt: optionalTimestamp(revision.rejectedAt),
    priceLockExpiresAt: optionalTimestamp(revision.priceLockExpiresAt),
  };
}

function parseLine(payload: unknown): QuotationLine {
  const line = record(payload);
  if (
    !line ||
    !isUUIDv7(line.id) ||
    !isUUIDv7(line.clientLineId) ||
    !isVersion(line.printLineNumber) ||
    !isBoundedString(line.descriptionSnapshot, 500) ||
    !isTradeDecimal(line.quantity) ||
    !isUUIDv7(line.uomId) ||
    !isTradeDecimal(line.unitPrice) ||
    !isTradeDecimal(line.lineTotal)
  ) {
    tradeInvalidResponse();
  }
  if (line.itemCompanyProfileId !== undefined && !isUUIDv7(line.itemCompanyProfileId)) {
    tradeInvalidResponse();
  }
  const taxSnapshot =
    line.taxSnapshot === undefined ? undefined : (record(line.taxSnapshot) ?? tradeInvalidResponse());
  return {
    id: line.id,
    clientLineId: line.clientLineId,
    printLineNumber: line.printLineNumber,
    ...(line.itemCompanyProfileId !== undefined ? { itemCompanyProfileId: line.itemCompanyProfileId } : {}),
    ...(line.itemImageId !== undefined ? { itemImageId: optionalUuid(line.itemImageId) } : {}),
    descriptionSnapshot: line.descriptionSnapshot,
    ...(line.deliveryDescriptionSnapshot !== undefined
      ? { deliveryDescriptionSnapshot: nullableString(line.deliveryDescriptionSnapshot, 500) }
      : {}),
    quantity: line.quantity,
    uomId: line.uomId,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    ...parseQuotationLineDiscount(line, line.quantity, line.unitPrice, line.lineTotal),
    ...(line.priceDecisionId !== undefined ? { priceDecisionId: optionalUuid(line.priceDecisionId) } : {}),
    ...(taxSnapshot !== undefined ? { taxSnapshot } : {}),
  };
}

const SNAPSHOT_DECIMAL_16_8 = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/u;

/** Extracts owner-validated snapshot evidence from a persisted quotation line (`quotation-pricing-owner.ts:78-93`). */
export function readQuotationLineSnapshot(line: QuotationLine): QuotationLineSnapshotEvidence {
  const snapshot = line.discountSnapshot;
  let corrupted = false;
  let itemId: string | null = null;
  if (snapshot.itemId !== undefined && snapshot.itemId !== null) {
    if (isUUIDv7(snapshot.itemId)) itemId = snapshot.itemId;
    else corrupted = true;
  }
  if (snapshot.clientLineId !== undefined && snapshot.clientLineId !== line.clientLineId) corrupted = true;
  if (snapshot.uomId !== undefined && snapshot.uomId !== line.uomId) corrupted = true;

  let priceBookId: string | null = null;
  if (snapshot.priceBookId !== undefined && snapshot.priceBookId !== null) {
    if (isUUIDv7(snapshot.priceBookId)) priceBookId = snapshot.priceBookId;
    else corrupted = true;
  }

  let discount: QuotationLineDiscountIntent | null = null;
  if (snapshot.discount !== undefined && snapshot.discount !== null) {
    const raw = record(snapshot.discount);
    const canonical = raw && typeof raw.value === "string" && raw.value.length <= 40
      ? canonicalizeDecimalInput(raw.value)
      : null;
    if (
      raw &&
      (raw.type === "PERCENT" || raw.type === "AMOUNT") &&
      canonical !== null &&
      SNAPSHOT_DECIMAL_16_8.test(canonical) &&
      (raw.type !== "PERCENT" || compareFixedDecimal(canonical, "100") <= 0)
    ) {
      discount = { type: raw.type, value: canonical };
    } else {
      corrupted = true;
    }
  }

  const tax = line.taxSnapshot;
  const sku = typeof tax?.sku === "string" && isBoundedString(tax.sku.trim(), 80) ? tax.sku.trim() : null;
  const uomCode = typeof tax?.uomCode === "string" && isBoundedString(tax.uomCode.trim(), 80) ? tax.uomCode.trim() : null;
  return {
    itemId,
    priceBookId,
    discount,
    itemCompanyProfileId: isUUIDv7(line.itemCompanyProfileId) ? line.itemCompanyProfileId : null,
    itemImageId: isUUIDv7(line.itemImageId) ? line.itemImageId : null,
    sku,
    uomCode,
    corrupted,
  };
}

function parseCustomerOption(payload: unknown): QuotationCustomerOption {
  const option = record(payload);
  if (
    !option ||
    !isUUIDv7(option.partyId) ||
    (option.partyType !== "PERSON" && option.partyType !== "ORGANIZATION") ||
    !isBoundedString(option.displayName, 500) ||
    !isTradeStatus(option.commercialAccountStatus) ||
    !isTradeStatus(option.eligibilitySource) ||
    typeof option.quotationSelectable !== "boolean"
  ) {
    tradeInvalidResponse();
  }
  return {
    partyId: option.partyId,
    partyType: option.partyType,
    displayName: option.displayName,
    crmCustomerProfileId: optionalUuid(option.crmCustomerProfileId),
    commercialAccountStatus: option.commercialAccountStatus,
    eligibilitySource: option.eligibilitySource,
    // A blocked customer is **returned, not filtered out**. Rendering it
    // disabled with the reason is the difference between "this account is
    // blocked" and "this customer does not exist".
    quotationSelectable: option.quotationSelectable,
    denialCode: nullableString(option.denialCode, 120),
  };
}

function optionalTimestamp(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return isTradeTimestamp(value) ? value : tradeInvalidResponse();
}

/** `CreateQuotationDto` — `partyId` and `currencyCode` are the only required fields. */
export function buildCreateQuotation(
  option: QuotationCustomerOption,
  currencyCode: string,
  draftReference: string,
  extras?: {
    contactPartyId?: string | null;
    sourceCrmOpportunityId?: string;
    sourceCrmOpportunityVersion?: number;
    extensionProfileVersionId?: string;
    extensionValues?: QuotationExtensionValueInput[];
  },
): CreateQuotationRequest {
  const code = currencyCode.trim().toUpperCase();
  if (!isUUIDv7(option.partyId)) throw new Error("QUOTATION_FORM_CUSTOMER");
  if (!isCurrencyCode(code)) throw new Error("QUOTATION_FORM_CURRENCY");
  const request: CreateQuotationRequest = { partyId: option.partyId, currencyCode: code };
  // Retained so every forward quotation command can revalidate the same
  // customer identity, exactly as the service does.
  if (option.crmCustomerProfileId) request.crmCustomerProfileId = option.crmCustomerProfileId;
  const reference = draftReference.trim();
  if (reference) request.draftReference = reference.slice(0, 80);
  if (extras?.contactPartyId !== undefined) {
    const contact = extras.contactPartyId?.trim() ?? "";
    if (contact !== "") {
      if (!isUUIDv7(contact)) throw new Error("QUOTATION_FORM_CONTACT_PARTY");
      request.contactPartyId = contact;
    } else if (extras.contactPartyId === null) {
      request.contactPartyId = null;
    }
  }
  if (extras?.sourceCrmOpportunityId) {
    const opp = extras.sourceCrmOpportunityId.trim();
    if (isUUIDv7(opp)) request.sourceCrmOpportunityId = opp;
  }
  if (
    typeof extras?.sourceCrmOpportunityVersion === "number" &&
    Number.isSafeInteger(extras.sourceCrmOpportunityVersion) &&
    extras.sourceCrmOpportunityVersion >= 1
  ) {
    request.sourceCrmOpportunityVersion = extras.sourceCrmOpportunityVersion;
  }
  if (extras?.extensionProfileVersionId && isUUIDv7(extras.extensionProfileVersionId)) {
    request.extensionProfileVersionId = extras.extensionProfileVersionId;
  }
  if (extras?.extensionValues && extras.extensionValues.length > 0) {
    request.extensionValues = extras.extensionValues.slice(0, 100);
  }
  return request;
}

/** `UpdateQuotationDto` — `draftReference`, `contactPartyId`, and optional `extensionValues`. */
export function buildUpdateQuotationHeader(input: {
  draftReference?: string;
  contactPartyId?: string;
  extensionProfileVersionId?: string;
  extensionValues?: QuotationExtensionValueInput[];
}): UpdateQuotationHeaderRequest {
  const payload: UpdateQuotationHeaderRequest = {};
  if (input.draftReference !== undefined) {
    const trimmedRef = input.draftReference.trim();
    payload.draftReference = trimmedRef.length > 0 ? trimmedRef.slice(0, 80) : null;
  }
  if (input.contactPartyId !== undefined) {
    const trimmedContact = input.contactPartyId.trim();
    if (trimmedContact.length > 0) {
      if (!isUUIDv7(trimmedContact)) throw new Error("QUOTATION_FORM_CONTACT_PARTY");
      payload.contactPartyId = trimmedContact;
    } else {
      payload.contactPartyId = null;
    }
  }
  if (input.extensionProfileVersionId && isUUIDv7(input.extensionProfileVersionId)) {
    payload.extensionProfileVersionId = input.extensionProfileVersionId;
  }
  if (input.extensionValues && input.extensionValues.length > 0) {
    payload.extensionValues = input.extensionValues.slice(0, 100);
  }
  return payload;
}

/** `DocumentReasonDto` — `reasonCode` (required <= 80) + optional `evidenceRef` (<= 240). */
export function buildQuotationReasonPayload(
  reasonCode: string,
  evidenceRef?: string,
): QuotationReasonPayload {
  const trimmedReason = reasonCode.trim();
  if (!trimmedReason) throw new Error("QUOTATION_REASON_REQUIRED");
  const payload: QuotationReasonPayload = {
    reasonCode: trimmedReason.slice(0, 80),
  };
  const trimmedEvidence = evidenceRef?.trim() ?? "";
  if (trimmedEvidence) {
    payload.evidenceRef = trimmedEvidence.slice(0, TRADE_EVIDENCE_REF_MAX_LENGTH);
  }
  return payload;
}

export interface PartyContactCoordinates {
  email: string | null;
  phone: string | null;
  contactName: string | null;
}

/** Reads any email / phone / contact name recorded in `partySnapshot` without inventing fields. */
export function extractPartyContactCoordinates(
  partySnapshot: Record<string, unknown>,
): PartyContactCoordinates {
  const pick = (...keys: string[]): string | null => {
    for (const key of keys) {
      const val = partySnapshot[key];
      if (typeof val === "string" && val.trim().length > 0) return val.trim();
    }
    return null;
  };
  return {
    email: pick("email", "primaryEmail", "contactEmail"),
    phone: pick("phone", "mobile", "primaryPhone", "whatsappPhone"),
    contactName: pick("contactDisplayName", "contactName", "primaryContactName"),
  };
}

export interface PriceLockSummary {
  state: "none" | "active" | "expiring" | "expired" | "pinned";
  hoursLeft: number | null;
}

/** Evaluates price-lock window health on a quotation + its current revision. */
export function computePriceLockStatus(
  lifecycleStatus: string,
  revision: QuotationRevision | null,
  nowMs: number = Date.now(),
): PriceLockSummary {
  if (lifecycleStatus === "ACCEPTED") {
    return { state: "pinned", hoursLeft: null };
  }
  if (!revision?.priceLockExpiresAt) {
    return { state: "none", hoursLeft: null };
  }
  const expiresMs = Date.parse(revision.priceLockExpiresAt);
  if (Number.isNaN(expiresMs)) return { state: "none", hoursLeft: null };
  const diffMs = expiresMs - nowMs;
  if (diffMs <= 0) return { state: "expired", hoursLeft: 0 };
  const hoursLeft = Math.max(1, Math.ceil(diffMs / 3_600_000));
  return {
    state: hoursLeft <= 24 ? "expiring" : "active",
    hoursLeft,
  };
}

export const TRADE_ITEMS_SEARCH_PATH = `${TRADE_V1}/items/search` as TradePath;

export function tradeItemDetailPath(itemId: string): TradePath {
  if (!isUUIDv7(itemId)) tradeInvalidResponse();
  return `${TRADE_V1}/items/${encodeURIComponent(itemId)}` as TradePath;
}

export interface QuotationItemDetailLookupResult {
  id: string;
  canonicalCode: string;
  localizedNames: Record<string, unknown>;
  status: string;
  companyProfileId: string | null;
  isSellEligible: boolean;
  primaryImageId: string | null;
  item: TradeItemOption | null;
}

/** Parses `GET /items/:id` (`catalog.service.ts:300-339`), mapping `companyProfile`/`branchProfile` into `eligibility`. */
export function parseQuotationItemDetailLookup(payload: unknown): QuotationItemDetailLookupResult {
  const row = record(payload);
  if (
    !row || !isUUIDv7(row.id) || !isBoundedString(row.canonicalCode, 80) || !isTradeStatus(row.status) ||
    !isUUIDv7(row.baseUomId) ||
    (row.itemKind !== undefined && row.itemKind !== "PRODUCT" && row.itemKind !== "SERVICE" && row.itemKind !== "COMBO")
  ) tradeInvalidResponse();
  const company = row.companyProfile === null || row.companyProfile === undefined
    ? null : (record(row.companyProfile) ?? tradeInvalidResponse());
  const branch = row.branchProfile === null || row.branchProfile === undefined
    ? null : (record(row.branchProfile) ?? tradeInvalidResponse());
  if (company && (!isUUIDv7(company.id) || !isVersion(company.version) || !isTradeStatus(company.status)
    || typeof company.canSell !== "boolean" || typeof company.canPurchase !== "boolean" || typeof company.canPos !== "boolean")) {
    tradeInvalidResponse();
  }
  if (branch && (!isUUIDv7(branch.id) || !isVersion(branch.version) || typeof branch.isAssorted !== "boolean")) {
    tradeInvalidResponse();
  }
  const image = parseItemImageSummary(row.image);
  const localizedNames = jsonObject(row.localizedNames);
  const candidate: TradeItemOption | null = company ? {
    id: row.id, canonicalCode: row.canonicalCode, barcode: nullableString(row.barcode, 128), localizedNames,
    quotationDescription: nullableString(row.quotationDescription, 500),
    salesOrderDescription: nullableString(row.salesOrderDescription, 500),
    receiptDescription: nullableString(row.receiptDescription, 500),
    deliveryOrderDescription: nullableString(row.deliveryOrderDescription, 500),
    status: row.status,
    ...(row.itemKind === "PRODUCT" || row.itemKind === "SERVICE" || row.itemKind === "COMBO" ? { itemKind: row.itemKind } : {}),
    image,
    eligibility: {
      companyProfileId: company.id as string, companyProfileVersion: company.version as number,
      companyProfileStatus: company.status as string, canSell: company.canSell as boolean,
      canPurchase: company.canPurchase as boolean, canPos: company.canPos as boolean, baseUomId: row.baseUomId,
      defaultSalesUomId: optionalUuid(company.defaultSalesUomId) ?? row.baseUomId,
      defaultPurchaseUomId: optionalUuid(company.defaultPurchaseUomId) ?? row.baseUomId,
      branchProfileId: branch ? (branch.id as string) : null,
      branchProfileVersion: branch ? (branch.version as number) : null,
      isAssorted: branch ? (branch.isAssorted as boolean) : null,
    },
  } : null;
  const isSellEligible = candidate !== null && isItemEligibleForPurpose(candidate, "SALES");
  return {
    id: row.id, canonicalCode: row.canonicalCode, localizedNames, status: row.status,
    companyProfileId: company ? (company.id as string) : null, isSellEligible,
    primaryImageId: image?.id ?? null, item: isSellEligible ? candidate : null,
  };
}

/** Matches legacy `POST /items/search` ONLY when both `canonicalCode === sku` and `companyProfileId` match (`catalog.repository.ts:34-49`). */
export function parseQuotationLegacySkuSearch(
  payload: unknown, sku: string, itemCompanyProfileId: string,
): QuotationItemDetailLookupResult | null {
  const page = parseTradeListPage(payload, (raw): TradeItemOption | null => {
    const row = record(raw);
    const elig = record(row?.eligibility);
    if (!row || !elig || !isUUIDv7(row.id) || !isBoundedString(row.canonicalCode, 80) || !isTradeStatus(row.status)
      || !isUUIDv7(elig.companyProfileId) || !isVersion(elig.companyProfileVersion) || !isTradeStatus(elig.companyProfileStatus)
      || typeof elig.canSell !== "boolean" || typeof elig.canPurchase !== "boolean" || typeof elig.canPos !== "boolean"
      || !isUUIDv7(elig.baseUomId) || !isUUIDv7(elig.defaultSalesUomId) || !isUUIDv7(elig.defaultPurchaseUomId)) return null;
    return {
      id: row.id, canonicalCode: row.canonicalCode, barcode: nullableString(row.barcode, 128),
      localizedNames: jsonObject(row.localizedNames), quotationDescription: nullableString(row.quotationDescription, 500),
      salesOrderDescription: nullableString(row.salesOrderDescription, 500),
      receiptDescription: nullableString(row.receiptDescription, 500),
      deliveryOrderDescription: nullableString(row.deliveryOrderDescription, 500), status: row.status,
      ...(row.itemKind === "PRODUCT" || row.itemKind === "SERVICE" || row.itemKind === "COMBO" ? { itemKind: row.itemKind } : {}),
      image: parseItemImageSummary(row.image),
      eligibility: {
        companyProfileId: elig.companyProfileId, companyProfileVersion: elig.companyProfileVersion,
        companyProfileStatus: elig.companyProfileStatus, canSell: elig.canSell, canPurchase: elig.canPurchase, canPos: elig.canPos,
        baseUomId: elig.baseUomId, defaultSalesUomId: elig.defaultSalesUomId, defaultPurchaseUomId: elig.defaultPurchaseUomId,
        branchProfileId: optionalUuid(elig.branchProfileId),
        branchProfileVersion: typeof elig.branchProfileVersion === "number" ? elig.branchProfileVersion : null,
        isAssorted: typeof elig.isAssorted === "boolean" ? elig.isAssorted : null,
      },
    };
  });
  const matches = page.items.filter(
    (item): item is TradeItemOption =>
      item !== null && item.canonicalCode === sku && item.eligibility.companyProfileId === itemCompanyProfileId,
  );
  if (matches.length !== 1) return null;
  const match = matches[0]!;
  const isSellEligible = isItemEligibleForPurpose(match, "SALES");
  return {
    id: match.id, canonicalCode: match.canonicalCode, localizedNames: match.localizedNames, status: match.status,
    companyProfileId: match.eligibility.companyProfileId, isSellEligible, primaryImageId: match.image?.id ?? null,
    item: isSellEligible ? match : null,
  };
}

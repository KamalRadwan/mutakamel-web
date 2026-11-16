import type { TradePath } from "@/lib/api/envelope";
import {
  isBoundedInteger,
  isDecimalString,
  isMemberOf,
  isNonEmptyString,
  isNullableDecimalString,
  isTimestamp,
  isUuidV7,
  parseTradeOffsetPage,
  record,
  type TradeOffsetPage,
} from "../trade-advanced-validation";

// Price books, price-book versions, reference data and price evaluation — 16 routes
// plus 4 company-default mapping routes under `/configuration/company-default-price-books`.
// Verified against `docs/api/trade-advanced.md#price-books--16-routes` and
// `docs/api/trade-foundation.md#configuration--10-routes`.

export const PRICE_BOOKS_PATH = "/api/tenant/trade/v1/price-books";
export const PRICING_EVALUATE_PATH = "/api/tenant/trade/v1/pricing/evaluate";
export const PRICING_REFERENCE_DATA_PATH = "/api/tenant/trade/v1/pricing/reference-data";
export const COMPANY_DEFAULT_PRICE_BOOKS_LIST_PATH =
  "/api/tenant/trade/v1/configuration/company-default-price-books";

export const PRICING_READ_PERMISSION = "trade.pricing.read";
export const PRICING_MANAGE_PERMISSION = "trade.pricing.manage";
export const CONFIGURATION_MANAGE_PERMISSION = "trade.configuration.manage";
/**
 * Publishing or retiring a price-book version needs a **Policy Studio** grant,
 * not `trade.pricing.manage`.
 */
export const POLICY_PUBLISH_PERMISSION = "trade.policy.publish";

export const PRICE_BOOK_PAGE_SIZE = 25;
export const PRICE_BOOK_CODE_MAX_LENGTH = 80;
export const PRICE_ENTRIES_MAX = 10_000;
export const PROMOTIONS_MAX = 500;
export const PROMOTION_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
export const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/u;
const ANY_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export const PRICE_BOOK_PURPOSES = ["SALES", "PURCHASE"] as const;
export const PRICE_BOOK_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export const PRICE_BOOK_GOVERNANCE_FILTERS = [
  "PUBLISHED",
  "SCHEDULED",
  "TESTED",
  "DRAFT_ONLY",
  "INACTIVE",
] as const;
export const PROMOTION_BENEFIT_TYPES = ["PERCENTAGE", "FIXED_AMOUNT"] as const;
export const CLONE_SOURCE_MODES = ["VERSION", "CATALOG", "EMPTY"] as const;
export const PRICE_ADJUSTMENT_MODES = ["NONE", "PERCENTAGE", "FIXED_DELTA"] as const;
export const PRICE_ROUNDING_MODES = ["NONE", "NEAREST_1", "NEAREST_0_50", "END_95"] as const;
/** `trade-app/src/common/decimal-patterns.ts` — signed 16 integer + 8 fraction digits. */
export const SIGNED_DECIMAL_16_8_PATTERN = /^-?(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/u;
export const PRICE_BOOK_NAME_MAX_LENGTH = 160;
export const PRICE_BOOK_DESCRIPTION_MAX_LENGTH = 500;
export const PRICE_BOOK_VERSION_NOTES_MAX_LENGTH = 500;
export const SOLO_OWNER_APPROVAL_NOTES_MAX_LENGTH = 240;
export const RETIRE_REASON_MAX_LENGTH = 240;

export type PriceBookPurpose = (typeof PRICE_BOOK_PURPOSES)[number];
export type PriceBookStatus = (typeof PRICE_BOOK_STATUSES)[number];
export type PriceBookGovernanceFilter = (typeof PRICE_BOOK_GOVERNANCE_FILTERS)[number];
export type PromotionBenefitType = (typeof PROMOTION_BENEFIT_TYPES)[number];
export type CloneSourceMode = (typeof CLONE_SOURCE_MODES)[number];
export type PriceAdjustmentMode = (typeof PRICE_ADJUSTMENT_MODES)[number];
export type PriceRoundingMode = (typeof PRICE_ROUNDING_MODES)[number];

export interface LocalizedNames {
  ar: string | null;
  en: string | null;
}

interface PriceBookVersionSummary {
  id: string;
  versionNumber: number;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  supersededAt?: string | null;
  version: number;
}

export interface PriceBook {
  id: string;
  code: string;
  name?: string | null;
  localizedNames?: LocalizedNames;
  description?: string | null;
  purpose: string;
  currencyCode: string;
  status: string;
  version: number;
  versionCount: number;
  versions: PriceBookVersionSummary[];
  isCompanyDefault?: boolean;
  linkedAccountsCount?: number;
  entryCount?: number;
  promotionCount?: number;
  updatedAt?: string | null;
}

export interface PriceBookKpis {
  total: number;
  active: number;
  inactive: number;
  sales: number;
  purchase: number;
  publishedBooks: number;
  scheduledBooks: number;
  testedBooks: number;
  draftOnlyBooks: number;
  mappedDefaults: number;
  distinctCurrencies: string[];
}

export interface CompanyDefaultPriceBook {
  purpose: PriceBookPurpose;
  currencyCode: string;
  priceBookId: string;
  version: number;
  updatedAt?: string | null;
  priceBookCode?: string | null;
  priceBookName?: string | null;
}

export interface GovernanceAuditEvent {
  id: string;
  resourceType: string;
  resourceId: string;
  resourceVersion: number;
  action: string;
  actorUserId: string;
  actorDisplayName: string | null;
  actorEmail: string | null;
  reason: string | null;
  occurredAt: string;
  evidence: Record<string, unknown>;
}

export interface PriceBookTimelineVersion extends PriceBookVersionSummary {
  supersededByVersionId: string | null;
  checksum: string;
  createdByUserId: string | null;
  createdByDisplayName: string | null;
  createdByEmail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  entryCount: number;
  promotionCount: number;
  latestTestPassed: boolean | null;
  latestTestedAt: string | null;
  notes: string | null;
  clonedFromVersionId: string | null;
  sourceMode: string | null;
}

interface PriceBookLinkedAccount {
  id: string;
  partyId: string;
  displayName: string;
  partyType: string;
  accountRole: string;
  status: string;
  creditLimit: string | null;
  creditCurrencyCode: string | null;
}

export interface PriceBookDetail {
  book: {
    id: string;
    companyId: string | null;
    code: string;
    purpose: string;
    currencyCode: string;
    status: string;
    version: number;
    name: string | null;
    localizedNames: LocalizedNames;
    description: string | null;
    isCompanyDefault: boolean;
    createdAt: string | null;
    updatedAt: string | null;
  };
  companyDefaultMapping: {
    id: string;
    purpose: PriceBookPurpose;
    currencyCode: string;
    priceBookId: string;
    version: number;
    isThisBook: boolean;
  } | null;
  versions: PriceBookTimelineVersion[];
  linkedAccounts: PriceBookLinkedAccount[];
  activeLocksCount: number;
  auditTrail: GovernanceAuditEvent[];
}

export interface PriceEntry {
  id: string;
  itemId: string;
  itemCode?: string | null;
  itemLocalizedNames?: Record<string, string> | null;
  catalogSalesPrice?: string | null;
  standardCost?: string | null;
  uomId: string;
  uomCode?: string | null;
  uomDisplayName?: string | null;
  uomLocalizedNames?: Record<string, string> | null;
  currencyCode: string;
  minimumQuantity: string;
  maximumQuantity: string | null;
  unitPrice: string;
  minimumAllowedPrice: string | null;
  priority: number;
}

interface PromotionRow {
  id: string;
  code: string;
  name: string;
  versionNumber: number;
  status: string;
  priority: number;
  stackGroup: string;
  exclusive: boolean;
  benefitType?: string | null;
  discountValue?: string | null;
  selector?: Record<string, unknown>;
  benefit?: Record<string, unknown>;
  itemCode?: string | null;
  uomCode?: string | null;
}

export interface PriceBookVersionTestReport {
  passed: boolean;
  entryCount: number;
  promotionCount: number;
  conflicts: string[];
  promotionConflicts: string[];
}

export interface PriceBookVersionDetail {
  canViewCost?: boolean;
  soloOwnerGovernanceEligible?: boolean;
  book: {
    id: string;
    code: string;
    purpose: string;
    currencyCode: string;
    status: string;
    version: number;
    name?: string | null;
    localizedNames?: LocalizedNames;
    description?: string | null;
    versions?: PriceBookVersionSummary[];
  };
  version: PriceBookVersionSummary & {
    supersededByVersionId?: string | null;
    checksum: string;
    createdByUserId?: string | null;
    createdByDisplayName?: string | null;
    createdByEmail?: string | null;
    notes?: string | null;
    clonedFromVersionId?: string | null;
    sourceMode?: string | null;
  };
  entries: PriceEntry[];
  promotions: PromotionRow[];
  /** Null until a `test` run has been recorded against this version. */
  latestTestEvidence: {
    id?: string;
    aggregateVersion?: number;
    contentHash?: string;
    passed: boolean;
    testedAt: string;
    report?: PriceBookVersionTestReport | null;
  } | null;
  auditTrail?: GovernanceAuditEvent[];
}

interface PriceEntryDiffRow {
  changeType: "ADDED" | "REMOVED" | "INCREASED" | "DECREASED" | "UNCHANGED";
  itemId: string;
  itemCode: string;
  itemLocalizedNames: Record<string, string>;
  uomId: string;
  uomCode: string;
  minimumQuantity: string;
  maximumQuantity: string | null;
  priority: number;
  baselineUnitPrice: string | null;
  targetUnitPrice: string | null;
  deltaAmount: string;
  deltaPct: number | null;
}

interface PromotionDiffRow {
  changeType: "ADDED" | "REMOVED" | "MODIFIED" | "UNCHANGED";
  code: string;
  name: string;
  baselineBenefit: Record<string, unknown> | null;
  targetBenefit: Record<string, unknown> | null;
}

export interface PriceBookVersionDiff {
  currencyCode: string;
  targetVersion: {
    id: string;
    priceBookId: string;
    priceBookCode: string;
    versionNumber: number;
    status: string;
  };
  baselineVersion: {
    id: string;
    priceBookId: string;
    priceBookCode: string;
    versionNumber: number;
    status: string;
  };
  summary: {
    totalCompared: number;
    added: number;
    removed: number;
    increased: number;
    decreased: number;
    unchanged: number;
    promotionsChanged: number;
  };
  entries: PriceEntryDiffRow[];
  promotions: PromotionDiffRow[];
}

export interface PricingReferenceItem {
  itemId: string;
  canonicalCode: string;
  itemKind: string;
  localizedNames: Record<string, string>;
  baseUomId: string;
  defaultSalesUomId: string | null;
  defaultPurchaseUomId: string | null;
  canSell: boolean;
  canPurchase: boolean;
  salesPrice: string | null;
  standardCost: string | null;
  currencyCode: string | null;
}

export interface PricingReferenceUom {
  id: string;
  code: string;
  displayName: string;
  localizedNames: Record<string, string>;
}

export interface PricingReferenceBranch {
  id: string;
  code: string;
  name: string;
  isHeadquarters: boolean;
}

export interface PricingReferenceChannel {
  id: string;
  code: string;
  name: string;
  channelType: string;
}

export interface PricingReferenceAccount {
  id: string;
  partyId: string;
  displayName: string;
  partyType: string;
  accountRole: string;
  priceBookId: string | null;
  status: string;
}

interface PricingReferenceCurrency {
  code: string;
  name: string;
  symbol: string | null;
  decimalPlaces: number;
  isDefault: boolean;
}

export interface PricingReferenceData {
  canViewCost: boolean;
  items: PricingReferenceItem[];
  uoms: PricingReferenceUom[];
  branches: PricingReferenceBranch[];
  channels: PricingReferenceChannel[];
  commercialAccounts: PricingReferenceAccount[];
  currencies: PricingReferenceCurrency[];
}

interface PricingDecisionComponent {
  type: string;
  code: string;
  amount: string;
}

interface PricingRejectedPromotion {
  promotionId?: string;
  code: string;
  reason: string;
}

interface PricingRejectedCandidate {
  entryId: string;
  reason: string;
}

export interface PricingDecisionResult {
  outcome: string;
  decisionType?: string;
  unitPrice: string;
  baselineUnitPrice: string;
  currencyCode: string;
  priceBookId: string;
  priceBookVersionId: string;
  priceBookVersion?: number;
  checksum?: string;
  matchedEntryId?: string;
  minimumAllowedPrice: string | null;
  /** The receipt id — the only way to reach `GET /decisions/:id`. */
  decisionId: string;
  matchedPromotions: Array<{
    promotionId?: string;
    code: string;
    name?: string;
    benefitType?: string;
    discountValue?: string;
    discountAmount: string;
    priority?: number;
    stackGroup?: string;
    exclusive?: boolean;
  }>;
  rejectedPromotions?: PricingRejectedPromotion[];
  components?: PricingDecisionComponent[];
  rejectedCandidates?: PricingRejectedCandidate[];
  inputFingerprint?: string;
  evaluatedAt?: string;
  taxFinal?: boolean;
}

export function priceBookDetailPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidPricingResponse();
  return `/api/tenant/trade/v1/price-books/${encodeURIComponent(id)}` as TradePath;
}

export function priceBookVersionsPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidPricingResponse();
  return `${PRICE_BOOKS_PATH}/${encodeURIComponent(id)}/versions` as TradePath;
}

export function priceBookCloneVersionPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidPricingResponse();
  return `/api/tenant/trade/v1/price-books/${encodeURIComponent(id)}/versions/clone` as TradePath;
}

export function priceBookVersionPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidPricingResponse();
  return `/api/tenant/trade/v1/price-book-versions/${encodeURIComponent(id)}` as TradePath;
}

export function priceBookVersionActionPath(
  id: string,
  action: "test" | "publish" | "retire",
): TradePath {
  if (!isUuidV7(id)) invalidPricingResponse();
  const encoded = encodeURIComponent(id);
  if (action === "test") {
    return `/api/tenant/trade/v1/price-book-versions/${encoded}/test` as TradePath;
  }
  if (action === "publish") {
    return `/api/tenant/trade/v1/price-book-versions/${encoded}/publish` as TradePath;
  }
  return `/api/tenant/trade/v1/price-book-versions/${encoded}/retire` as TradePath;
}

export function priceBookVersionDiffPath(id: string, compareVersionId: string): TradePath {
  if (!isUuidV7(id) || !isUuidV7(compareVersionId)) invalidPricingResponse();
  return `/api/tenant/trade/v1/price-book-versions/${encodeURIComponent(id)}/diff/${encodeURIComponent(compareVersionId)}` as TradePath;
}

export function companyDefaultPriceBookPath(
  purpose: PriceBookPurpose | string,
  currencyCode: string,
): TradePath {
  const normalized = currencyCode.trim().toUpperCase();
  if (!CURRENCY_CODE_PATTERN.test(normalized)) throw new Error("PRICING_FORM_CURRENCY");
  return `/api/tenant/trade/v1/configuration/company-default-price-books/${purpose}/${normalized}` as TradePath;
}

export function companyDefaultPriceBookUpsertPath(
  purpose: PriceBookPurpose | string,
  currencyCode: string,
): TradePath {
  return `${companyDefaultPriceBookPath(purpose, currencyCode)}/upsert` as TradePath;
}

export function priceBooksListPath(
  page: number,
  purpose?: PriceBookPurpose,
  status?: string,
  q?: string,
  governanceState?: PriceBookGovernanceFilter,
  currencyCode?: string,
): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(PRICE_BOOK_PAGE_SIZE) });
  if (purpose) query.set("purpose", purpose);
  if (status) query.set("status", status);
  if (q && q.trim().length > 0) query.set("q", q.trim());
  if (governanceState) query.set("governanceState", governanceState);
  if (currencyCode && CURRENCY_CODE_PATTERN.test(currencyCode.trim().toUpperCase())) {
    query.set("currencyCode", currencyCode.trim().toUpperCase());
  }
  return `${PRICE_BOOKS_PATH}?${query.toString()}` as TradePath;
}

export interface PriceBookFormValues {
  code: string;
  name?: string;
  nameAr?: string;
  nameEn?: string;
  description?: string;
  purpose: PriceBookPurpose;
  currencyCode: string;
  seedMode?: "EMPTY" | "CATALOG" | "CLONE";
  sourceBookId?: string;
  sourceVersionId?: string;
  effectiveFrom?: string;
  adjustmentMode?: PriceAdjustmentMode;
  adjustmentValue?: string;
  roundingMode?: PriceRoundingMode;
  copyPromotions?: boolean;
  setAsCompanyDefault?: boolean;
  notes?: string;
}

export const EMPTY_PRICE_BOOK_FORM: PriceBookFormValues = {
  code: "",
  name: "",
  nameAr: "",
  nameEn: "",
  description: "",
  purpose: "SALES",
  currencyCode: "",
  seedMode: "EMPTY",
  sourceBookId: "",
  sourceVersionId: "",
  effectiveFrom: "",
  adjustmentMode: "NONE",
  adjustmentValue: "0",
  roundingMode: "NONE",
  copyPromotions: true,
  setAsCompanyDefault: false,
  notes: "",
};

export interface UpdatePriceBookInput {
  name?: string;
  localizedNames?: { ar?: string; en?: string };
  description?: string;
  status?: PriceBookStatus;
}

export interface ClonePriceBookVersionInput {
  sourceMode: CloneSourceMode;
  sourceVersionId?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  adjustmentMode?: PriceAdjustmentMode;
  adjustmentValue?: string;
  roundingMode?: PriceRoundingMode;
  copyPromotions?: boolean;
  notes?: string;
}

export function buildCreatePriceBookRequest(values: PriceBookFormValues) {
  const code = values.code.trim();
  const currencyCode = values.currencyCode.trim().toUpperCase();
  const nameAr = values.nameAr?.trim() ?? "";
  const nameEn = values.nameEn?.trim() ?? "";
  const explicitName = values.name?.trim() ?? "";
  const resolvedName = explicitName || nameEn || nameAr;
  const description = values.description?.trim() ?? "";
  if (code.length === 0 || code.length > PRICE_BOOK_CODE_MAX_LENGTH) {
    throw new Error("PRICING_FORM_CODE");
  }
  if (!CURRENCY_CODE_PATTERN.test(currencyCode)) throw new Error("PRICING_FORM_CURRENCY");
  const localizedNames =
    nameAr || nameEn
      ? {
          ...(nameAr ? { ar: nameAr } : {}),
          ...(nameEn ? { en: nameEn } : {}),
        }
      : undefined;

  return {
    code,
    purpose: values.purpose,
    currencyCode,
    ...(resolvedName ? { name: resolvedName } : {}),
    ...(localizedNames ? { localizedNames } : {}),
    ...(description ? { description } : {}),
  };
}

export function buildUpdatePriceBookRequest(input: UpdatePriceBookInput) {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length > PRICE_BOOK_NAME_MAX_LENGTH) throw new Error("PRICING_FORM_BOOK_NAME");
    payload.name = trimmed;
  }
  if (input.localizedNames !== undefined) {
    const ar = input.localizedNames.ar?.trim();
    const en = input.localizedNames.en?.trim();
    if ((ar && ar.length > PRICE_BOOK_NAME_MAX_LENGTH) || (en && en.length > PRICE_BOOK_NAME_MAX_LENGTH)) {
      throw new Error("PRICING_FORM_BOOK_NAME");
    }
    payload.localizedNames = {
      ...(ar !== undefined ? { ar } : {}),
      ...(en !== undefined ? { en } : {}),
    };
  }
  if (input.description !== undefined) {
    const trimmed = input.description.trim();
    if (trimmed.length > PRICE_BOOK_DESCRIPTION_MAX_LENGTH) {
      throw new Error("PRICING_FORM_BOOK_DESCRIPTION");
    }
    payload.description = trimmed;
  }
  if (input.status !== undefined) {
    payload.status = input.status;
  }
  return payload;
}

export function buildClonePriceBookVersionRequest(input: ClonePriceBookVersionInput) {
  const parsedFrom = new Date(input.effectiveFrom);
  if (!input.effectiveFrom.trim() || Number.isNaN(parsedFrom.getTime())) {
    throw new Error("PRICING_FORM_DATE");
  }

  let parsedToIso: string | undefined;
  if (input.effectiveTo && input.effectiveTo.trim().length > 0) {
    const parsedTo = new Date(input.effectiveTo);
    if (Number.isNaN(parsedTo.getTime()) || parsedTo.getTime() <= parsedFrom.getTime()) {
      throw new Error("PRICING_FORM_DATE");
    }
    parsedToIso = parsedTo.toISOString();
  }

  const trimmedNotes = input.notes?.trim() ?? "";
  if (trimmedNotes.length > PRICE_BOOK_VERSION_NOTES_MAX_LENGTH) {
    throw new Error("PRICING_FORM_NOTES");
  }

  if (input.sourceMode === "EMPTY") {
    return {
      sourceMode: "EMPTY_DRAFT",
      effectiveFrom: parsedFrom.toISOString(),
      ...(parsedToIso ? { effectiveTo: parsedToIso } : {}),
      ...(trimmedNotes ? { notes: trimmedNotes } : {}),
    };
  }

  if (input.sourceMode === "VERSION") {
    const src = input.sourceVersionId?.trim() ?? "";
    if (!isUuidV7(src)) throw new Error("PRICING_FORM_ENTRY_ID");
  }
  const adjustmentMode = input.adjustmentMode ?? "NONE";
  const adjustmentValue = (input.adjustmentValue ?? "0").trim() || "0";
  if (adjustmentMode !== "NONE" && !SIGNED_DECIMAL_16_8_PATTERN.test(adjustmentValue)) {
    throw new Error("PRICING_FORM_AMOUNT");
  }

  const backendSourceMode =
    input.sourceMode === "CATALOG" ? "SEED_FROM_CATALOG" : "CLONE_VERSION";

  const body: Record<string, unknown> = {
    sourceMode: backendSourceMode,
    effectiveFrom: parsedFrom.toISOString(),
    adjustmentMode,
    roundingMode: input.roundingMode ?? "NONE",
    ...(input.sourceMode === "VERSION"
      ? {
          sourceVersionId: input.sourceVersionId!.trim(),
          includePromotions: input.copyPromotions ?? true,
        }
      : {}),
    ...(adjustmentMode !== "NONE" ? { adjustmentValue } : {}),
    ...(parsedToIso ? { effectiveTo: parsedToIso } : {}),
    ...(trimmedNotes ? { notes: trimmedNotes } : {}),
  };
  return body;
}

export function localizedBookDisplayName(
  book: {
    code: string;
    name?: string | null;
    localizedNames?: LocalizedNames | null;
  },
  lang: string,
): string {
  const ar = book.localizedNames?.ar?.trim();
  const en = book.localizedNames?.en?.trim();
  if (lang.startsWith("ar")) return ar || book.name?.trim() || en || book.code;
  return en || book.name?.trim() || ar || book.code;
}

export function localizedRecordName(
  names: Record<string, string> | LocalizedNames | null | undefined,
  fallback: string,
  lang: string,
): string {
  if (!names || typeof names !== "object") return fallback;
  const map = names as Record<string, string | null | undefined>;
  const order = lang.startsWith("ar") ? ["ar", "en"] : ["en", "ar"];
  for (const key of order) {
    const val = map[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return fallback;
}

function parseLocalizedNames(raw: unknown): LocalizedNames {
  const obj = record(raw);
  if (!obj) return { ar: null, en: null };
  return {
    ar: typeof obj.ar === "string" && obj.ar.trim() ? obj.ar.trim() : null,
    en: typeof obj.en === "string" && obj.en.trim() ? obj.en.trim() : null,
  };
}

function parseStringRecord(raw: unknown): Record<string, string> {
  const obj = record(raw);
  if (!obj) return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") result[k] = v;
  }
  return result;
}

function parseAuditEvent(payload: unknown): GovernanceAuditEvent {
  const row = record(payload);
  if (
    !row ||
    typeof row.id !== "string" ||
    typeof row.action !== "string" ||
    !isTimestamp(row.occurredAt)
  ) {
    invalidPricingResponse();
  }
  return {
    id: row.id,
    resourceType: typeof row.resourceType === "string" ? row.resourceType : "PRICE_BOOK",
    resourceId: typeof row.resourceId === "string" ? row.resourceId : "",
    resourceVersion: typeof row.resourceVersion === "number" ? row.resourceVersion : 1,
    action: row.action,
    actorUserId: typeof row.actorUserId === "string" ? row.actorUserId : "",
    actorDisplayName: typeof row.actorDisplayName === "string" ? row.actorDisplayName : null,
    actorEmail: typeof row.actorEmail === "string" ? row.actorEmail : null,
    reason: typeof row.reason === "string" ? row.reason : null,
    occurredAt: row.occurredAt,
    evidence: record(row.evidence) ?? {},
  };
}

export function parsePriceBookKpis(payload: unknown): PriceBookKpis {
  const row = record(payload);
  if (!row || typeof row.total !== "number") invalidPricingResponse();
  return {
    total: Number(row.total ?? 0),
    active: Number(row.active ?? 0),
    inactive: Number(row.inactive ?? 0),
    sales: Number(row.sales ?? 0),
    purchase: Number(row.purchase ?? 0),
    publishedBooks: Number(row.publishedBooks ?? 0),
    scheduledBooks: Number(row.scheduledBooks ?? 0),
    testedBooks: Number(row.testedBooks ?? 0),
    draftOnlyBooks: Number(row.draftOnlyBooks ?? 0),
    mappedDefaults: Number(row.mappedDefaults ?? 0),
    distinctCurrencies: Array.isArray(row.distinctCurrencies)
      ? row.distinctCurrencies.filter((c): c is string => typeof c === "string")
      : [],
  };
}

export function parseCompanyDefaultPriceBook(payload: unknown): CompanyDefaultPriceBook {
  const row = record(payload);
  if (
    !row ||
    !isPriceBookPurpose(row.purpose) ||
    !isNonEmptyString(row.currencyCode, 3) ||
    !isUuidV7(row.priceBookId) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER)
  ) {
    invalidPricingResponse();
  }
  return {
    purpose: row.purpose,
    currencyCode: row.currencyCode,
    priceBookId: row.priceBookId,
    version: row.version,
    updatedAt: isTimestamp(row.updatedAt) ? row.updatedAt : null,
    ...(typeof row.priceBookCode === "string" ? { priceBookCode: row.priceBookCode } : {}),
    ...(typeof row.priceBookName === "string" ? { priceBookName: row.priceBookName } : {}),
  };
}

export function parseCompanyDefaultPriceBooksList(payload: unknown): CompanyDefaultPriceBook[] {
  const body = record(payload);
  if (!body || !Array.isArray(body.items)) invalidPricingResponse();
  return body.items.map(parseCompanyDefaultPriceBook);
}

export function parsePriceBooksResponse(payload: unknown): TradeOffsetPage<PriceBook> {
  return parseTradeOffsetPage(payload, parsePriceBook, invalidPricingResponse);
}

function parseVersionSummary(payload: unknown): PriceBookVersionSummary {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isBoundedInteger(row.versionNumber, 1, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(row.status, 32) ||
    !isTimestamp(row.effectiveFrom) ||
    (row.supersededAt != null && !isTimestamp(row.supersededAt)) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER)
  ) {
    invalidPricingResponse();
  }
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    status: row.status,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: isTimestamp(row.effectiveTo) ? row.effectiveTo : null,
    supersededAt: isTimestamp(row.supersededAt) ? row.supersededAt : null,
    version: row.version,
  };
}

function parsePriceBook(payload: unknown): PriceBook {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.code, PRICE_BOOK_CODE_MAX_LENGTH) ||
    !isNonEmptyString(row.purpose, 32) ||
    !isNonEmptyString(row.currencyCode, 3) ||
    !isNonEmptyString(row.status, 32) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER) ||
    !isBoundedInteger(row.versionCount, 0, Number.MAX_SAFE_INTEGER) ||
    !Array.isArray(row.versions) ||
    row.versions.length > 5 ||
    row.versions.length !== Math.min(row.versionCount, 5)
  ) {
    invalidPricingResponse();
  }
  return {
    id: row.id,
    code: row.code,
    ...(typeof row.name === "string" || row.name === null ? { name: row.name } : {}),
    ...(row.localizedNames ? { localizedNames: parseLocalizedNames(row.localizedNames) } : {}),
    ...(typeof row.description === "string" || row.description === null
      ? { description: row.description }
      : {}),
    purpose: row.purpose,
    currencyCode: row.currencyCode,
    status: row.status,
    version: row.version,
    versionCount: row.versionCount,
    versions: row.versions.map(parseVersionSummary),
    ...(typeof row.isCompanyDefault === "boolean"
      ? { isCompanyDefault: row.isCompanyDefault }
      : {}),
    ...(typeof row.linkedAccountsCount === "number"
      ? { linkedAccountsCount: row.linkedAccountsCount }
      : {}),
    ...(typeof row.entryCount === "number" ? { entryCount: row.entryCount } : {}),
    ...(typeof row.promotionCount === "number" ? { promotionCount: row.promotionCount } : {}),
    ...(isTimestamp(row.updatedAt) ? { updatedAt: row.updatedAt } : {}),
  };
}

export function parsePriceBookDetail(payload: unknown): PriceBookDetail {
  const body = record(payload);
  const book = body ? record(body.book) : null;
  if (
    !body ||
    !book ||
    !isUuidV7(book.id) ||
    !isNonEmptyString(book.code, PRICE_BOOK_CODE_MAX_LENGTH) ||
    !isNonEmptyString(book.currencyCode, 3) ||
    !Array.isArray(body.versions)
  ) {
    invalidPricingResponse();
  }
  const mappingRaw = record(body.companyDefaultMapping);
  const companyDefaultMapping =
    mappingRaw &&
    isPriceBookPurpose(mappingRaw.purpose) &&
    typeof mappingRaw.currencyCode === "string" &&
    isUuidV7(mappingRaw.priceBookId) &&
    typeof mappingRaw.version === "number"
      ? {
          id: typeof mappingRaw.id === "string" ? mappingRaw.id : mappingRaw.priceBookId,
          purpose: mappingRaw.purpose,
          currencyCode: mappingRaw.currencyCode,
          priceBookId: mappingRaw.priceBookId,
          version: mappingRaw.version,
          isThisBook: Boolean(mappingRaw.isThisBook),
        }
      : null;

  return {
    book: {
      id: book.id,
      companyId:
        typeof book.companyId === "string" && ANY_UUID_PATTERN.test(book.companyId)
          ? book.companyId
          : null,
      code: book.code,
      purpose: typeof book.purpose === "string" ? book.purpose : "SALES",
      currencyCode: book.currencyCode,
      status: typeof book.status === "string" ? book.status : "ACTIVE",
      version: isBoundedInteger(book.version, 0, Number.MAX_SAFE_INTEGER) ? book.version : 1,
      name: typeof book.name === "string" && book.name.trim() ? book.name : null,
      localizedNames: parseLocalizedNames(book.localizedNames),
      description:
        typeof book.description === "string" && book.description.trim() ? book.description : null,
      isCompanyDefault: Boolean(book.isCompanyDefault),
      createdAt: isTimestamp(book.createdAt) ? book.createdAt : null,
      updatedAt: isTimestamp(book.updatedAt) ? book.updatedAt : null,
    },
    companyDefaultMapping,
    versions: body.versions.map((raw) => {
      const row = record(raw);
      if (!row) invalidPricingResponse();
      const summary = parseVersionSummary(row);
      return {
        ...summary,
        supersededByVersionId:
          typeof row.supersededByVersionId === "string" ? row.supersededByVersionId : null,
        checksum: typeof row.checksum === "string" ? row.checksum : "",
        createdByUserId:
          typeof row.createdByUserId === "string" && ANY_UUID_PATTERN.test(row.createdByUserId)
            ? row.createdByUserId
            : null,
        createdByDisplayName:
          typeof row.createdByDisplayName === "string" ? row.createdByDisplayName : null,
        createdByEmail: typeof row.createdByEmail === "string" ? row.createdByEmail : null,
        createdAt: isTimestamp(row.createdAt) ? row.createdAt : null,
        updatedAt: isTimestamp(row.updatedAt) ? row.updatedAt : null,
        entryCount: typeof row.entryCount === "number" ? row.entryCount : 0,
        promotionCount: typeof row.promotionCount === "number" ? row.promotionCount : 0,
        latestTestPassed: typeof row.latestTestPassed === "boolean" ? row.latestTestPassed : null,
        latestTestedAt: isTimestamp(row.latestTestedAt) ? row.latestTestedAt : null,
        notes: typeof row.notes === "string" ? row.notes : null,
        clonedFromVersionId:
          typeof row.clonedFromVersionId === "string" ? row.clonedFromVersionId : null,
        sourceMode: typeof row.sourceMode === "string" ? row.sourceMode : null,
      };
    }),
    linkedAccounts: Array.isArray(body.linkedAccounts)
      ? body.linkedAccounts.flatMap((raw) => {
          const acc = record(raw);
          if (!acc || typeof acc.id !== "string" || typeof acc.displayName !== "string") return [];
          return [
            {
              id: acc.id,
              partyId: typeof acc.partyId === "string" ? acc.partyId : "",
              displayName: acc.displayName,
              partyType: typeof acc.partyType === "string" ? acc.partyType : "",
              accountRole: typeof acc.accountRole === "string" ? acc.accountRole : "",
              status: typeof acc.status === "string" ? acc.status : "ACTIVE",
              creditLimit: typeof acc.creditLimit === "string" ? acc.creditLimit : null,
              creditCurrencyCode:
                typeof acc.creditCurrencyCode === "string" ? acc.creditCurrencyCode : null,
            },
          ];
        })
      : [],
    activeLocksCount: typeof body.activeLocksCount === "number" ? body.activeLocksCount : 0,
    auditTrail: Array.isArray(body.auditTrail) ? body.auditTrail.map(parseAuditEvent) : [],
  };
}

export function parsePriceBookVersionTestReport(payload: unknown): PriceBookVersionTestReport {
  const row = record(payload);
  if (
    !row ||
    typeof row.passed !== "boolean" ||
    !isBoundedInteger(row.entryCount, 0, Number.MAX_SAFE_INTEGER) ||
    !isBoundedInteger(row.promotionCount, 0, Number.MAX_SAFE_INTEGER) ||
    !Array.isArray(row.conflicts) ||
    !Array.isArray(row.promotionConflicts)
  ) {
    invalidPricingResponse();
  }
  const parseConflict = (value: unknown): string => {
    if (typeof value !== "string" || value.length === 0) invalidPricingResponse();
    return value;
  };
  return {
    passed: row.passed,
    entryCount: row.entryCount,
    promotionCount: row.promotionCount,
    conflicts: row.conflicts.map(parseConflict),
    promotionConflicts: row.promotionConflicts.map(parseConflict),
  };
}

export function parsePriceBookVersionDetail(payload: unknown): PriceBookVersionDetail {
  const body = record(payload);
  const book = body ? record(body.book) : null;
  const version = body ? record(body.version) : null;
  if (
    !body ||
    !book ||
    !version ||
    !isUuidV7(book.id) ||
    !isNonEmptyString(book.code, PRICE_BOOK_CODE_MAX_LENGTH) ||
    !isNonEmptyString(book.currencyCode, 3) ||
    !isNonEmptyString(version.checksum, 128) ||
    !Array.isArray(body.entries) ||
    !Array.isArray(body.promotions)
  ) {
    invalidPricingResponse();
  }
  const evidence = record(body.latestTestEvidence);
  let parsedEvidenceReport: PriceBookVersionTestReport | null = null;
  if (evidence && record(evidence.report)) {
    try {
      parsedEvidenceReport = parsePriceBookVersionTestReport(evidence.report);
    } catch {
      parsedEvidenceReport = null;
    }
  }
  return {
    ...(typeof body.canViewCost === "boolean" ? { canViewCost: body.canViewCost } : {}),
    ...(typeof body.soloOwnerGovernanceEligible === "boolean"
      ? { soloOwnerGovernanceEligible: body.soloOwnerGovernanceEligible }
      : {}),
    book: {
      id: book.id,
      code: book.code,
      purpose: typeof book.purpose === "string" ? book.purpose : "",
      currencyCode: book.currencyCode,
      status: typeof book.status === "string" ? book.status : "",
      version: isBoundedInteger(book.version, 0, Number.MAX_SAFE_INTEGER) ? book.version : 0,
      ...(typeof book.name === "string" || book.name === null ? { name: book.name } : {}),
      ...(book.localizedNames ? { localizedNames: parseLocalizedNames(book.localizedNames) } : {}),
      ...(typeof book.description === "string" || book.description === null
        ? { description: book.description }
        : {}),
      ...(Array.isArray(book.versions)
        ? { versions: book.versions.map(parseVersionSummary) }
        : {}),
    },
    version: {
      ...parseVersionSummary(version),
      ...(typeof version.supersededByVersionId === "string" ||
      version.supersededByVersionId === null
        ? { supersededByVersionId: version.supersededByVersionId }
        : {}),
      checksum: version.checksum,
      createdByUserId:
        typeof version.createdByUserId === "string" && ANY_UUID_PATTERN.test(version.createdByUserId)
          ? version.createdByUserId
          : null,
      ...(typeof version.createdByDisplayName === "string" || version.createdByDisplayName === null
        ? { createdByDisplayName: version.createdByDisplayName }
        : {}),
      ...(typeof version.createdByEmail === "string" || version.createdByEmail === null
        ? { createdByEmail: version.createdByEmail }
        : {}),
      ...(typeof version.notes === "string" || version.notes === null
        ? { notes: version.notes }
        : {}),
      ...(typeof version.clonedFromVersionId === "string" || version.clonedFromVersionId === null
        ? { clonedFromVersionId: version.clonedFromVersionId }
        : {}),
      ...(typeof version.sourceMode === "string" || version.sourceMode === null
        ? { sourceMode: version.sourceMode }
        : {}),
    },
    entries: body.entries.map(parsePriceEntry),
    promotions: body.promotions.map(parsePromotionRow),
    latestTestEvidence:
      evidence && typeof evidence.passed === "boolean" && isTimestamp(evidence.testedAt)
        ? {
            ...(typeof evidence.id === "string" ? { id: evidence.id } : {}),
            ...(typeof evidence.aggregateVersion === "number"
              ? { aggregateVersion: evidence.aggregateVersion }
              : {}),
            ...(typeof evidence.contentHash === "string"
              ? { contentHash: evidence.contentHash }
              : {}),
            passed: evidence.passed,
            testedAt: evidence.testedAt,
            ...(parsedEvidenceReport ? { report: parsedEvidenceReport } : {}),
          }
        : null,
    ...(Array.isArray(body.auditTrail)
      ? { auditTrail: body.auditTrail.map(parseAuditEvent) }
      : {}),
  };
}

function parsePriceEntry(payload: unknown): PriceEntry {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isUuidV7(row.itemId) ||
    !isUuidV7(row.uomId) ||
    !isNonEmptyString(row.currencyCode, 3) ||
    !isDecimalString(row.minimumQuantity) ||
    !isDecimalString(row.unitPrice) ||
    !isNullableDecimalString(row.maximumQuantity ?? null) ||
    !isNullableDecimalString(row.minimumAllowedPrice ?? null) ||
    !isBoundedInteger(row.priority, 0, 10_000)
  ) {
    invalidPricingResponse();
  }
  return {
    id: row.id,
    itemId: row.itemId,
    ...(typeof row.itemCode === "string" || row.itemCode === null ? { itemCode: row.itemCode } : {}),
    ...(row.itemLocalizedNames
      ? { itemLocalizedNames: parseStringRecord(row.itemLocalizedNames) }
      : {}),
    ...(typeof row.catalogSalesPrice === "string" || row.catalogSalesPrice === null
      ? { catalogSalesPrice: row.catalogSalesPrice }
      : {}),
    ...(typeof row.standardCost === "string" || row.standardCost === null
      ? { standardCost: row.standardCost }
      : {}),
    uomId: row.uomId,
    ...(typeof row.uomCode === "string" || row.uomCode === null ? { uomCode: row.uomCode } : {}),
    ...(typeof row.uomDisplayName === "string" || row.uomDisplayName === null
      ? { uomDisplayName: row.uomDisplayName }
      : {}),
    ...(row.uomLocalizedNames
      ? { uomLocalizedNames: parseStringRecord(row.uomLocalizedNames) }
      : {}),
    currencyCode: row.currencyCode,
    minimumQuantity: row.minimumQuantity,
    maximumQuantity: (row.maximumQuantity as string | null | undefined) ?? null,
    unitPrice: row.unitPrice,
    minimumAllowedPrice: (row.minimumAllowedPrice as string | null | undefined) ?? null,
    priority: row.priority,
  };
}

function parsePromotionRow(payload: unknown): PromotionRow {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.code, PRICE_BOOK_CODE_MAX_LENGTH) ||
    !isNonEmptyString(row.name, 160) ||
    !isBoundedInteger(row.versionNumber, 0, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(row.status, 32) ||
    !isBoundedInteger(row.priority, 0, 10_000) ||
    typeof row.exclusive !== "boolean"
  ) {
    invalidPricingResponse();
  }
  const benefitObj = record(row.benefit);
  const benefitType =
    typeof row.benefitType === "string"
      ? row.benefitType
      : typeof benefitObj?.benefitType === "string"
        ? benefitObj.benefitType
        : typeof benefitObj?.type === "string"
          ? benefitObj.type
          : undefined;
  const discountValue =
    typeof row.discountValue === "string"
      ? row.discountValue
      : typeof benefitObj?.discountValue === "string"
        ? benefitObj.discountValue
        : typeof benefitObj?.value === "string"
          ? benefitObj.value
          : undefined;

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    versionNumber: row.versionNumber,
    status: row.status,
    priority: row.priority,
    stackGroup: typeof row.stackGroup === "string" ? row.stackGroup : "DEFAULT",
    exclusive: row.exclusive,
    ...(benefitType ? { benefitType } : {}),
    ...(discountValue ? { discountValue } : {}),
    ...(record(row.selector) ? { selector: record(row.selector) ?? undefined } : {}),
    ...(benefitObj ? { benefit: benefitObj } : {}),
    ...(typeof row.itemCode === "string" || row.itemCode === null ? { itemCode: row.itemCode } : {}),
    ...(typeof row.uomCode === "string" || row.uomCode === null ? { uomCode: row.uomCode } : {}),
  };
}

export function parsePriceBookVersionDiff(payload: unknown): PriceBookVersionDiff {
  const body = record(payload);
  const target = body ? record(body.targetVersion) : null;
  const baseline = body ? record(body.baselineVersion) : null;
  const summary = body ? record(body.summary) : null;
  if (
    !body ||
    !target ||
    !baseline ||
    !summary ||
    typeof body.currencyCode !== "string" ||
    !Array.isArray(body.entries) ||
    !Array.isArray(body.promotions)
  ) {
    invalidPricingResponse();
  }
  return {
    currencyCode: body.currencyCode,
    targetVersion: {
      id: String(target.id ?? ""),
      priceBookId: String(target.priceBookId ?? ""),
      priceBookCode: String(target.priceBookCode ?? ""),
      versionNumber: Number(target.versionNumber ?? 1),
      status: String(target.status ?? "DRAFT"),
    },
    baselineVersion: {
      id: String(baseline.id ?? ""),
      priceBookId: String(baseline.priceBookId ?? ""),
      priceBookCode: String(baseline.priceBookCode ?? ""),
      versionNumber: Number(baseline.versionNumber ?? 1),
      status: String(baseline.status ?? "DRAFT"),
    },
    summary: {
      totalCompared: Number(summary.totalCompared ?? 0),
      added: Number(summary.added ?? 0),
      removed: Number(summary.removed ?? 0),
      increased: Number(summary.increased ?? 0),
      decreased: Number(summary.decreased ?? 0),
      unchanged: Number(summary.unchanged ?? 0),
      promotionsChanged: Number(summary.promotionsChanged ?? 0),
    },
    entries: body.entries.flatMap((raw) => {
      const row = record(raw);
      if (!row || typeof row.changeType !== "string") return [];
      return [
        {
          changeType: row.changeType as PriceEntryDiffRow["changeType"],
          itemId: String(row.itemId ?? ""),
          itemCode: String(row.itemCode ?? ""),
          itemLocalizedNames: parseStringRecord(row.itemLocalizedNames),
          uomId: String(row.uomId ?? ""),
          uomCode: String(row.uomCode ?? ""),
          minimumQuantity: String(row.minimumQuantity ?? "0"),
          maximumQuantity: typeof row.maximumQuantity === "string" ? row.maximumQuantity : null,
          priority: Number(row.priority ?? 100),
          baselineUnitPrice:
            typeof row.baselineUnitPrice === "string" ? row.baselineUnitPrice : null,
          targetUnitPrice: typeof row.targetUnitPrice === "string" ? row.targetUnitPrice : null,
          deltaAmount: String(row.deltaAmount ?? "0"),
          deltaPct: typeof row.deltaPct === "number" ? row.deltaPct : null,
        },
      ];
    }),
    promotions: body.promotions.flatMap((raw) => {
      const row = record(raw);
      if (!row || typeof row.code !== "string") return [];
      return [
        {
          changeType: (row.changeType as PromotionDiffRow["changeType"]) ?? "UNCHANGED",
          code: row.code,
          name: String(row.name ?? row.code),
          baselineBenefit: record(row.baselineBenefit),
          targetBenefit: record(row.targetBenefit),
        },
      ];
    }),
  };
}

export function parsePricingReferenceData(payload: unknown): PricingReferenceData {
  const body = record(payload);
  if (!body || !Array.isArray(body.items) || !Array.isArray(body.uoms)) {
    invalidPricingResponse();
  }
  return {
    canViewCost: Boolean(body.canViewCost),
    items: body.items.flatMap((raw) => {
      const row = record(raw);
      if (!row || typeof row.itemId !== "string" || typeof row.canonicalCode !== "string") return [];
      return [
        {
          itemId: row.itemId,
          canonicalCode: row.canonicalCode,
          itemKind: typeof row.itemKind === "string" ? row.itemKind : "PRODUCT",
          localizedNames: parseStringRecord(row.localizedNames),
          baseUomId: typeof row.baseUomId === "string" ? row.baseUomId : "",
          defaultSalesUomId:
            typeof row.defaultSalesUomId === "string" ? row.defaultSalesUomId : null,
          defaultPurchaseUomId:
            typeof row.defaultPurchaseUomId === "string" ? row.defaultPurchaseUomId : null,
          canSell: Boolean(row.canSell),
          canPurchase: Boolean(row.canPurchase),
          salesPrice: typeof row.salesPrice === "string" ? row.salesPrice : null,
          standardCost: typeof row.standardCost === "string" ? row.standardCost : null,
          currencyCode: typeof row.currencyCode === "string" ? row.currencyCode : null,
        },
      ];
    }),
    uoms: body.uoms.flatMap((raw) => {
      const row = record(raw);
      if (!row || typeof row.id !== "string" || typeof row.code !== "string") return [];
      return [
        {
          id: row.id,
          code: row.code,
          displayName: typeof row.displayName === "string" ? row.displayName : row.code,
          localizedNames: parseStringRecord(row.localizedNames),
        },
      ];
    }),
    branches: Array.isArray(body.branches)
      ? body.branches.flatMap((raw) => {
          const row = record(raw);
          if (!row || typeof row.id !== "string") return [];
          return [
            {
              id: row.id,
              code: String(row.code ?? ""),
              name: String(row.name ?? row.code ?? ""),
              isHeadquarters: Boolean(row.isHeadquarters),
            },
          ];
        })
      : [],
    channels: Array.isArray(body.channels)
      ? body.channels.flatMap((raw) => {
          const row = record(raw);
          if (!row || typeof row.id !== "string") return [];
          return [
            {
              id: row.id,
              code: String(row.code ?? ""),
              name: String(row.name ?? row.code ?? ""),
              channelType: String(row.channelType ?? ""),
            },
          ];
        })
      : [],
    commercialAccounts: Array.isArray(body.commercialAccounts)
      ? body.commercialAccounts.flatMap((raw) => {
          const row = record(raw);
          if (!row || typeof row.id !== "string" || typeof row.partyId !== "string") return [];
          return [
            {
              id: row.id,
              partyId: row.partyId,
              displayName: String(row.displayName ?? ""),
              partyType: String(row.partyType ?? ""),
              accountRole: String(row.accountRole ?? ""),
              priceBookId: typeof row.priceBookId === "string" ? row.priceBookId : null,
              status: String(row.status ?? "ACTIVE"),
            },
          ];
        })
      : [],
    currencies: Array.isArray(body.currencies)
      ? body.currencies.flatMap((raw) => {
          const row = record(raw);
          if (!row || typeof row.code !== "string") return [];
          return [
            {
              code: row.code,
              name: String(row.name ?? row.code),
              symbol: typeof row.symbol === "string" ? row.symbol : null,
              decimalPlaces: typeof row.decimalPlaces === "number" ? row.decimalPlaces : 2,
              isDefault: Boolean(row.isDefault),
            },
          ];
        })
      : [],
  };
}

export function parsePricingDecision(payload: unknown): PricingDecisionResult {
  const row = record(payload);
  if (
    !row ||
    !isNonEmptyString(row.outcome, 32) ||
    !isDecimalString(row.unitPrice) ||
    !isDecimalString(row.baselineUnitPrice) ||
    !isNonEmptyString(row.currencyCode, 3) ||
    !isUuidV7(row.priceBookId) ||
    !isUuidV7(row.priceBookVersionId) ||
    !isUuidV7(row.decisionId) ||
    !isNullableDecimalString(row.minimumAllowedPrice ?? null)
  ) {
    invalidPricingResponse();
  }
  const components = Array.isArray(row.components)
    ? row.components.flatMap((entry) => {
        const comp = record(entry);
        return comp &&
          typeof comp.type === "string" &&
          typeof comp.code === "string" &&
          typeof comp.amount === "string"
          ? [{ type: comp.type, code: comp.code, amount: comp.amount }]
          : [];
      })
    : undefined;

  const rejectedPromotions = Array.isArray(row.rejectedPromotions)
    ? row.rejectedPromotions.flatMap((entry) => {
        const rej = record(entry);
        return rej && typeof rej.code === "string" && typeof rej.reason === "string"
          ? [
              {
                ...(typeof rej.promotionId === "string" ? { promotionId: rej.promotionId } : {}),
                code: rej.code,
                reason: rej.reason,
              },
            ]
          : [];
      })
    : undefined;

  const rejectedCandidates = Array.isArray(row.rejectedCandidates)
    ? row.rejectedCandidates.flatMap((entry) => {
        const cand = record(entry);
        return cand && typeof cand.entryId === "string" && typeof cand.reason === "string"
          ? [{ entryId: cand.entryId, reason: cand.reason }]
          : [];
      })
    : undefined;

  return {
    outcome: row.outcome,
    ...(typeof row.decisionType === "string" ? { decisionType: row.decisionType } : {}),
    unitPrice: row.unitPrice,
    baselineUnitPrice: row.baselineUnitPrice,
    currencyCode: row.currencyCode,
    priceBookId: row.priceBookId,
    priceBookVersionId: row.priceBookVersionId,
    ...(isBoundedInteger(row.priceBookVersion, 0, Number.MAX_SAFE_INTEGER)
      ? { priceBookVersion: row.priceBookVersion }
      : {}),
    ...(typeof row.checksum === "string" ? { checksum: row.checksum } : {}),
    ...(typeof row.matchedEntryId === "string" ? { matchedEntryId: row.matchedEntryId } : {}),
    minimumAllowedPrice: (row.minimumAllowedPrice as string | null | undefined) ?? null,
    decisionId: row.decisionId,
    matchedPromotions: Array.isArray(row.matchedPromotions)
      ? row.matchedPromotions.flatMap((entry) => {
          const promotion = record(entry);
          return promotion &&
            typeof promotion.code === "string" &&
            isDecimalString(promotion.discountAmount)
            ? [
                {
                  ...(typeof promotion.promotionId === "string"
                    ? { promotionId: promotion.promotionId }
                    : {}),
                  code: promotion.code,
                  ...(typeof promotion.name === "string" ? { name: promotion.name } : {}),
                  ...(typeof promotion.benefitType === "string"
                    ? { benefitType: promotion.benefitType }
                    : {}),
                  ...(typeof promotion.discountValue === "string"
                    ? { discountValue: promotion.discountValue }
                    : {}),
                  discountAmount: promotion.discountAmount,
                  ...(typeof promotion.priority === "number"
                    ? { priority: promotion.priority }
                    : {}),
                  ...(typeof promotion.stackGroup === "string"
                    ? { stackGroup: promotion.stackGroup }
                    : {}),
                  ...(typeof promotion.exclusive === "boolean"
                    ? { exclusive: promotion.exclusive }
                    : {}),
                },
              ]
            : [];
        })
      : [],
    ...(components ? { components } : {}),
    ...(rejectedPromotions ? { rejectedPromotions } : {}),
    ...(rejectedCandidates ? { rejectedCandidates } : {}),
    ...(typeof row.inputFingerprint === "string" ? { inputFingerprint: row.inputFingerprint } : {}),
    ...(typeof row.evaluatedAt === "string" ? { evaluatedAt: row.evaluatedAt } : {}),
    ...(typeof row.taxFinal === "boolean" ? { taxFinal: row.taxFinal } : {}),
  };
}

export function isPriceBookPurpose(value: unknown): value is PriceBookPurpose {
  return isMemberOf(value, PRICE_BOOK_PURPOSES);
}

export function recordFromCreatedBook(payload: unknown): { id: string; version: number } {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const row = payload as Record<string, unknown>;
    return {
      id: typeof row.id === "string" ? row.id : "",
      version: typeof row.version === "number" ? row.version : 1,
    };
  }
  return { id: "", version: 1 };
}

function invalidPricingResponse(): never {
  throw new Error("Invalid Trade pricing response.");
}

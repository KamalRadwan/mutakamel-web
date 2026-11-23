import type { TradeContext } from '../shared/trade-api';
import type {
  CommercialAccountRole,
  CommercialAccountStatus,
  LocalizedNames,
  Page,
} from '../shared/trade-foundation.model';

export interface PricingWriteOptions {
  idempotencyKey?: string;
  ifMatch?: number;
  ctx?: TradeContext;
}

// Shapes follow the trade-app pricing module code: pricing.service.ts,
// pricing-read-projection.service.ts and dto/pricing.dto.ts.

export type PricePurpose = 'SALES' | 'PURCHASE';
export type PriceBookStatus = 'ACTIVE' | 'INACTIVE';
export type PriceVersionStatus = 'DRAFT' | 'TESTED' | 'SCHEDULED' | 'PUBLISHED' | 'RETIRED';
/** PriceBookGovernanceFilter: a list filter only; list rows carry no state (see bookGovernanceState). */
export type GovernanceState = 'PUBLISHED' | 'SCHEDULED' | 'TESTED' | 'DRAFT_ONLY' | 'INACTIVE';
/** MANUAL is stamped by POST .../versions; the others come from POST .../versions/clone. */
export type SourceMode = 'MANUAL' | 'CLONE_VERSION' | 'SEED_FROM_CATALOG' | 'EMPTY_DRAFT';
export type CloneSourceMode = Exclude<SourceMode, 'MANUAL'>;
export type AdjustmentMode = 'NONE' | 'PERCENTAGE' | 'FIXED_DELTA';
export type RoundingMode = 'NONE' | 'NEAREST_1' | 'NEAREST_0_50' | 'END_95';
export type BenefitType = 'PERCENTAGE' | 'FIXED_AMOUNT';
/** A promotion version follows its price version lifecycle (syncPromotionVersionLifecycle). */
export type PromotionStatus = PriceVersionStatus;
export type PromotionRejectReason =
  | 'EXCLUSIVE_PROMOTION_APPLIED'
  | 'SELECTOR_MISMATCH'
  | 'ACCOUNT_REQUIRED'
  | 'STACK_GROUP_LOWER_PRECEDENCE'
  | 'MINIMUM_PRICE_GUARD';
export type PriceBookSource = 'EXPLICIT' | 'ACCOUNT' | 'COMPANY_DEFAULT';

/** Error codes the pricing module throws. */
export type PricingErrorCode =
  | 'TRADE.PRICE.BOOK_NOT_FOUND'
  | 'TRADE.PRICE.BOOK_ALREADY_EXISTS'
  | 'TRADE.PRICE.BOOK_INVALID'
  | 'TRADE.PRICE.BOOK_IN_USE'
  | 'TRADE.PRICE.ENTRY_INVALID'
  | 'TRADE.PRICE.RULE_INVALID'
  | 'TRADE.PRICE.TIER_OVERLAP'
  | 'TRADE.PRICE.VERSION_OVERLAP'
  | 'TRADE.PRICE.NO_ELIGIBLE_PRICE'
  | 'TRADE.PRICE.AMBIGUOUS_RULES'
  | 'TRADE.PRICE.TEST_NOT_ALLOWED'
  | 'TRADE.PRICE.TEST_FAILED'
  | 'TRADE.PRICE.PUBLISH_NOT_ALLOWED'
  | 'TRADE.APPROVAL.MAKER_CHECKER_REQUIRED'
  | 'TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_NOT_FOUND'
  | 'TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_INCOMPATIBLE'
  | 'TRADE.CONCURRENCY.STALE_VERSION'
  | 'TRADE.CATALOG.UOM_INVALID'
  | 'TRADE.AUTH.TARGET_DENIED';

/** `details.reason[0]` values the pricing module sends. */
export type PricingErrorReason =
  | 'not_editable'
  | 'not_tested'
  | 'not_live'
  | 'retroactive_supersession'
  | 'predecessor_invalid'
  | 'mapped_as_company_default'
  | 'operations_required'
  | 'operation_limit_exceeded'
  | 'duplicate_operation'
  | 'entry_not_in_version'
  | 'row_limit_exceeded'
  | 'equal_precedence'
  | 'version_not_in_book'
  | 'preview_status_invalid';

export interface VersionHead {
  id: string;
  versionNumber: number;
  status: PriceVersionStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  supersededAt: string | null;
  version: number;
}

/** GET /price-books: the latest five versions also carry their maker. */
export interface BookListVersionHead extends VersionHead {
  createdByUserId: string | null;
}

/** Book header returned by PATCH /price-books/:id and inside GET /price-books/:id. */
export interface PriceBookHeader {
  id: string;
  companyId: string;
  code: string;
  purpose: PricePurpose;
  currencyCode: string;
  status: PriceBookStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  name: string | null;
  localizedNames: LocalizedNames;
  description: string | null;
}

export interface PriceBookListItem extends PriceBookHeader {
  versionCount: number;
  versions: BookListVersionHead[];
  isCompanyDefault: boolean;
  linkedAccountsCount: number;
  entryCount: number;
  promotionCount: number;
}

export interface PriceBookDetailBook extends PriceBookHeader {
  isCompanyDefault: boolean;
}

/** POST /price-books returns the saved row; name fields only when metadata was sent. */
export interface CreatedPriceBook {
  id: string;
  companyId: string;
  code: string;
  purpose: PricePurpose;
  currencyCode: string;
  status: PriceBookStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  name?: string | null;
  localizedNames?: LocalizedNames;
  description?: string | null;
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

export interface VersionSummary extends VersionHead {
  supersededByVersionId: string | null;
  checksum: string;
  createdByUserId: string | null;
  createdByDisplayName: string | null;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
  entryCount: number;
  promotionCount: number;
  latestTestPassed: boolean | null;
  latestTestedAt: string | null;
  notes: string | null;
  clonedFromVersionId: string | null;
  sourceMode: SourceMode;
}

/** The trade_price_book_versions row (publish, retire). */
export interface PriceVersionRow extends VersionHead {
  priceBookId: string;
  supersededByVersionId: string | null;
  checksum: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** POST .../versions and .../versions/clone, PATCH /price-book-versions/:id. */
export interface SavedPriceVersion extends PriceVersionRow {
  entryCount: number;
  promotionCount: number;
  notes?: string | null;
  clonedFromVersionId?: string | null;
  sourceMode?: CloneSourceMode;
}

export interface CompanyDefaultMapping {
  id: string;
  purpose: PricePurpose;
  currencyCode: string;
  priceBookId: string;
  version: number;
  isThisBook: boolean;
}

export interface LinkedAccount {
  id: string;
  partyId: string;
  partyName: string;
  partyType: 'INDIVIDUAL' | 'ORGANIZATION';
  accountRole: CommercialAccountRole;
  status: CommercialAccountStatus;
  creditLimit: string | null;
  creditCurrencyCode: string | null;
}

export interface GovernanceAuditEntry {
  id: string;
  resourceType: string;
  resourceId: string;
  action: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  reason: string | null;
  reasonCode?: string | null;
  reasonNameEn?: string | null;
  reasonNameAr?: string | null;
  occurredAt: string;
}

export interface PriceBookDossier {
  book: PriceBookDetailBook;
  companyDefaultMapping: CompanyDefaultMapping | null;
  versions: VersionSummary[];
  linkedAccounts: LinkedAccount[];
  activeLocksCount: number;
  auditTrail: GovernanceAuditEntry[];
}

export interface PriceEntry {
  id: string;
  version: number;
  itemCompanyProfileId: string;
  itemId: string;
  itemCode: string;
  itemLocalizedNames: LocalizedNames;
  uomId: string;
  uomCode: string;
  uomDisplayName: string | null;
  uomLocalizedNames: LocalizedNames;
  currencyCode: string;
  minimumQuantity: string;
  maximumQuantity: string | null;
  unitPrice: string;
  minimumAllowedPrice: string | null;
  priority: number;
  standardCost: string | null;
  catalogSalesPrice: string | null;
}

/** GET /price-book-versions/:id?include=entries row: joined item/UoM labels may be null (P-1). */
export interface PriceVersionDetailEntry
  extends Omit<
    PriceEntry,
    'itemCode' | 'itemLocalizedNames' | 'uomCode' | 'uomLocalizedNames'
  > {
  itemCode: string | null;
  itemLocalizedNames: LocalizedNames | null;
  uomCode: string | null;
  uomLocalizedNames: LocalizedNames | null;
}

/** Stored selector (promotionSelector): only the keys that were sent. */
export interface PromotionSelector {
  itemId?: string;
  uomId?: string;
  branchId?: string;
  channelId?: string;
  partyId?: string;
  minimumQuantity: string;
  maximumQuantity: string | null;
}

export interface PromotionBenefit {
  type: BenefitType;
  value: string;
}

export interface PromotionRule {
  id: string;
  version: number;
  promotionDefinitionId: string;
  code: string;
  name: string;
  versionNumber: number;
  status: PromotionStatus;
  selector: PromotionSelector;
  itemCode: string | null;
  uomCode: string | null;
  benefit: PromotionBenefit;
  priority: number;
  stackGroup: string;
  exclusive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  contentHash: string;
}

/** The stored test report (trade_governed_test_evidence.report). */
export interface PriceTestReport {
  passed: boolean;
  entryCount: number;
  promotionCount: number;
  conflicts: string[];
  promotionConflicts: string[];
}

/** POST /price-book-versions/:id/test */
export interface PriceTestResult extends PriceTestReport {
  evidenceId: string;
  checksum: string;
  version: number;
}

export interface PriceTestEvidence {
  id: string;
  aggregateVersion: number;
  contentHash: string;
  passed: boolean;
  report: PriceTestReport;
  testedAt: string;
}

export interface PriceVersionBookRef {
  id: string;
  code: string;
  purpose: PricePurpose;
  currencyCode: string;
  status: PriceBookStatus;
  version: number;
  name: string | null;
  localizedNames: LocalizedNames;
  description: string | null;
  versions: VersionHead[];
}

export interface PriceVersionDetailHead extends VersionHead {
  supersededByVersionId: string | null;
  checksum: string;
  createdByUserId: string | null;
  createdByDisplayName: string | null;
  createdByEmail: string | null;
  notes: string | null;
  clonedFromVersionId: string | null;
  sourceMode: SourceMode;
}

/** GET /price-book-versions/:id?include=entries (the default). If-Match is version.version. */
export interface PriceVersionDetail {
  canViewCost: boolean;
  entryCount: number;
  soloOwnerGovernanceEligible: boolean;
  book: PriceVersionBookRef;
  version: PriceVersionDetailHead;
  entries: PriceVersionDetailEntry[];
  promotions: PromotionRule[];
  latestTestEvidence: PriceTestEvidence | null;
  auditTrail: GovernanceAuditEntry[];
}

/** GET /price-book-versions/:id?include=none: no entries, the head moves to versionHead. */
export interface PriceVersionHeadDetail extends Omit<PriceVersionDetail, 'version' | 'entries'> {
  versionHead: PriceVersionDetailHead;
  version: number;
}

export type PriceDiffEntryChange = 'ADDED' | 'REMOVED' | 'INCREASED' | 'DECREASED' | 'UNCHANGED';
export type PriceDiffPromotionChange = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';

export interface PriceDiffEntry {
  changeType: PriceDiffEntryChange;
  itemId: string;
  itemCode: string;
  itemLocalizedNames: LocalizedNames;
  uomId: string;
  uomCode: string;
  minimumQuantity: string;
  maximumQuantity: string | null;
  priority: number;
  baselineUnitPrice: string | null;
  targetUnitPrice: string | null;
  deltaAmount: string | null;
  deltaPct: number | null;
}

export interface PriceDiffPromotion {
  changeType: PriceDiffPromotionChange;
  code: string;
  name: string;
  baselineBenefit: PromotionBenefit | null;
  targetBenefit: PromotionBenefit | null;
}

export interface PriceDiffSummary {
  totalCompared: number;
  added: number;
  removed: number;
  increased: number;
  decreased: number;
  unchanged: number;
  promotionsChanged: number;
}

export interface PriceDiffVersionRef {
  id: string;
  priceBookId: string;
  priceBookCode: string;
  versionNumber: number;
  status: PriceVersionStatus;
}

/** GET /price-book-versions/:id/diff/:compareVersionId (`id` is the target, the other the baseline). */
export interface PriceDiff {
  currencyCode: string;
  targetVersion: PriceDiffVersionRef;
  baselineVersion: PriceDiffVersionRef;
  summary: PriceDiffSummary;
  entries: PriceDiffEntry[];
  promotions: PriceDiffPromotion[];
}

export interface CompanyDefault {
  id: string;
  companyId: string;
  purpose: PricePurpose;
  currencyCode: string;
  priceBookId: string;
  version: number;
  updatedAt: string;
  priceBook: {
    id: string;
    code: string;
    purpose: PricePurpose;
    currencyCode: string;
    status: PriceBookStatus;
    version: number;
    name: string | null;
    localizedNames: LocalizedNames;
    description: string | null;
  };
}

/** The trade_company_default_price_books row returned by POST .../upsert. */
export interface CompanyDefaultRow {
  id: string;
  companyId: string;
  purpose: PricePurpose;
  currencyCode: string;
  priceBookId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDefaultList {
  items: CompanyDefault[];
}

export interface DeletedResult {
  id: string;
  deleted: true;
}

export interface ReferenceItem {
  itemId: string;
  canonicalCode: string;
  itemKind: string;
  localizedNames: LocalizedNames;
  baseUomId: string;
  defaultSalesUomId: string | null;
  defaultPurchaseUomId: string | null;
  canSell: boolean;
  canPurchase: boolean;
  salesPrice: string | null;
  standardCost: string | null;
  currencyCode: string | null;
}

export interface ReferenceUom {
  id: string;
  code: string;
  displayName: string | null;
  localizedNames: LocalizedNames;
}

export interface ReferenceChannel {
  id: string;
  code: string;
  name: string;
  channelType: string;
}

export interface ReferenceCommercialAccount {
  id: string;
  partyId: string;
  displayName: string;
  partyType: 'INDIVIDUAL' | 'ORGANIZATION';
  accountRole: CommercialAccountRole;
  priceBookId: string | null;
  status: CommercialAccountStatus;
}

export interface ReferenceBranch {
  id: string;
  code: string;
  name?: string;
  nameEn: string;
  nameAr: string;
  companyId: string;
  isHeadquarters?: boolean;
}

export interface ReferenceCurrency {
  code: string;
  name?: string;
  nameEn: string;
  nameAr: string;
  symbol?: string | null;
  decimalPlaces: number;
  isDefault?: boolean;
}

export interface PricingReferenceData {
  canViewCost?: boolean;
  items?: ReferenceItem[];
  uoms?: ReferenceUom[];
  branches: ReferenceBranch[];
  channels?: ReferenceChannel[];
  commercialAccounts?: ReferenceCommercialAccount[];
  currencies: ReferenceCurrency[];
}

/** PricingEvaluateDto */
export interface PricingEvaluateInput {
  purpose: PricePurpose;
  itemId: string;
  uomId: string;
  quantity: string;
  currencyCode: string;
  pricingAt?: string;
  partyId?: string;
  branchId?: string;
  channelId?: string;
  priceBookId?: string;
  priceBookVersionId?: string;
}

/** `PRICING_ENGINE_VERSION` (trade-app pricing.service.ts). */
export const PRICING_ENGINE_VERSION = 'trade-pricing-engine.v1';
export type PricingEngineVersion = typeof PRICING_ENGINE_VERSION;

/** DecisionType.SALES_PRICE | DecisionType.PURCHASE_PRICE */
export type PricingDecisionType = 'SALES_PRICE' | 'PURCHASE_PRICE';

/** Statuses an explicit `priceBookVersionId` preview accepts. */
export type PreviewableVersionStatus = Exclude<PriceVersionStatus, 'RETIRED'>;

/** PricingDecision["matchedPromotions"][number]; money is a decimal string. */
export interface MatchedPromotion {
  promotionDefinitionId: string;
  promotionVersionId: string;
  code: string;
  discountAmount: string;
}

/** PricingDecision["rejectedPromotions"][number] */
export interface RejectedPromotion {
  promotionVersionId: string;
  code: string;
  reason: PromotionRejectReason;
}

export type PriceComponentKind = 'BASE_PRICE' | 'PROMOTION_DISCOUNT';

/** PricingDecision["components"][number]: referenceId is the entry id (BASE_PRICE) or promotion version id. */
export interface PriceComponent {
  kind: PriceComponentKind;
  referenceId: string;
  amount: string;
}

/** PricingDecision["rejectedCandidates"][number] */
export interface RejectedCandidate {
  entryId: string;
  reason: 'LOWER_PRECEDENCE';
}

/**
 * POST /api/tenant/trade/v1/pricing/evaluate response: `PricingDecision`
 * (trade-app pricing.service.ts). Money and quantities are decimal strings.
 * The evaluate endpoint always sets decisionId, priceBookSource and engineVersion;
 * previewOfStatus is present only for an explicit priceBookVersionId preview.
 */
export interface PricingDecision {
  priceBookSource?: PriceBookSource;
  engineVersion?: PricingEngineVersion;
  previewOfStatus?: PreviewableVersionStatus;
  decisionId?: string;
  decisionType: PricingDecisionType;
  outcome: 'ALLOW';
  unitPrice: string;
  currencyCode: string;
  priceBookId: string;
  priceBookVersionId: string;
  priceBookVersion: number;
  checksum: string;
  matchedEntryId: string;
  baselineUnitPrice: string;
  minimumAllowedPrice: string | null;
  matchedPromotions: MatchedPromotion[];
  rejectedPromotions: RejectedPromotion[];
  components: PriceComponent[];
  rejectedCandidates: RejectedCandidate[];
  inputFingerprint: string;
  evaluatedAt: string;
  taxFinal: false;
  promotionsApplied?: boolean;
}

/** Error codes POST /pricing/evaluate can return (besides TRADE.VALIDATION_FAILED and TRADE.AUTH.TARGET_DENIED). */
export type PricingEvaluateErrorCode =
  | 'TRADE.PRICE.ENTRY_INVALID'
  | 'TRADE.PRICE.BOOK_INVALID'
  | 'TRADE.PRICE.BOOK_NOT_FOUND'
  | 'TRADE.PRICE.NO_ELIGIBLE_PRICE'
  | 'TRADE.PRICE.AMBIGUOUS_RULES'
  | 'TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_NOT_FOUND'
  | 'TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_INCOMPATIBLE';

/** PriceBookListQueryDto */
export interface ListPriceBooksQuery {
  page?: number;
  limit?: number;
  purpose?: PricePurpose;
  status?: PriceBookStatus;
  currencyCode?: string;
  q?: string;
  governanceState?: GovernanceState;
}

/** PriceBookKpisQueryDto */
export interface PriceBookKpisQuery {
  purpose?: PricePurpose;
  status?: PriceBookStatus;
  currencyCode?: string;
  q?: string;
}

export type PriceEntrySortKey = 'itemCode' | 'priority' | 'unitPrice';

/** PriceEntriesQueryDto */
export interface ListEntriesQuery {
  page?: number;
  limit?: number;
  q?: string;
  uomId?: string;
  itemId?: string;
  sort?: PriceEntrySortKey;
  dir?: 'asc' | 'desc';
}

/** PriceVersionDetailQueryDto */
export interface GetPriceVersionOptions {
  include?: 'entries' | 'none';
}

export interface CreatePriceBookInput {
  code: string;
  purpose: PricePurpose;
  currencyCode: string;
  name?: string;
  localizedNames?: LocalizedNames;
  description?: string;
}

export interface UpdatePriceBookInput {
  name?: string;
  localizedNames?: LocalizedNames;
  description?: string | null;
  status?: PriceBookStatus;
}

/** PriceEntryDto (EntryChangeDto adds the optional id). */
export interface EntryInput {
  id?: string;
  itemId: string;
  uomId: string;
  currencyCode: string;
  minimumQuantity: string;
  maximumQuantity?: string | null;
  unitPrice: string;
  minimumAllowedPrice?: string | null;
  priority?: number;
}

/** P-5: createVersion / updateVersion strip id from entries. */
export type EntryCreateInput = Omit<EntryInput, 'id'>;

/** PromotionRuleDto (PromotionChangeDto adds the optional id): a flat body. */
export interface PromotionInput {
  id?: string;
  code: string;
  name: string;
  itemId?: string;
  uomId?: string;
  branchId?: string;
  channelId?: string;
  partyId?: string;
  minimumQuantity?: string;
  maximumQuantity?: string | null;
  benefitType: BenefitType;
  discountValue: string;
  priority?: number;
  stackGroup?: string;
  exclusive?: boolean;
}

/** P-5: createVersion / updateVersion strip id from promotions. */
export type PromotionCreateInput = Omit<PromotionInput, 'id'>;

/** CreatePriceBookVersionDto: POST /price-books/:id/versions. */
export interface CreateVersionInput {
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string;
  entries: EntryInput[];
  promotions?: PromotionInput[];
}

/** ClonePriceBookVersionDto: POST /price-books/:id/versions/clone. */
export interface CloneVersionInput {
  sourceMode: CloneSourceMode;
  sourceVersionId?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  notes?: string;
  includePromotions?: boolean;
  adjustmentMode?: AdjustmentMode;
  adjustmentValue?: string;
  roundingMode?: RoundingMode;
}

/** UpdatePriceBookVersionDto */
export interface UpdateVersionInput {
  effectiveFrom?: string;
  effectiveTo?: string | null;
  notes?: string | null;
  entries?: EntryInput[];
  promotions?: PromotionInput[];
}

/** PriceEntryChangesDto */
export interface ChangeEntriesInput {
  upserts?: EntryInput[];
  deletes?: string[];
}

/** PromotionChangesDto */
export interface ChangePromotionsInput {
  upserts?: PromotionInput[];
  deletes?: string[];
}

interface ChangeRowsResult {
  id: string;
  status: PriceVersionStatus;
  checksum: string;
  version: number;
  entryCount: number;
  promotionCount: number;
}

export interface ChangeEntriesResult extends ChangeRowsResult {
  changedEntryIds: string[];
}

export interface ChangePromotionsResult extends ChangeRowsResult {
  changedPromotionIds: string[];
}

/** PublishPriceBookVersionDto */
export interface PublishPriceVersionInput {
  supersedesVersionId?: string;
  soloOwnerAttestation?: boolean;
  approvalNotes?: string;
}

/** RetirePriceBookVersionDto */
export interface RetirePriceVersionInput {
  reasonCode: string;
  reasonNote?: string;
}

export type PriceBookPageResult = Page<PriceBookListItem>;
export type PriceEntryPageResult = Page<PriceEntry>;

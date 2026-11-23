import type { Reason } from '../settings/reasons/reasons.model';
import type { OpportunityStageFlag, StageCategory } from '../settings/opportunity-stages/opportunity-stages.model';
import type { PipelineReadView } from '../settings/pipelines/pipelines.model';
import { CARD_COLORS, type CardColor } from '../shared/record/fields/record-fields.model';
import type {
  CustomFieldDef,
  CustomFieldOption,
  CustomFieldType,
} from '../shared/record/custom-fields/custom-field.model';
import { formatMoneyNumber } from '../../../shared/ui/money/money-format';
import {
  initials,
  nameIn,
  type BranchOption,
  type CurrencyOption,
  type Named,
  type OwnerOption,
  type Page,
} from '../leads/leads.model';

export { CARD_COLORS, initials, nameIn };
export type {
  BranchOption,
  CardColor,
  CurrencyOption,
  CustomFieldDef,
  CustomFieldOption,
  CustomFieldType,
  Named,
  OpportunityStageFlag,
  OwnerOption,
  Page,
  Reason,
  StageCategory,
};

export type OpportunityCustomField = CustomFieldDef;

export type OpportunityView = 'board' | 'cards' | 'table';
export const OPPORTUNITY_VIEWS: readonly OpportunityView[] = ['board', 'cards', 'table'];
export type OpportunityStatus = 'IN_PROGRESS' | 'ON_HOLD' | 'WON' | 'LOST';
export type BoardStatusFilter = 'OPEN' | OpportunityStatus;
export type ClosingFilter = 'OVERDUE' | 'NEXT_7_DAYS' | 'NEXT_30_DAYS' | 'NO_DATE';
export type ActivityState = 'NO_OPEN' | 'OVERDUE' | 'TODAY' | 'FUTURE';
export type SearchField = 'opportunity' | 'customer' | 'email' | 'phone';
export type CustomerProfileType = 'INDIVIDUAL' | 'CORPORATE';

export interface PipelineStageView {
  id: string;
  pipelineId: string;
  opportunityStageId: string;
  rank: number;
  nameAr: string;
  nameEn: string;
  flag: OpportunityStageFlag;
  category: StageCategory;
  isActive: boolean;
  isSystem: boolean;
}

/** PipelineView from GET crm/pipelines and GET crm/pipelines/:id: the settings read shape (no `assignments`). */
export type PipelineView = PipelineReadView;

export interface OpportunityTag {
  id: string;
  name: string;
  backgroundColor: string | null;
  textColor: string | null;
}

/**
 * TagView from GET and POST crm/opportunities/:id/tags (tags.service.ts). Opportunity rows carry the
 * summary above without timestamps (lead-board-read-model.ts tag summary).
 */
export interface OpportunityTagView extends OpportunityTag {
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityContactSummary {
  partyId: string;
  displayName: string;
  jobTitle: string | null;
  isPrimary: boolean;
  email: string | null;
  phones: string[];
}

/** OpportunityCardRow: detail, list, search, create/patch/stage/transfer responses. */
export interface OpportunityRow {
  id: string;
  branchId: string;
  customerProfileId: string;
  customerPartyId: string;
  leadId: string | null;
  contactPartyId: string | null;
  pipelineId: string;
  stageId: string;
  stageFlag: OpportunityStageFlag;
  status: OpportunityStatus;
  title: string;
  importance: number;
  cardColor: CardColor | null;
  amount: string | null;
  currencyCode: string | null;
  description: string | null;
  expectedCloseDate: string | null;
  probabilityPercent: number | null;
  ownerUserId: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
  customerProfileType: CustomerProfileType | null;
  customerDisplayName: string | null;
  customerCompanyName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerCountry: string | null;
  customerCity: string | null;
  primaryContact: OpportunityContactSummary | null;
  leadSourceName: string | null;
  leadSourceIconUrl: string | null;
  ownerDisplayName: string | null;
  ownerAvatarUrl: string | null;
  openActivityCount: number;
  nextOpenActivityAt: string | null;
  activityState: ActivityState;
  tags: OpportunityTag[];
  winReason: { id: string; nameAr: string; nameEn: string } | null;
  lostReasonRef: { id: string; nameAr: string; nameEn: string } | null;
  stageEnteredAt: string;
  customFields: Record<string, unknown>;
  createdByUserId?: string | null;
  lostReasonId?: string | null;
  winReasonId?: string | null;
  opportunityRevision?: string;
  forecastCategory?: OpportunityForecastCategory | null;
}

export type OpportunityForecastCategory = 'PIPELINE' | 'BEST_CASE' | 'COMMIT' | 'OMITTED';

/** Fields the backend Board projection does not send (entity + Pick<OpportunityCardRow> + contactDisplayName). */
export const BOARD_OMITTED_FIELDS = [
  'customerPhone',
  'customerEmail',
  'customerCountry',
  'customerCity',
  'primaryContact',
  'leadSourceName',
  'leadSourceIconUrl',
] as const;

/** Compact Board item: exactly the fields the backend Board projection sends. */
export type OpportunityBoardRow = Omit<OpportunityRow, (typeof BOARD_OMITTED_FIELDS)[number]> & {
  contactDisplayName: string | null;
};

export interface CurrencyAmount {
  currencyCode: string;
  amount: string;
}

export interface LaneSummary {
  totalCount: number;
  amountsByCurrency: CurrencyAmount[];
}

export interface ActivitySummary {
  totalCount: number;
  noOpenCount: number;
  overdueCount: number;
  todayCount: number;
  futureCount: number;
}

export interface PageInfo {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface BoardStage {
  stage: PipelineStageView;
  items: OpportunityBoardRow[];
  summary: LaneSummary;
  activitySummary: ActivitySummary;
  pageInfo: PageInfo;
}

export interface BoardResponse {
  pipeline: PipelineView;
  stages: BoardStage[];
}

export interface StagePageResponse {
  stageId: string;
  items: OpportunityBoardRow[];
  summary: LaneSummary;
  activitySummary: ActivitySummary;
  pageInfo: PageInfo;
}

export type WireNode =
  | { field: string; operator: string; value?: unknown }
  | { op: 'AND' | 'OR'; children: WireNode[] };

export interface OpportunitySearchBody {
  branchId: string;
  search?: string;
  searchField?: SearchField;
  tagIds?: string[];
  filterTree?: WireNode;
  sort?: string;
}

export interface BoardBody extends OpportunitySearchBody {
  limitPerStage: 0 | 50;
}

export interface StagePageBody extends OpportunitySearchBody {
  limit: 50;
  cursor: string;
}

export interface Scope {
  scope: 'own' | 'team' | 'all';
  ownerUserIds: string[] | null;
}

/**
 * GET /crm/opportunities/capabilities?branchId= (opportunities.service.ts getCapabilities): the wire envelope.
 * `opportunities.api.ts` unwraps it to `OpportunityCapabilities` for the views.
 */
export interface OpportunityCapabilitiesResponse {
  branchId: string;
  opportunities: OpportunityCapabilities;
}

export interface OpportunityCapabilities {
  create: Scope | null;
  update: Scope | null;
  delete: Scope | null;
  move: Scope | null;
  transfer: Scope | null;
  bulk: {
    assign: Scope | null;
    moveStage: Scope | null;
    createActivity: Scope | null;
    delete: Scope | null;
  };
  export: boolean;
}

export interface CreateOpportunityBody {
  branchId: string;
  customerProfileId: string;
  pipelineId: string;
  stageId: string;
  title: string;
  leadId?: string;
  contactPartyId?: string;
  importance?: number;
  amount?: string;
  currencyCode?: string;
  description?: string;
  ownerUserId?: string;
  expectedCloseDate?: string;
  probabilityPercent?: number;
  cardColor?: CardColor;
  tagIds?: string[];
  customFields?: Record<string, unknown>;
}

export interface UpdateOpportunityBody {
  expectedUpdatedAt: string;
  title?: string;
  importance?: number;
  cardColor?: CardColor | null;
  amount?: string | null;
  currencyCode?: string | null;
  description?: string | null;
  ownerUserId?: string;
  contactPartyId?: string | null;
  expectedCloseDate?: string | null;
  probabilityPercent?: number | null;
  customFields?: Record<string, unknown>;
}

export interface MoveStageBody {
  stageId: string;
  expectedUpdatedAt?: string;
  reason?: string;
  lostReason?: string;
  lostReasonId?: string;
  winReasonId?: string;
}

export interface TransferPipelineBody extends Partial<Omit<MoveStageBody, 'stageId'>> {
  pipelineId: string;
  stageId?: string;
}

export interface StageSnapshot {
  membershipId: string;
  pipelineId: string;
  pipelineNameAr: string;
  pipelineNameEn: string;
  opportunityStageId: string;
  stageNameAr: string;
  stageNameEn: string;
  flag: OpportunityStageFlag;
  category: StageCategory;
  rank: number;
}

export interface StageHistoryItem {
  id: string;
  fromStageId: string | null;
  toStageId: string | null;
  fromStatus: OpportunityStatus | null;
  toStatus: OpportunityStatus;
  changedAt: string;
  changedByUserId: string | null;
  changedByDisplayName?: string | null;
  changedByAvatarUrl?: string | null;
  reason: string | null;
  fromStageSnapshot: StageSnapshot | null;
  toStageSnapshot: StageSnapshot | null;
}

export type OpportunityReasonKind = 'WIN' | 'LOSS';

/**
 * GET /crm/opportunities/reasons?kind= (OpportunityReasonsQueryDto): `kind` is required; there is no `active`
 * parameter (the repository reads `is_active = true` only, ordered by sort_order, code).
 */
export interface OpportunityReasonsQuery {
  kind: OpportunityReasonKind;
}

/** One row of the sales-user reason picker (opportunities.repository.ts readReasons, OpportunityReasonView). */
export interface OpportunityReason {
  id: string;
  reasonKind: OpportunityReasonKind;
  code: string;
  nameEn: string;
  nameAr: string;
  definitionEn: string | null;
  definitionAr: string | null;
  polarity: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | null;
  sortOrder: number;
}

/** Response of GET /crm/opportunities/reasons: `{ items }`, never a bare array. */
export interface OpportunityReasonListResponse {
  items: OpportunityReason[];
}

export interface CustomerOption {
  id: string;
  partyId: string;
  profileType: CustomerProfileType;
  displayName: string;
  companyName: string | null;
  status: 'PROSPECT' | 'ACTIVE_CUSTOMER' | 'INACTIVE' | 'BLACKLISTED' | null;
  phone: string | null;
  email: string | null;
}

export interface CustomerContactOption {
  partyId: string;
  displayName: string;
  jobTitle: string | null;
  email: string | null;
  phones: string[];
  isPrimary: boolean;
  isCustomerParty: boolean;
}

export interface OpportunityRelatedCounts {
  quotations: number | null;
  salesOrders: number | null;
}

export interface LinkedQuotation {
  id: string;
  documentNumber: string | null;
  draftReference: string | null;
  lifecycleStatus: string;
  grandTotal: string;
  currencyCode: string;
  businessDate: string;
  currentRevision: {
    id: string;
    revisionNumber: number;
    status: string;
    validUntil: string | null;
  } | null;
}

export type OpportunityBulkAction = 'ASSIGN' | 'MOVE_STAGE' | 'CREATE_ACTIVITY' | 'DELETE';

export interface SelectedOpportunity {
  id: string;
  title: string;
  ownerUserId: string | null;
  stageId: string;
  status: OpportunityStatus;
  updatedAt: string;
}

export const BOARD_LIMIT = 50;

export const OPPORTUNITY_LIMITS = {
  title: 180,
  description: 2000,
  reason: 1000,
  amountIntegerDigits: 16,
  amountDecimals: 8,
  probabilityMin: 0,
  probabilityMax: 100,
  tags: 50,
} as const;

const DECIMAL_SCALE = 8;
const DECIMAL_FACTOR = 100_000_000n;

export function opportunityRef(id: string): string {
  const hex = id.replace(/[^0-9a-f]/gi, '');
  const tail = (hex || id).slice(-5).toUpperCase();
  return `OP-${tail}`;
}

export function isClosed(row: Pick<OpportunityRow, 'status'>): boolean {
  return row.status === 'WON' || row.status === 'LOST';
}

export function formatAmount(amount: string | null, _lang?: 'ar' | 'en'): string {
  return formatMoneyNumber(amount) ?? '—';
}

export function formatMoney(amount: string | null, currency: string | null, lang: 'ar' | 'en'): string {
  const formatted = formatAmount(amount, lang);
  if (formatted === '—') return '—';
  const code = currency?.trim() ?? '';
  return code && code !== 'UNSPECIFIED' ? `${formatted} ${code}` : formatted;
}

/** i18n key for the "no currency" suffix, or null when the amount carries a currency. */
export function moneyNoCurrencyKey(amount: string | null, currency: string | null): string | null {
  if (formatAmount(amount) === '—') return null;
  const code = currency?.trim() ?? '';
  return code && code !== 'UNSPECIFIED' ? null : 'opportunities.noCurrency';
}

function parseScaledDecimal(raw: string): bigint {
  const trimmed = raw.trim();
  if (!trimmed) return 0n;
  const negative = trimmed.startsWith('-');
  const unsigned = negative || trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;

  const fullMatch = /^(\d+)(?:\.(\d*))?$/.exec(unsigned);
  let intStr = '0';
  let rawFrac = '';
  if (fullMatch) {
    intStr = fullMatch[1];
    rawFrac = fullMatch[2] ?? '';
  } else {
    const dotMatch = /^\.(\d+)$/.exec(unsigned);
    if (!dotMatch) return 0n;
    rawFrac = dotMatch[1];
  }

  const fracStr = rawFrac.slice(0, DECIMAL_SCALE).padEnd(DECIMAL_SCALE, '0');
  const magnitude = BigInt(intStr) * DECIMAL_FACTOR + BigInt(fracStr);
  return negative ? -magnitude : magnitude;
}

export function addDecimalStrings(a: string, b: string): string {
  const total = parseScaledDecimal(a) + parseScaledDecimal(b);
  const negative = total < 0n;
  const abs = negative ? -total : total;
  const intPart = abs / DECIMAL_FACTOR;
  const fracPart = (abs % DECIMAL_FACTOR).toString().padStart(DECIMAL_SCALE, '0');
  return `${negative ? '-' : ''}${intPart}.${fracPart}`;
}

export function stageLabel(stage: Pick<PipelineStageView, 'nameAr' | 'nameEn'>, lang: string): string {
  return lang === 'ar' ? stage.nameAr : stage.nameEn;
}

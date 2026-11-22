import { FAKE_COMPANIES } from '../../../core/scope/scope.fake';
import { ACME_CUSTOMER_ID, CUSTOMERS_FAKE_DB } from '../customers/customers.fake';
import type { CustomerDetail } from '../customers/customers.model';
import { fakeListCustomFields } from '../settings/custom-fields/custom-fields.fake';
import { isRequiredForOperation, type CustomField } from '../settings/custom-fields/custom-fields.model';
import { fakeGetReasons, fakeListReasons } from '../settings/reasons/reasons.fake';
import type { Reason } from '../settings/reasons/reasons.model';
import { ApiError, fakeDelay, fakeId } from '../settings/shared/settings-api';
import { listTags } from '../settings/tags/tags.api';
import type { Tag } from '../settings/tags/tags.model';
import { fakeGetWorkspaceSettings } from '../../workspace/settings/workspace-settings/workspace-settings.fake';
import {
  BOARD_LIMIT,
  BOARD_OMITTED_FIELDS,
  CARD_COLORS,
  OPPORTUNITY_LIMITS,
  addDecimalStrings,
  opportunityRef,
  type ActivityState,
  type ActivitySummary,
  type BoardBody,
  type BoardResponse,
  type BoardStage,
  type CardColor,
  type CreateOpportunityBody,
  type CurrencyAmount,
  type CustomFieldDef,
  type CustomerContactOption,
  type CustomerOption,
  type LaneSummary,
  type LinkedQuotation,
  type MoveStageBody,
  type OpportunityBoardRow,
  type OpportunityCapabilitiesResponse,
  type OpportunityReasonListResponse,
  type OpportunityReasonsQuery,
  type OpportunityRelatedCounts,
  type OpportunityRow,
  type OpportunitySearchBody,
  type OpportunityStageFlag,
  type OpportunityStatus,
  type OpportunityTag,
  type OpportunityTagView,
  type PipelineStageView,
  type PipelineView,
  type Page,
  type Scope,
  type SearchField,
  type SelectedOpportunity,
  type StageHistoryItem,
  type StagePageBody,
  type StagePageResponse,
  type StageSnapshot,
  type TransferPipelineBody,
  type UpdateOpportunityBody,
  type WireNode,
} from './opportunities.model';

export let FAKE_TRADE_FORBIDDEN = false;
export let FAKE_REASONS_FORBIDDEN = false;
export let FAKE_OPPORTUNITY_READ_ONLY = false;
export let FAKE_CAN_MANAGE_TAGS = true;
export let FAKE_CAN_MANAGE_PIPELINES = true;

export const SALES_PIPELINE_ID = '01950000-0000-7000-8000-000000000501';
export const PROJECTS_PIPELINE_ID = '01950000-0000-7000-8000-000000000502';
export const RENEWALS_PIPELINE_ID = '01950000-0000-7000-8000-000000000503';
export const ACME_OPPORTUNITY_ID = '0192b8ea-7c4f-7a7d-9c9f-51c7f2b30001';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SESSION_BRANCH_ID = FAKE_COMPANIES[0]?.branches[0]?.id ?? 'b1';
const AMOUNT_SCALE_FACTOR = 100_000_000n;
const AMOUNT_FORMAT_RE = /^\d{1,16}(\.\d{1,8})?$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SELECTION_CAP = 10_000;
const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * crm-app main.ts ValidationPipe exceptionFactory -> 400 CRM_VALIDATION_FAILED; AllExceptionsFilter flattens it to
 * `details: { <property path>: string[] }`. The fakes put lowercase snake_case constraint names in those arrays
 * (an UPPER_CASE entry would be replaced by the filter's generic message). The pipe runs before any service code,
 * so every DTO check below comes before 403/404/409/422.
 */
function validationFailed(details: Record<string, string[]>): ApiError {
  return new ApiError(400, 'CRM_VALIDATION_FAILED', details);
}

/**
 * `@IsUUID('7') branchId` on search, board, stage page, selection, counts and capabilities. The fake scope's branch
 * ids are not UUIDs ('b1'), so only presence and type are checked here.
 */
function assertBranchId(branchId: unknown): void {
  if (typeof branchId !== 'string' || !branchId.trim()) throw validationFailed({ branchId: ['is_uuid'] });
}

function assertOptionalText(value: unknown, field: string, max: number, notEmpty = false): void {
  if (value === undefined) return;
  if (typeof value !== 'string') throw validationFailed({ [field]: ['is_string'] });
  if (notEmpty && !value.length) throw validationFailed({ [field]: ['is_not_empty'] });
  if (value.length > max) throw validationFailed({ [field]: ['max_length'] });
}

/** `@ValidateIf(v !== undefined) @IsDateString({strict}) @Matches(ISO-with-offset)` on expectedUpdatedAt. */
function assertExpectedUpdatedAt(value: unknown): void {
  if (value === undefined) return;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw validationFailed({ expectedUpdatedAt: ['matches'] });
  }
}

interface FakeOwner {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  teamId: string;
}

const FAKE_OWNERS: readonly FakeOwner[] = [
  { id: 'u1', displayName: 'Kamal Radwan', avatarUrl: null, teamId: 't1' },
  { id: 'u2', displayName: 'Mona Adel', avatarUrl: null, teamId: 't1' },
  { id: 'u3', displayName: 'Omar Fathy', avatarUrl: null, teamId: 't2' },
];

const OWNER_BY_ID = new Map(FAKE_OWNERS.map((owner) => [owner.id, owner]));

interface FakeSource {
  id: string;
  name: string;
}

const FAKE_SOURCES: readonly FakeSource[] = [
  { id: 'src-web', name: 'Website' },
  { id: 'src-ref', name: 'Referral' },
  { id: 'src-expo', name: 'Exhibition' },
  { id: 'src-social', name: 'Social media' },
  { id: 'src-call', name: 'Cold call' },
];

const FALLBACK_TAG_TIMESTAMP = '2026-01-05T08:00:00.000Z';

const FALLBACK_TAGS: readonly Tag[] = [
  { id: 'tag-001', name: 'VIP', backgroundColor: '#FBBF24', textColor: '#451A03' },
  { id: 'tag-002', name: 'Hot lead', backgroundColor: '#EF4444', textColor: '#FFFFFF' },
  { id: 'tag-003', name: 'عميل مميز', backgroundColor: '#F3E8FF', textColor: '#6B21A8' },
  { id: 'tag-004', name: 'Follow up', backgroundColor: '#DBEAFE', textColor: '#1E40AF' },
  { id: 'tag-005', name: 'Partner', backgroundColor: '#CCFBF1', textColor: '#115E59' },
  { id: 'tag-007', name: 'Government', backgroundColor: '#4338CA', textColor: '#FFFFFF' },
  { id: 'tag-008', name: 'Trial', backgroundColor: '#ECFCCB', textColor: '#3F6212' },
].map((tag) => ({ ...tag, createdAt: FALLBACK_TAG_TIMESTAMP, updatedAt: FALLBACK_TAG_TIMESTAMP }));

const PIPELINES_STORE: PipelineView[] = [
  {
    id: SALES_PIPELINE_ID,
    code: 'SALES',
    nameAr: 'المبيعات',
    nameEn: 'Sales',
    description: 'Primary commercial sales pipeline.',
    isDefault: true,
    isActive: true,
    accessMode: 'ALL',
    createdAt: FALLBACK_TAG_TIMESTAMP,
    updatedAt: FALLBACK_TAG_TIMESTAMP,
    stages: [
      {
        id: 'ps-sales-1',
        pipelineId: SALES_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000421',
        rank: 1,
        nameAr: 'جديدة',
        nameEn: 'New',
        flag: 'NEW',
        category: 'OPEN',
        isActive: true,
        isSystem: true,
      },
      {
        id: 'ps-sales-2',
        pipelineId: SALES_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000422',
        rank: 2,
        nameAr: 'استكشاف',
        nameEn: 'Discovery',
        flag: 'DISCOVERY',
        category: 'IN_PROGRESS',
        isActive: true,
        isSystem: false,
      },
      {
        id: 'ps-sales-3',
        pipelineId: SALES_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000424',
        rank: 3,
        nameAr: 'عرض سعر',
        nameEn: 'Proposal',
        flag: 'PROPOSAL',
        category: 'IN_PROGRESS',
        isActive: true,
        isSystem: true,
      },
      {
        id: 'ps-sales-4',
        pipelineId: SALES_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000425',
        rank: 4,
        nameAr: 'تفاوض',
        nameEn: 'Negotiation',
        flag: 'NEGOTIATION',
        category: 'IN_PROGRESS',
        isActive: true,
        isSystem: true,
      },
      {
        id: 'ps-sales-5',
        pipelineId: SALES_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000427',
        rank: 5,
        nameAr: 'معلّقة',
        nameEn: 'On hold',
        flag: 'ON_HOLD',
        category: 'IN_PROGRESS',
        isActive: true,
        isSystem: false,
      },
      {
        id: 'ps-sales-6',
        pipelineId: SALES_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000428',
        rank: 6,
        nameAr: 'فازت',
        nameEn: 'Won',
        flag: 'WON',
        category: 'POSITIVE',
        isActive: true,
        isSystem: true,
      },
      {
        id: 'ps-sales-7',
        pipelineId: SALES_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000429',
        rank: 7,
        nameAr: 'خسرت',
        nameEn: 'Lost',
        flag: 'LOST',
        category: 'NEGATIVE',
        isActive: true,
        isSystem: true,
      },
    ],
  },
  {
    id: PROJECTS_PIPELINE_ID,
    code: 'PROJECTS',
    nameAr: 'المشاريع',
    nameEn: 'Projects',
    description: 'Implementation and multi-phase project deals.',
    isDefault: false,
    isActive: true,
    accessMode: 'ALL',
    createdAt: FALLBACK_TAG_TIMESTAMP,
    updatedAt: FALLBACK_TAG_TIMESTAMP,
    stages: [
      {
        id: 'ps-proj-1',
        pipelineId: PROJECTS_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000421',
        rank: 1,
        nameAr: 'جديدة',
        nameEn: 'New',
        flag: 'NEW',
        category: 'OPEN',
        isActive: true,
        isSystem: true,
      },
      {
        id: 'ps-proj-2',
        pipelineId: PROJECTS_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000423',
        rank: 2,
        nameAr: 'تأهيل',
        nameEn: 'Qualification',
        flag: 'QUALIFICATION',
        category: 'IN_PROGRESS',
        isActive: true,
        isSystem: true,
      },
      {
        id: 'ps-proj-3',
        pipelineId: PROJECTS_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000424',
        rank: 3,
        nameAr: 'عرض سعر',
        nameEn: 'Proposal',
        flag: 'PROPOSAL',
        category: 'IN_PROGRESS',
        isActive: true,
        isSystem: true,
      },
      {
        id: 'ps-proj-4',
        pipelineId: PROJECTS_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000426',
        rank: 4,
        nameAr: 'تعاقد',
        nameEn: 'Contracting',
        flag: 'CONTRACTING',
        category: 'IN_PROGRESS',
        isActive: true,
        isSystem: false,
      },
      {
        id: 'ps-proj-5',
        pipelineId: PROJECTS_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000428',
        rank: 5,
        nameAr: 'فازت',
        nameEn: 'Won',
        flag: 'WON',
        category: 'POSITIVE',
        isActive: true,
        isSystem: true,
      },
      {
        id: 'ps-proj-6',
        pipelineId: PROJECTS_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000429',
        rank: 6,
        nameAr: 'خسرت',
        nameEn: 'Lost',
        flag: 'LOST',
        category: 'NEGATIVE',
        isActive: true,
        isSystem: true,
      },
      {
        id: 'ps-proj-7',
        pipelineId: PROJECTS_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000431',
        rank: 7,
        nameAr: 'مراجعة قديمة',
        nameEn: 'Legacy review',
        flag: 'DISCOVERY',
        category: 'IN_PROGRESS',
        isActive: false,
        isSystem: false,
      },
    ],
  },
  {
    id: RENEWALS_PIPELINE_ID,
    code: 'RENEWALS',
    nameAr: 'التجديدات',
    nameEn: 'Renewals',
    description: 'Annual contract renewals (restricted access).',
    isDefault: false,
    isActive: true,
    accessMode: 'RESTRICTED',
    createdAt: FALLBACK_TAG_TIMESTAMP,
    updatedAt: FALLBACK_TAG_TIMESTAMP,
    stages: [
      {
        id: 'ps-ren-1',
        pipelineId: RENEWALS_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000421',
        rank: 1,
        nameAr: 'جديدة',
        nameEn: 'New',
        flag: 'NEW',
        category: 'OPEN',
        isActive: true,
        isSystem: true,
      },
      {
        id: 'ps-ren-2',
        pipelineId: RENEWALS_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000425',
        rank: 2,
        nameAr: 'تفاوض',
        nameEn: 'Negotiation',
        flag: 'NEGOTIATION',
        category: 'IN_PROGRESS',
        isActive: true,
        isSystem: true,
      },
      {
        id: 'ps-ren-3',
        pipelineId: RENEWALS_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000428',
        rank: 3,
        nameAr: 'فازت',
        nameEn: 'Won',
        flag: 'WON',
        category: 'POSITIVE',
        isActive: true,
        isSystem: true,
      },
      {
        id: 'ps-ren-4',
        pipelineId: RENEWALS_PIPELINE_ID,
        opportunityStageId: '01950000-0000-7000-8000-000000000429',
        rank: 4,
        nameAr: 'خسرت',
        nameEn: 'Lost',
        flag: 'LOST',
        category: 'NEGATIVE',
        isActive: true,
        isSystem: true,
      },
    ],
  },
];

interface OpportunityRecord extends OpportunityRow {
  ownerTeamId: string | null;
  createdByUserId: string | null;
  customerStatus: CustomerOption['status'];
  leadSourceId: string | null;
  lostReasonId: string | null;
  winReasonId: string | null;
  isSeeded: boolean;
}

const TITLES: readonly string[] = [
  'Warehouse racking',
  'توريد أنظمة نقاط البيع',
  'ERP implementation for 5 branches',
  'تطوير البنية التحتية السحابية',
  'Annual maintenance contract',
  'توريد أجهزة مسح ضوئي للمستودعات',
  'Fleet tracking rollout',
  'نظام إدارة الموارد البشرية والرواتب',
  'Branch security & CCTV upgrade',
  'توسعة شبكة الفروع التجارية',
  'Cold storage monitoring sensors',
  'تحديث منظومة الفوترة الإلكترونية',
  'Multi-site Wi-Fi infrastructure',
  'توريد خوادم ومعدات شبكات',
  'Retail loyalty platform integration',
  'اتفاقية دعم فني سنوية شاملة',
  'Packaging line automation',
  'منصة تجارة إلكترونية متكاملة',
  'Clinic management software suite',
  'تجهيز قاعات الاجتماعات الذكية',
];

const AMOUNT_POOL: readonly { amount: string | null; currency: string | null }[] = [
  { amount: '250000.00000000', currency: 'EGP' },
  { amount: '1250.50000000', currency: 'SAR' },
  { amount: '99.00400000', currency: 'USD' },
  { amount: '48500.00000000', currency: 'KWD' },
  { amount: '1250.00400000', currency: 'EGP' },
  { amount: '75000.00000000', currency: 'SAR' },
  { amount: '18400.50000000', currency: 'USD' },
  { amount: '6200.00000000', currency: 'KWD' },
  { amount: null, currency: null },
  { amount: '9999999999999999.99000000', currency: 'EGP' },
  { amount: '320000.00000000', currency: 'SAR' },
  { amount: '0.00500000', currency: 'USD' },
  { amount: '15800.00000000', currency: null },
  { amount: '123456789012345.50000000', currency: 'SAR' },
  { amount: '42500.50000000', currency: 'KWD' },
  { amount: '89000.00000000', currency: 'EGP' },
];

const WIN_REASONS_SEED: readonly { id: string; nameEn: string; nameAr: string }[] = [
  { id: '01950000-0000-7000-8000-000000000307', nameEn: 'Value fit', nameAr: 'ملاءمة القيمة' },
  { id: '01950000-0000-7000-8000-000000000308', nameEn: 'Relationship', nameAr: 'العلاقة مع العميل' },
  { id: '01950000-0000-7000-8000-000000000309', nameEn: 'Price', nameAr: 'السعر' },
];

const LOSS_REASONS_SEED: readonly { id: string; nameEn: string; nameAr: string }[] = [
  { id: '01950000-0000-7000-8000-000000000301', nameEn: 'Price', nameAr: 'السعر' },
  { id: '01950000-0000-7000-8000-000000000302', nameEn: 'Chose a competitor', nameAr: 'اختار منافسًا' },
  { id: '01950000-0000-7000-8000-000000000303', nameEn: 'Timing', nameAr: 'التوقيت غير مناسب' },
  { id: '01950000-0000-7000-8000-000000000304', nameEn: 'No response', nameAr: 'لا استجابة من العميل' },
];

const COLORS = Object.keys(CARD_COLORS) as CardColor[];

let opTimestampCounter = 0;

function oppDelay(): Promise<void> {
  return fakeDelay(250 + Math.floor(Math.random() * 251));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function nextUpdatedAt(previousIso?: string): string {
  const nowMs = Date.now();
  const prevMs = previousIso ? Date.parse(previousIso) : 0;
  const baseMs = Number.isFinite(prevMs) ? Math.max(nowMs, prevMs + 1) : nowMs;
  opTimestampCounter += 1;
  return new Date(baseMs + opTimestampCounter).toISOString();
}

function statusOfFlag(flag: OpportunityStageFlag): OpportunityStatus {
  switch (flag) {
    case 'WON':
      return 'WON';
    case 'LOST':
      return 'LOST';
    case 'ON_HOLD':
      return 'ON_HOLD';
    default:
      return 'IN_PROGRESS';
  }
}

function uuidOpportunityHex(index1Based: number): string {
  return `0192b8ea-7c4f-7a7d-9c9f-51c7f2b3${index1Based.toString(16).padStart(4, '0')}`;
}

function isoDateDaysFromNow(baseMs: number, daysOffset: number): string {
  return new Date(baseMs + daysOffset * DAY_MS).toISOString().slice(0, 10);
}

function stageSnapshotOf(pipeline: PipelineView, stage: PipelineStageView): StageSnapshot {
  return {
    membershipId: stage.id,
    pipelineId: pipeline.id,
    pipelineNameAr: pipeline.nameAr,
    pipelineNameEn: pipeline.nameEn,
    opportunityStageId: stage.opportunityStageId,
    stageNameAr: stage.nameAr,
    stageNameEn: stage.nameEn,
    flag: stage.flag,
    category: stage.category,
    rank: stage.rank,
  };
}

function buildSeedStageHistory(
  oppId: string,
  pipeline: PipelineView,
  currentStage: PipelineStageView,
  owner: FakeOwner | null,
  createdAtMs: number,
  enteredAtMs: number,
  lostReason: string | null,
): StageHistoryItem[] {
  const activeStages = pipeline.stages.filter((s) => s.isActive).sort((a, b) => a.rank - b.rank);
  const currentIdx = Math.max(0, activeStages.findIndex((s) => s.id === currentStage.id));
  const actor = owner ?? FAKE_OWNERS[0];

  const path: PipelineStageView[] = [];
  if (currentIdx === 0) {
    // 3 history entries: initial NEW -> step 2 -> back to NEW
    const nextStage = activeStages[1] ?? currentStage;
    path.push(activeStages[0], nextStage, currentStage);
  } else if (currentIdx === 1) {
    // 3 history entries: NEW -> step 2 (current), with initial creation + intermediate revisit
    const thirdStage = activeStages[2];
    if (thirdStage) {
      path.push(activeStages[0], currentStage, thirdStage, currentStage);
    } else {
      path.push(activeStages[0], currentStage, activeStages[0], currentStage);
    }
  } else {
    for (let i = 0; i <= currentIdx; i++) {
      path.push(activeStages[i]);
    }
  }

  // Ensure between 3 and 6 items total (initial null->stage[0] counts as 1 item + path transitions)
  const items: StageHistoryItem[] = [];
  const totalSpan = Math.max(DAY_MS, enteredAtMs - createdAtMs);
  const totalEntries = Math.min(6, Math.max(3, path.length));
  const trimmedPath = path.slice(0, totalEntries);

  for (let i = 0; i < trimmedPath.length; i++) {
    const toStage = trimmedPath[i];
    const fromStage = i === 0 ? null : trimmedPath[i - 1];
    const isLast = i === trimmedPath.length - 1;
    const atMs = isLast
      ? enteredAtMs
      : createdAtMs + Math.floor((totalSpan * i) / Math.max(1, trimmedPath.length - 1));
    items.push({
      id: `sh-${oppId.slice(-4)}-${i + 1}`,
      fromStageId: fromStage?.id ?? null,
      toStageId: toStage.id,
      fromStatus: fromStage ? statusOfFlag(fromStage.flag) : null,
      toStatus: statusOfFlag(toStage.flag),
      changedAt: new Date(atMs).toISOString(),
      changedByUserId: actor.id,
      changedByDisplayName: actor.displayName,
      changedByAvatarUrl: actor.avatarUrl,
      reason: isLast && toStage.flag === 'LOST' ? lostReason : null,
      fromStageSnapshot: fromStage ? stageSnapshotOf(pipeline, fromStage) : null,
      toStageSnapshot: stageSnapshotOf(pipeline, toStage),
    });
  }

  return items;
}

function customerPrimaryPhone(customer: CustomerDetail): string | null {
  return (
    customer.companyPhone ??
    customer.primaryMobile ??
    customer.phones[0] ??
    customer.primaryContact?.phones[0] ??
    null
  );
}

function customerPrimaryEmail(customer: CustomerDetail): string | null {
  return (
    customer.companyEmail ??
    customer.email ??
    customer.primaryContact?.email ??
    customer.contacts[0]?.email ??
    null
  );
}

function customerContactsForSeed(customer: CustomerDetail): OpportunityRow['primaryContact'] {
  if (customer.primaryContact) {
    return {
      partyId: customer.primaryContact.partyId,
      displayName: customer.primaryContact.displayName,
      jobTitle: customer.primaryContact.jobTitle,
      isPrimary: customer.primaryContact.isPrimary,
      email: customer.primaryContact.email,
      phones: [...customer.primaryContact.phones],
    };
  }
  const first = customer.contacts[0];
  if (first) {
    return {
      partyId: first.partyId,
      displayName: first.displayName,
      jobTitle: first.jobTitle,
      isPrimary: first.isPrimary,
      email: first.email,
      phones: [...first.phones],
    };
  }
  return null;
}

const seedHistoryMap = new Map<string, StageHistoryItem[]>();

function buildSeedOpportunities(): OpportunityRecord[] {
  const now = Date.now();
  const nonBlacklisted = CUSTOMERS_FAKE_DB.filter((c) => c.status !== 'BLACKLISTED');
  const blacklisted = CUSTOMERS_FAKE_DB.filter((c) => c.status === 'BLACKLISTED');
  const acme = CUSTOMERS_FAKE_DB.find((c) => c.id === ACME_CUSTOMER_ID) ?? nonBlacklisted[0];

  const sales = PIPELINES_STORE[0];
  const projects = PIPELINES_STORE[1];
  const renewals = PIPELINES_STORE[2];

  const salesOpenStages = sales.stages.filter((s) => s.isActive && s.flag !== 'WON' && s.flag !== 'LOST');
  const projOpenStages = projects.stages.filter((s) => s.isActive && s.flag !== 'WON' && s.flag !== 'LOST');
  const renOpenStages = renewals.stages.filter((s) => s.isActive && s.flag !== 'WON' && s.flag !== 'LOST');

  const records: OpportunityRecord[] = [];
  const totalCount = 80;

  for (let index = 0; index < totalCount; index++) {
    const isAcme = index === 0;
    const id = isAcme ? ACME_OPPORTUNITY_ID : uuidOpportunityHex(index + 1);

    // 48 in Sales (0..47), 20 in Projects (48..67), 12 in Renewals (68..79)
    const pipeline = index < 48 ? sales : index < 68 ? projects : renewals;
    const openStages =
      pipeline.id === SALES_PIPELINE_ID
        ? salesOpenStages
        : pipeline.id === PROJECTS_PIPELINE_ID
          ? projOpenStages
          : renOpenStages;
    const wonStage = pipeline.stages.find((s) => s.flag === 'WON')!;
    const lostStage = pipeline.stages.find((s) => s.flag === 'LOST')!;

    // Exactly 8 WON (10%) and 8 LOST (10%), none on index 0
    let stage: PipelineStageView;
    if (isAcme) {
      stage = sales.stages.find((s) => s.flag === 'PROPOSAL')!;
    } else if (index >= 4 && index <= 11) {
      stage = wonStage;
    } else if (index >= 12 && index <= 19) {
      stage = lostStage;
    } else {
      stage = openStages[index % openStages.length];
    }

    const status = statusOfFlag(stage.flag);
    const customer: CustomerDetail = isAcme
      ? acme
      : status === 'LOST' && blacklisted.length > 0 && index >= 18
        ? blacklisted[index % blacklisted.length]
        : status === 'WON'
          ? nonBlacklisted[index % nonBlacklisted.length]
          : CUSTOMERS_FAKE_DB[index % CUSTOMERS_FAKE_DB.length];

    const primaryContact = customerContactsForSeed(customer);
    const contactPartyId =
      customer.profileType === 'CORPORATE' ? (primaryContact?.partyId ?? null) : customer.partyId;

    const owner: FakeOwner | null = isAcme
      ? OWNER_BY_ID.get('u1')!
      : index % 7 === 6
        ? null
        : FAKE_OWNERS[index % FAKE_OWNERS.length];
    const creator = FAKE_OWNERS[index % FAKE_OWNERS.length];
    const source = FAKE_SOURCES[index % FAKE_SOURCES.length];

    const amountEntry = isAcme
      ? { amount: '250000.00000000', currency: 'EGP' }
      : AMOUNT_POOL[index % AMOUNT_POOL.length];

    const closeOffsets = [-12, -3, 0, 2, 5, 14, 25, null, 45, -1, 6, 28];
    const closeOffset = isAcme ? 30 : closeOffsets[index % closeOffsets.length];
    const expectedCloseDate = closeOffset === null ? null : isoDateDaysFromNow(now, closeOffset);

    const createdAtMs = now - (85 - (index % 65)) * DAY_MS;
    const stageEnteredMs = createdAtMs + ((index % 15) + 1) * DAY_MS;
    const updatedAtMs = Math.max(stageEnteredMs, now - (index % 10) * DAY_MS);

    const winReasonSeed = status === 'WON' ? WIN_REASONS_SEED[index % WIN_REASONS_SEED.length] : null;
    const lossReasonSeed = status === 'LOST' ? LOSS_REASONS_SEED[index % LOSS_REASONS_SEED.length] : null;

    const activityStates: readonly ActivityState[] = ['OVERDUE', 'TODAY', 'FUTURE', 'NO_OPEN', 'FUTURE'];
    const activityState: ActivityState = isAcme ? 'TODAY' : activityStates[index % activityStates.length];
    const openActivityCount = activityState === 'NO_OPEN' ? 0 : (index % 3) + 1;
    const nextOpenActivityAt =
      activityState === 'NO_OPEN'
        ? null
        : new Date(
            now + (activityState === 'OVERDUE' ? -2 : activityState === 'TODAY' ? 0 : 4) * DAY_MS,
          ).toISOString();

    const probabilityByFlag: Record<OpportunityStageFlag, number | null> = {
      NEW: 15,
      DISCOVERY: 25,
      QUALIFICATION: 35,
      PROPOSAL: 60,
      NEGOTIATION: 80,
      CONTRACTING: 90,
      ON_HOLD: 40,
      WON: 100,
      LOST: 0,
    };

    const tags = (isAcme
      ? [FALLBACK_TAGS[0], FALLBACK_TAGS[3]]
      : FALLBACK_TAGS.filter((_, tIdx) => (index + tIdx) % 4 === 0)
    ).map(tagSummary);

    const title = isAcme
      ? 'Acme Retail — POS rollout'
      : `${TITLES[index % TITLES.length]} — ${customer.displayName}`;

    const customFields: Record<string, unknown> = isAcme
      ? {
          competitor: 'LegacyPOS Co.',
          contract_url: 'https://contracts.example.com/acme-pos',
          executive_approved: true,
        }
      : index % 5 === 0
        ? {
            competitor: index % 2 === 0 ? 'Delta Systems' : 'Horizon Tech',
            executive_approved: index % 10 === 0,
          }
        : {};

    const record: OpportunityRecord = {
      id,
      branchId: DEFAULT_SESSION_BRANCH_ID,
      customerProfileId: customer.id,
      customerPartyId: customer.partyId,
      leadId: customer.sourceLeadId,
      contactPartyId,
      pipelineId: pipeline.id,
      stageId: stage.id,
      stageFlag: stage.flag,
      status,
      title,
      importance: isAcme ? 3 : index % 4,
      cardColor: isAcme ? 'BLUE' : index % 3 === 0 ? COLORS[(index / 3) % COLORS.length] : null,
      amount: amountEntry.amount,
      currencyCode: amountEntry.currency,
      description: isAcme
        ? 'Multi-branch POS hardware and cloud software rollout across 12 Acme Retail stores.'
        : index % 3 === 0
          ? `Commercial opportunity for ${customer.displayName}.`
          : null,
      expectedCloseDate,
      probabilityPercent: isAcme ? 60 : index % 11 === 0 ? null : probabilityByFlag[stage.flag],
      ownerUserId: owner?.id ?? null,
      wonAt: status === 'WON' ? new Date(stageEnteredMs).toISOString() : null,
      lostAt: status === 'LOST' ? new Date(stageEnteredMs).toISOString() : null,
      lostReason: lossReasonSeed ? lossReasonSeed.nameEn : null,
      createdAt: new Date(createdAtMs).toISOString(),
      updatedAt: new Date(updatedAtMs).toISOString(),
      customerProfileType: customer.profileType,
      customerDisplayName: customer.displayName,
      customerCompanyName: customer.companyName,
      customerPhone: customerPrimaryPhone(customer),
      customerEmail: customerPrimaryEmail(customer),
      customerCountry: customer.address?.country ?? null,
      customerCity: customer.address?.city ?? null,
      primaryContact,
      leadSourceName: source.name,
      leadSourceIconUrl: null,
      ownerDisplayName: owner?.displayName ?? null,
      ownerAvatarUrl: owner?.avatarUrl ?? null,
      openActivityCount,
      nextOpenActivityAt,
      activityState,
      tags,
      winReason: winReasonSeed ? { ...winReasonSeed } : null,
      lostReasonRef: lossReasonSeed ? { ...lossReasonSeed } : null,
      stageEnteredAt: new Date(stageEnteredMs).toISOString(),
      customFields,
      ownerTeamId: owner?.teamId ?? null,
      createdByUserId: creator.id,
      customerStatus: customer.status,
      leadSourceId: source.id,
      lostReasonId: lossReasonSeed?.id ?? null,
      winReasonId: winReasonSeed?.id ?? null,
      isSeeded: true,
    };

    records.push(record);
    seedHistoryMap.set(
      id,
      buildSeedStageHistory(
        id,
        pipeline,
        stage,
        owner,
        createdAtMs,
        stageEnteredMs,
        lossReasonSeed ? lossReasonSeed.nameEn : null,
      ),
    );
  }

  return records;
}

let opportunities: OpportunityRecord[] = buildSeedOpportunities();
const idempotencyStore = new Map<string, { bodyKey: string; result: OpportunityRow }>();

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

/**
 * findListRowsByIds projection (list, search, detail and write responses). It selects no lostReasonId,
 * winReasonId, opportunityRevision or forecastCategory; those columns reach only the Board projection.
 */
function toListRow(rec: OpportunityRecord, branchOverride?: string): OpportunityRow {
  const {
    ownerTeamId: _ot,
    customerStatus: _cs,
    leadSourceId: _ls,
    lostReasonId: _lri,
    winReasonId: _wri,
    forecastCategory: _fc,
    opportunityRevision: _rev,
    isSeeded,
    ...row
  } = rec;
  return clone({
    ...row,
    branchId: isSeeded && branchOverride ? branchOverride : row.branchId,
    customFields: {},
  });
}

function toBoardRow(rec: OpportunityRecord, branchOverride?: string): OpportunityBoardRow {
  const row: Partial<OpportunityRow> = toListRow(rec, branchOverride);
  const contactDisplayName = row.primaryContact?.displayName ?? null;
  for (const key of BOARD_OMITTED_FIELDS) delete row[key];
  // The Board row is the whole entity: it also carries the reason-id columns.
  return { ...(row as OpportunityBoardRow), lostReasonId: rec.lostReasonId, winReasonId: rec.winReasonId, contactDisplayName };
}

/** Detail / write responses: the same projection plus the record's custom field values. */
function toDetailRow(rec: OpportunityRecord): OpportunityRow {
  return { ...toListRow(rec), branchId: rec.branchId, customFields: clone(rec.customFields) };
}

function matchesBranch(rec: OpportunityRecord, branchId: string | undefined): boolean {
  if (!branchId) return true;
  // Fake rule: seeded opportunities match every session branch so data is always visible.
  return rec.isSeeded || rec.branchId === branchId;
}

function normalizePhoneTerm(raw: string): string {
  const cleaned = raw.trim().replace(/[^\d+]/g, '');
  return cleaned.startsWith('00') ? `+${cleaned.slice(2)}` : cleaned;
}

function hasText(haystack: string | null | undefined, needleLower: string): boolean {
  return !!haystack && haystack.toLowerCase().includes(needleLower);
}

function matchesSearch(rec: OpportunityRecord, search: string, searchField: SearchField | undefined): boolean {
  const trimmed = search.trim();
  if (!trimmed) return true;
  const term = trimmed.toLowerCase();

  const matchesOpp = () =>
    hasText(rec.title, term) ||
    hasText(rec.description, term) ||
    hasText(opportunityRef(rec.id), term);

  const matchesCustomer = () =>
    hasText(rec.customerDisplayName, term) ||
    hasText(rec.customerCompanyName, term) ||
    hasText(rec.primaryContact?.displayName, term);

  const matchesEmail = () =>
    hasText(rec.customerEmail, term) || hasText(rec.primaryContact?.email, term);

  const matchesPhone = () => {
    const phoneTerm = normalizePhoneTerm(trimmed);
    if (!phoneTerm) return false;
    const candidates = [rec.customerPhone, ...(rec.primaryContact?.phones ?? [])];
    return candidates.some((phone) => !!phone && normalizePhoneTerm(phone).includes(phoneTerm));
  };

  switch (searchField) {
    case 'opportunity':
      return matchesOpp();
    case 'customer':
      return matchesCustomer();
    case 'email':
      return matchesEmail();
    case 'phone':
      return matchesPhone();
    default:
      return matchesOpp() || matchesCustomer() || matchesEmail() || matchesPhone();
  }
}

/**
 * The wire filter catalogue, as opportunity-filter-spec.ts OPPORTUNITY_FILTER_FIELD_SPECS defines it:
 * field -> value kind and the operators that field accepts.
 */
type WireKind = 'uuid' | 'enum' | 'text' | 'decimal' | 'integer' | 'date' | 'timestamp' | 'tags';
const EQUALITY_OPS = ['eq', 'neq', 'in', 'nin', 'isNull', 'isNotNull'] as const;
const ORDERED_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'isNull', 'isNotNull'] as const;
const DATE_OPS = ['eq', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'] as const;
const TEXT_OPS = [
  'eq', 'neq', 'contains', 'ilike', 'like', 'startsWith', 'endsWith',
  'ilikeAny', 'likeAny', 'startsWithAny', 'endsWithAny', 'isNull', 'isNotNull',
] as const;
const WIRE_FIELD_SPECS: Readonly<Record<string, { kind: WireKind; operators: readonly string[]; min?: number; max?: number }>> = {
  id: { kind: 'uuid', operators: EQUALITY_OPS },
  branchId: { kind: 'uuid', operators: EQUALITY_OPS },
  pipelineId: { kind: 'uuid', operators: EQUALITY_OPS },
  stageId: { kind: 'uuid', operators: EQUALITY_OPS },
  stageFlag: { kind: 'enum', operators: EQUALITY_OPS },
  stageCategory: { kind: 'enum', operators: EQUALITY_OPS },
  status: { kind: 'enum', operators: EQUALITY_OPS },
  ownerUserId: { kind: 'uuid', operators: EQUALITY_OPS },
  ownerTeamId: { kind: 'uuid', operators: EQUALITY_OPS },
  createdByUserId: { kind: 'uuid', operators: EQUALITY_OPS },
  customerProfileId: { kind: 'uuid', operators: EQUALITY_OPS },
  customerPartyId: { kind: 'uuid', operators: EQUALITY_OPS },
  customerProfileType: { kind: 'enum', operators: EQUALITY_OPS },
  customerStatus: { kind: 'enum', operators: EQUALITY_OPS },
  contactPartyId: { kind: 'uuid', operators: EQUALITY_OPS },
  leadId: { kind: 'uuid', operators: EQUALITY_OPS },
  leadSourceId: { kind: 'uuid', operators: EQUALITY_OPS },
  title: { kind: 'text', operators: TEXT_OPS },
  description: { kind: 'text', operators: TEXT_OPS },
  amount: { kind: 'decimal', operators: ORDERED_OPS },
  currencyCode: { kind: 'enum', operators: EQUALITY_OPS },
  probabilityPercent: { kind: 'integer', operators: ORDERED_OPS, min: 0, max: 100 },
  importance: { kind: 'integer', operators: ORDERED_OPS, min: 0, max: 3 },
  cardColor: { kind: 'enum', operators: EQUALITY_OPS },
  tagIds: { kind: 'tags', operators: ['anyOf', 'allOf', 'noneOf'] },
  expectedCloseDate: { kind: 'date', operators: DATE_OPS },
  activityState: { kind: 'enum', operators: EQUALITY_OPS },
  nextOpenActivityAt: { kind: 'timestamp', operators: DATE_OPS },
  openActivityCount: { kind: 'integer', operators: ORDERED_OPS, min: 0, max: 2147483647 },
  daysInStage: { kind: 'integer', operators: ORDERED_OPS, min: 0, max: 36500 },
  lostReasonId: { kind: 'uuid', operators: EQUALITY_OPS },
  winReasonId: { kind: 'uuid', operators: EQUALITY_OPS },
  lostReason: { kind: 'text', operators: TEXT_OPS },
  forecastCategory: { kind: 'enum', operators: EQUALITY_OPS },
  createdAt: { kind: 'timestamp', operators: DATE_OPS },
  updatedAt: { kind: 'timestamp', operators: DATE_OPS },
  wonAt: { kind: 'timestamp', operators: DATE_OPS },
  lostAt: { kind: 'timestamp', operators: DATE_OPS },
};

const ARRAY_OPS = new Set(['in', 'nin', 'ilikeAny', 'likeAny', 'startsWithAny', 'endsWithAny', 'anyOf', 'allOf', 'noneOf']);
const DECIMAL_WIRE_RE = /^\d{1,16}(?:\.\d{1,8})?$/;

const DATE_FIELDS = new Set<string>([
  'expectedCloseDate',
  'nextOpenActivityAt',
  'createdAt',
  'updatedAt',
  'wonAt',
  'lostAt',
]);

type WireLeaf = { field: string; operator: string; value?: unknown };

function isWireGroup(node: WireNode): node is { op: 'AND' | 'OR'; children: WireNode[] } {
  return 'op' in node || 'children' in node;
}

/** opportunity-filter-spec.ts invalidTree: 400 INVALID_FILTER_TREE { path: [path], reason: [lowercase reason] }. */
function invalidTree(path: string, reason: string): never {
  throw new ApiError(400, 'INVALID_FILTER_TREE', { path: [path], reason: [reason] });
}

/**
 * normalizeLeaf: INVALID_FIELD { field: [field], path: [path] } and invalidValue
 * INVALID_OPERATOR_VALUE { path, field, operator, reason (lowercase), expected? } as string arrays.
 */
function validateLeaf(leaf: WireLeaf, path: string): void {
  const spec = WIRE_FIELD_SPECS[leaf.field];
  if (!spec) {
    throw new ApiError(400, 'INVALID_FIELD', { field: [leaf.field], path: [path] });
  }
  const { operator, value } = leaf;
  const fail = (reason: string, expected?: string): never => {
    throw new ApiError(400, 'INVALID_OPERATOR_VALUE', {
      path: [path],
      field: [leaf.field],
      operator: [operator],
      reason: [reason.toLowerCase()],
      ...(expected ? { expected: [expected] } : {}),
    });
  };
  const negatesOpen =
    leaf.field === 'status' &&
    (operator === 'neq' || operator === 'nin') &&
    (value === 'OPEN' || (Array.isArray(value) && value.includes('OPEN')));
  if (!spec.operators.includes(operator) || negatesOpen) fail('OPERATOR_NOT_ALLOWED');
  if (operator === 'isNull' || operator === 'isNotNull') return;

  const scalar = (item: unknown): void => {
    switch (spec.kind) {
      case 'integer':
        if (typeof item !== 'number' || !Number.isSafeInteger(item)) fail('VALUE_TYPE', 'integer');
        if ((item as number) < (spec.min ?? 0) || (item as number) > (spec.max ?? Number.MAX_SAFE_INTEGER)) {
          fail('VALUE_RANGE');
        }
        return;
      case 'decimal': {
        const raw = typeof item === 'number' && Number.isFinite(item) && item >= 0 ? String(item) : item;
        if (typeof raw !== 'string' || !DECIMAL_WIRE_RE.test(raw)) fail('VALUE_TYPE', 'decimal string 16.8');
        return;
      }
      case 'text': {
        if (typeof item !== 'string') fail('VALUE_TYPE', 'text');
        const text = (item as string).trim();
        if (!text.length || text.length > 200) fail('VALUE_RANGE', 'string 1..200');
        return;
      }
      default:
        if (typeof item !== 'string') fail('VALUE_TYPE', spec.kind === 'tags' ? 'canonical uuid' : spec.kind);
    }
  };

  if (operator === 'between') {
    if (!Array.isArray(value) || value.length !== 2) fail('BETWEEN_ARITY');
    (value as unknown[]).forEach(scalar);
    const [lo, hi] = (value as unknown[]).map((item) => toComparable(item, leaf.field));
    if (lo !== null && hi !== null && lo > hi) fail('BETWEEN_ORDER');
    return;
  }
  if (ARRAY_OPS.has(operator)) {
    if (!Array.isArray(value)) fail('VALUE_TYPE', 'array');
    const items = value as unknown[];
    if (!items.length) fail('ARRAY_EMPTY');
    if (items.length > (spec.kind === 'tags' ? 50 : spec.kind === 'text' ? 20 : 100)) fail('ARRAY_TOO_LONG');
    items.forEach(scalar);
    if (new Set(items.map(String)).size !== items.length) fail('ARRAY_DUPLICATE');
    return;
  }
  scalar(value);
}

/** normalizeShape: depth 5, a non-empty group of at most 100 children, at most 100 leaves. */
function validateTree(node: WireNode, path = 'filterTree', depth = 1, counter = { leaves: 0 }): void {
  if (depth > 5) invalidTree(path, 'max_depth');
  if (!node || typeof node !== 'object' || Array.isArray(node)) invalidTree(path, 'expected_object');
  if (isWireGroup(node)) {
    const group = node as { op?: unknown; children?: unknown };
    if (group.op !== 'AND' && group.op !== 'OR') invalidTree(path, 'group_operator');
    if (!Array.isArray(group.children) || group.children.length === 0) invalidTree(path, 'empty_group');
    if ((group.children as unknown[]).length > 100) invalidTree(path, 'max_children');
    (group.children as WireNode[]).forEach((child, index) =>
      validateTree(child, `${path}.children[${index}]`, depth + 1, counter),
    );
    return;
  }
  const leaf = node as WireLeaf;
  if (typeof leaf.field !== 'string' || typeof leaf.operator !== 'string') invalidTree(path, 'leaf_shape');
  counter.leaves += 1;
  if (counter.leaves > 100) invalidTree(path, 'max_leaves');
  validateLeaf(leaf, path);
}

/**
 * assertTagConflicts: a tag both required and excluded on one AND path (top-level tagIds join the root AND) is
 * 422 OPPORTUNITY_FILTER_TAGS_CONFLICT with details { tagIds: [...] } (a string array, so it reaches the client).
 */
function assertTagConflicts(body: OpportunitySearchBody): void {
  const top: WireNode[] = body.tagIds?.length ? [{ field: 'tagIds', operator: 'anyOf', value: body.tagIds }] : [];
  const root: WireNode = { op: 'AND', children: [...top, ...(body.filterTree ? [body.filterTree] : [])] };
  const facts = (node: WireNode): { required: string[]; excluded: string[] } => {
    if (isWireGroup(node)) {
      if (node.op === 'OR') return { required: [], excluded: [] };
      return node.children.map(facts).reduce(
        (a, b) => ({ required: [...a.required, ...b.required], excluded: [...a.excluded, ...b.excluded] }),
        { required: [] as string[], excluded: [] as string[] },
      );
    }
    if (node.field !== 'tagIds' || !Array.isArray(node.value)) return { required: [], excluded: [] };
    const ids = (node.value as unknown[]).map(String);
    return node.operator === 'noneOf' ? { required: [], excluded: ids } : { required: ids, excluded: [] };
  };
  const visit = (node: WireNode, inherited: { required: string[]; excluded: string[] }): void => {
    const local = facts(node);
    const required = [...inherited.required, ...local.required];
    const excluded = new Set([...inherited.excluded, ...local.excluded]);
    const conflicts = [...new Set(required.filter((id) => excluded.has(id)))].sort();
    if (conflicts.length) throw new ApiError(422, 'OPPORTUNITY_FILTER_TAGS_CONFLICT', { tagIds: conflicts });
    if (isWireGroup(node)) node.children.forEach((child) => visit(child, { required, excluded: [...excluded] }));
  };
  visit(root, { required: [], excluded: [] });
}

function findStageSnapshot(pipelineId: string, stageId: string): PipelineStageView | undefined {
  const pipeline = PIPELINES_STORE.find((p) => p.id === pipelineId);
  return pipeline?.stages.find((s) => s.id === stageId);
}

function readWireValue(rec: OpportunityRecord, field: string, nowMs: number): string | number | null {
  switch (field) {
    case 'id':
      return rec.id;
    case 'branchId':
      return rec.branchId;
    case 'forecastCategory':
      return rec.forecastCategory ?? null;
    case 'pipelineId':
      return rec.pipelineId;
    case 'stageId':
      return rec.stageId;
    case 'stageFlag':
      return rec.stageFlag;
    case 'stageCategory':
      return findStageSnapshot(rec.pipelineId, rec.stageId)?.category ?? null;
    case 'status':
      return rec.status;
    case 'ownerUserId':
      return rec.ownerUserId;
    case 'ownerTeamId':
      return rec.ownerTeamId;
    case 'createdByUserId':
      return rec.createdByUserId;
    case 'customerProfileId':
      return rec.customerProfileId;
    case 'customerPartyId':
      return rec.customerPartyId;
    case 'customerProfileType':
      return rec.customerProfileType;
    case 'customerStatus':
      return rec.customerStatus;
    case 'contactPartyId':
      return rec.contactPartyId;
    case 'leadId':
      return rec.leadId;
    case 'leadSourceId':
      return rec.leadSourceId;
    case 'title':
      return rec.title;
    case 'description':
      return rec.description;
    case 'amount':
      return rec.amount;
    case 'currencyCode':
      return rec.currencyCode;
    case 'probabilityPercent':
      return rec.probabilityPercent;
    case 'importance':
      return rec.importance;
    case 'cardColor':
      return rec.cardColor;
    case 'expectedCloseDate':
      return rec.expectedCloseDate;
    case 'activityState':
      return rec.activityState;
    case 'nextOpenActivityAt':
      return rec.nextOpenActivityAt;
    case 'openActivityCount':
      return rec.openActivityCount;
    case 'daysInStage': {
      const entered = Date.parse(rec.stageEnteredAt);
      if (Number.isNaN(entered)) return 0;
      return Math.max(0, Math.floor((nowMs - entered) / DAY_MS));
    }
    case 'lostReasonId':
      return rec.lostReasonId;
    case 'winReasonId':
      return rec.winReasonId;
    case 'lostReason':
      return rec.lostReason;
    case 'createdAt':
      return rec.createdAt;
    case 'updatedAt':
      return rec.updatedAt;
    case 'wonAt':
      return rec.wonAt;
    case 'lostAt':
      return rec.lostAt;
    default:
      return null;
  }
}

function parseScaledAmount(value: unknown): bigint | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const negative = raw.startsWith('-');
  const unsigned = negative || raw.startsWith('+') ? raw.slice(1) : raw;
  const match = /^(\d+)(?:\.(\d*))?$/.exec(unsigned);
  if (!match) return null;
  const intStr = match[1];
  const fracStr = (match[2] ?? '').slice(0, 8).padEnd(8, '0');
  const mag = BigInt(intStr) * AMOUNT_SCALE_FACTOR + BigInt(fracStr);
  return negative ? -mag : mag;
}

function toComparable(value: unknown, field: string): number | bigint | string | null {
  if (value === null || value === undefined) return null;
  if (field === 'amount') {
    return parseScaledAmount(value);
  }
  if (DATE_FIELDS.has(field)) {
    const ms = typeof value === 'number' ? value : Date.parse(String(value));
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }
  return null;
}

function evaluateTagLeaf(rec: OpportunityRecord, leaf: WireLeaf): boolean {
  const tagIds = rec.tags.map((t) => t.id);
  const value = leaf.value;
  switch (leaf.operator) {
    case 'isNull':
      return tagIds.length === 0;
    case 'isNotNull':
      return tagIds.length > 0;
    case 'anyOf':
    case 'in': {
      const target = (value as unknown[]).map(String);
      return tagIds.some((id) => target.includes(id));
    }
    case 'allOf': {
      const target = (value as unknown[]).map(String);
      return target.every((id) => tagIds.includes(id));
    }
    case 'noneOf':
    case 'nin': {
      const target = (value as unknown[]).map(String);
      return !tagIds.some((id) => target.includes(id));
    }
    default:
      return false;
  }
}

function evaluateLeaf(rec: OpportunityRecord, leaf: WireLeaf, nowMs: number): boolean {
  if (leaf.field === 'tagIds') {
    return evaluateTagLeaf(rec, leaf);
  }

  const actual = readWireValue(rec, leaf.field, nowMs);
  if (leaf.operator === 'isNull') return actual === null;
  if (leaf.operator === 'isNotNull') return actual !== null;
  if (actual === null) return false;

  const left = toComparable(actual, leaf.field);
  if (left === null) return false;

  switch (leaf.operator) {
    case 'eq':
    case 'is': {
      const right = toComparable(leaf.value, leaf.field);
      return right !== null && left === right;
    }
    case 'neq': {
      const right = toComparable(leaf.value, leaf.field);
      return right !== null && left !== right;
    }
    case 'in':
      return (leaf.value as unknown[]).some((item) => {
        const right = toComparable(item, leaf.field);
        return right !== null && left === right;
      });
    case 'nin':
      return (leaf.value as unknown[]).every((item) => {
        const right = toComparable(item, leaf.field);
        return right !== null && left !== right;
      });
    case 'gte': {
      const right = toComparable(leaf.value, leaf.field);
      return right !== null && left >= right;
    }
    case 'lte': {
      const right = toComparable(leaf.value, leaf.field);
      return right !== null && left <= right;
    }
    case 'gt': {
      const right = toComparable(leaf.value, leaf.field);
      return right !== null && left > right;
    }
    case 'lt': {
      const right = toComparable(leaf.value, leaf.field);
      return right !== null && left < right;
    }
    case 'between': {
      const [minRaw, maxRaw] = leaf.value as [unknown, unknown];
      const min = toComparable(minRaw, leaf.field);
      const max = toComparable(maxRaw, leaf.field);
      return min !== null && max !== null && left >= min && left <= max;
    }
    case 'ilike':
    case 'contains':
      return typeof actual === 'string' && actual.toLowerCase().includes(String(leaf.value).toLowerCase());
    case 'ilikeAny':
      return (
        typeof actual === 'string' &&
        (leaf.value as string[]).some((pattern) => actual.toLowerCase().includes(pattern.toLowerCase()))
      );
    case 'startsWith':
      return typeof actual === 'string' && actual.toLowerCase().startsWith(String(leaf.value).toLowerCase());
    case 'endsWith':
      return typeof actual === 'string' && actual.toLowerCase().endsWith(String(leaf.value).toLowerCase());
    default:
      return false;
  }
}

function evaluateTree(rec: OpportunityRecord, node: WireNode, nowMs: number): boolean {
  if (isWireGroup(node)) {
    return node.op === 'AND'
      ? node.children.every((child) => evaluateTree(rec, child, nowMs))
      : node.children.some((child) => evaluateTree(rec, child, nowMs));
  }
  return evaluateLeaf(rec, node, nowMs);
}

/**
 * OpportunitySearchFiltersDto + normalizeOpportunityFilters, in pipe-then-service order: branchId (400
 * CRM_VALIDATION_FAILED), searchField, tagIds shape, then the tree (INVALID_FILTER_TREE / INVALID_FIELD /
 * INVALID_OPERATOR_VALUE), then tag conflicts (422), then the sort field (400 INVALID_FIELD, safeSortBy).
 */
function assertSearchFilters(body: OpportunitySearchBody): void {
  assertBranchId(body.branchId);
  if (body.searchField !== undefined && !['opportunity', 'customer', 'email', 'phone'].includes(body.searchField)) {
    throw validationFailed({ searchField: ['is_in'] });
  }
  if (body.tagIds !== undefined) {
    if (!Array.isArray(body.tagIds)) throw validationFailed({ tagIds: ['is_array'] });
    if (body.tagIds.length === 0) throw validationFailed({ tagIds: ['array_not_empty'] });
    if (body.tagIds.length > OPPORTUNITY_LIMITS.tags) throw validationFailed({ tagIds: ['array_max_size'] });
    if (new Set(body.tagIds).size !== body.tagIds.length) throw validationFailed({ tagIds: ['array_unique'] });
  }
  if (body.filterTree !== undefined) validateTree(body.filterTree);
  assertTagConflicts(body);
  parseSort(body.sort);
}

function filterOpportunities(body: OpportunitySearchBody): OpportunityRecord[] {
  const nowMs = Date.now();
  return opportunities.filter((rec) => {
    if (!matchesBranch(rec, body.branchId)) return false;
    if (body.search !== undefined && !matchesSearch(rec, body.search, body.searchField)) return false;
    if (body.tagIds && body.tagIds.length > 0 && !rec.tags.some((t) => body.tagIds!.includes(t.id))) {
      return false;
    }
    if (body.filterTree && !evaluateTree(rec, body.filterTree, nowMs)) return false;
    return true;
  });
}

function compareNullableField(a: OpportunityRecord, b: OpportunityRecord, field: string, dir: 'ASC' | 'DESC'): number {
  const factor = dir === 'ASC' ? 1 : -1;
  switch (field) {
    case 'amount': {
      const av = a.amount !== null ? parseScaledAmount(a.amount) : null;
      const bv = b.amount !== null ? parseScaledAmount(b.amount) : null;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return av === bv ? 0 : av < bv ? -factor : factor;
    }
    case 'expectedCloseDate':
    case 'createdAt':
    case 'updatedAt':
    case 'wonAt':
    case 'lostAt':
    case 'nextOpenActivityAt': {
      const rawA = a[field];
      const rawB = b[field];
      if (!rawA && !rawB) return 0;
      if (!rawA) return 1;
      if (!rawB) return -1;
      const diff = Date.parse(rawA) - Date.parse(rawB);
      return diff === 0 ? 0 : (diff < 0 ? -1 : 1) * factor;
    }
    case 'probabilityPercent': {
      const av = a.probabilityPercent;
      const bv = b.probabilityPercent;
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * factor;
    }
    case 'stageEnteredAt': {
      const diff = Date.parse(a.stageEnteredAt) - Date.parse(b.stageEnteredAt);
      return diff === 0 ? 0 : (diff < 0 ? -1 : 1) * factor;
    }
    case 'importance':
      return (a.importance - b.importance) * factor;
    case 'openActivityCount':
      return (a.openActivityCount - b.openActivityCount) * factor;
    case 'title':
      return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) * factor;
    case 'customerDisplayName':
      return (a.customerDisplayName ?? '').localeCompare(b.customerDisplayName ?? '', undefined, { sensitivity: 'base' }) * factor;
    default:
      return 0;
  }
}

/** OPPORTUNITY_SORT_FIELDS (opportunities.service.ts); `importance DESC` always leads. */
const SORT_FIELDS = new Set([
  'title', 'amount', 'probabilityPercent', 'expectedCloseDate', 'createdAt', 'updatedAt', 'stageEnteredAt',
]);

/**
 * search-sort.ts searchSort: only the first token counts; no field = createdAt; no direction = ASC;
 * a field outside the whitelist is 400 INVALID_FIELD { field: [field] }.
 */
function parseSort(sort: string | undefined): { field: string; dir: 'ASC' | 'DESC' } {
  const firstToken = sort?.split(',')[0]?.trim();
  if (!firstToken) return { field: 'createdAt', dir: 'ASC' };
  const [rawField, rawDir] = firstToken.split(':');
  const field = rawField?.trim() || 'createdAt';
  if (!SORT_FIELDS.has(field)) throw new ApiError(400, 'INVALID_FIELD', { field: [field] });
  return { field, dir: rawDir?.trim().toUpperCase() === 'DESC' ? 'DESC' : 'ASC' };
}

function sortOpportunities(records: OpportunityRecord[], sort?: string): OpportunityRecord[] {
  const { field, dir } = parseSort(sort);
  return records.slice().sort((a, b) => {
    // importance DESC is always first.
    if (a.importance !== b.importance) {
      return b.importance - a.importance;
    }
    const cmp = compareNullableField(a, b, field, dir);
    if (cmp !== 0) return cmp;
    return a.id.localeCompare(b.id);
  });
}

function pageOf<T>(all: T[], page: number, limit: number): Page<T> {
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.max(1, Math.floor(limit));
  const totalPages = Math.max(1, Math.ceil(all.length / safeLimit));
  return {
    items: all.slice((safePage - 1) * safeLimit, safePage * safeLimit),
    total: all.length,
    page: safePage,
    limit: safeLimit,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };
}

function summarizeLane(items: readonly OpportunityRecord[]): {
  summary: LaneSummary;
  activitySummary: ActivitySummary;
} {
  const totalsByCurrency = new Map<string, string>();
  const activitySummary: ActivitySummary = {
    totalCount: items.length,
    noOpenCount: 0,
    overdueCount: 0,
    todayCount: 0,
    futureCount: 0,
  };

  for (const item of items) {
    if (item.amount !== null) {
      const code = item.currencyCode?.trim() || 'UNSPECIFIED';
      const prev = totalsByCurrency.get(code) ?? '0.00000000';
      totalsByCurrency.set(code, addDecimalStrings(prev, item.amount));
    }
    switch (item.activityState) {
      case 'NO_OPEN':
        activitySummary.noOpenCount += 1;
        break;
      case 'OVERDUE':
        activitySummary.overdueCount += 1;
        break;
      case 'TODAY':
        activitySummary.todayCount += 1;
        break;
      case 'FUTURE':
        activitySummary.futureCount += 1;
        break;
    }
  }

  const amountsByCurrency: CurrencyAmount[] = Array.from(totalsByCurrency.entries())
    .sort(([a], [b]) => {
      if (a === 'UNSPECIFIED') return 1;
      if (b === 'UNSPECIFIED') return -1;
      return a.localeCompare(b);
    })
    .map(([currencyCode, amount]) => ({ currencyCode, amount }));

  return {
    summary: {
      totalCount: items.length,
      amountsByCurrency,
    },
    activitySummary,
  };
}

function encodeCursor(stageId: string, offset: number): string {
  return `v1:${stageId}:${offset}`;
}

function decodeCursor(cursor: string, expectedStageId: string): number {
  const match = /^v1:([^:]+):(\d+)$/.exec(cursor.trim());
  if (!match || match[1] !== expectedStageId) {
    throw new ApiError(400, 'OPPORTUNITY_BOARD_CURSOR_INVALID');
  }
  const offset = Number.parseInt(match[2], 10);
  if (!Number.isFinite(offset) || offset < 0) {
    throw new ApiError(400, 'OPPORTUNITY_BOARD_CURSOR_INVALID');
  }
  return offset;
}

function assertIsoDate(value: string, field: string): void {
  const match = ISO_DATE_RE.exec(value);
  if (!match) {
    throw validationFailed({ [field]: ['matches'] });
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw validationFailed({ [field]: ['is_date_string'] });
  }
}

function normalizeAmount(raw: string): string {
  const trimmed = raw.trim();
  if (!AMOUNT_FORMAT_RE.test(trimmed)) {
    throw validationFailed({ amount: ['matches'] });
  }
  const [intPart, fracPart = ''] = trimmed.split('.');
  const cleanInt = intPart.replace(/^0+(?=\d)/, '') || '0';
  return `${cleanInt}.${fracPart.padEnd(8, '0')}`;
}

/**
 * DTO shape of amount/currencyCode (400): amount `^\\d{1,16}(\\.\\d{1,8})?$` (a JSON number with at most 3 decimals is
 * accepted and stringified), currencyCode three upper-case letters after trim + upper-case.
 * Returns the normalised values; `undefined` = not sent.
 */
function amountDto(amount: unknown): string | null | undefined {
  if (amount === undefined || amount === null) return amount;
  const raw = typeof amount === 'number' && amount >= 0 && Number.isFinite(amount) && Number.isInteger(amount * 1000)
    ? String(amount)
    : amount;
  if (typeof raw !== 'string') throw validationFailed({ amount: ['is_string'] });
  return normalizeAmount(raw);
}

function currencyDto(currencyCode: unknown): string | null | undefined {
  if (currencyCode === undefined || currencyCode === null) return currencyCode;
  if (typeof currencyCode !== 'string') throw validationFailed({ currencyCode: ['is_string'] });
  const code = currencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw validationFailed({ currencyCode: ['matches'] });
  return code;
}

/** assertOpportunityAmountCurrency: 422 when an amount is set without a currency. Any ISO code is accepted. */
function assertAmountCurrency(amount: string | null | undefined, currencyCode: string | null | undefined): void {
  if (amount != null && !currencyCode?.trim()) {
    throw new ApiError(422, 'OPPORTUNITY_AMOUNT_CURRENCY_REQUIRED');
  }
}

function validateImportanceAndProbability(importance: number | undefined, probabilityPercent: number | null | undefined): void {
  if (importance !== undefined) {
    if (!Number.isInteger(importance) || importance < 0 || importance > 3) {
      throw validationFailed({ importance: ['is_int'] });
    }
  }
  if (probabilityPercent !== undefined && probabilityPercent !== null) {
    if (
      !Number.isInteger(probabilityPercent) ||
      probabilityPercent < OPPORTUNITY_LIMITS.probabilityMin ||
      probabilityPercent > OPPORTUNITY_LIMITS.probabilityMax
    ) {
      throw validationFailed({ probabilityPercent: ['is_int'] });
    }
  }
}

function validateCardColor(cardColor: CardColor | null | undefined): void {
  if (cardColor !== undefined && cardColor !== null) {
    if (typeof cardColor !== 'string' || !(cardColor in CARD_COLORS)) {
      throw validationFailed({ cardColor: ['is_enum'] });
    }
  }
}

function findCustomerOrThrow(customerProfileId: string): CustomerDetail {
  const customer = CUSTOMERS_FAKE_DB.find((c) => c.id === customerProfileId);
  if (!customer) {
    throw new ApiError(404, 'CUSTOMER_PROFILE_NOT_FOUND');
  }
  return customer;
}

function resolveCustomerContact(customer: CustomerDetail, contactPartyId: string | null | undefined): OpportunityRow['primaryContact'] {
  if (!contactPartyId) {
    return customerContactsForSeed(customer);
  }
  const match = customer.contacts.find((c) => c.partyId === contactPartyId);
  if (match) {
    return {
      partyId: match.partyId,
      displayName: match.displayName,
      jobTitle: match.jobTitle,
      isPrimary: match.isPrimary,
      email: match.email,
      phones: [...match.phones],
    };
  }
  if (customer.profileType === 'INDIVIDUAL' && customer.partyId === contactPartyId) {
    return {
      partyId: customer.partyId,
      displayName: customer.displayName,
      jobTitle: null,
      isPrimary: true,
      email: customer.email,
      phones: [...customer.phones],
    };
  }
  throw new ApiError(422, 'OPPORTUNITY_CONTACT_CUSTOMER_MISMATCH');
}

/** AttachRecordTagsDto / CreateOpportunityDto.tagIds: array, at most 50, unique (400). */
function assertTagIdsDto(tagIds: unknown, required: boolean): void {
  if (tagIds === undefined && !required) return;
  if (!Array.isArray(tagIds)) throw validationFailed({ tagIds: ['is_array'] });
  if (required && tagIds.length === 0) throw validationFailed({ tagIds: ['array_not_empty'] });
  if (tagIds.length > OPPORTUNITY_LIMITS.tags) throw validationFailed({ tagIds: ['array_max_size'] });
  if (new Set(tagIds.map((id) => String(id).toLowerCase())).size !== tagIds.length) {
    throw validationFailed({ tagIds: ['array_unique'] });
  }
}

/** TagsService catalogue lookup: unknown ids are 422 CRM_TAG_UNKNOWN with details { tagIds: [unknown ids] }. */
async function resolveTagsByIds(tagIds: string[] | undefined): Promise<OpportunityTag[]> {
  if (!tagIds || tagIds.length === 0) return [];
  const byId = await tagCatalogById();
  const unknown = tagIds.filter((id) => !byId.has(id));
  if (unknown.length > 0) {
    throw new ApiError(422, 'CRM_TAG_UNKNOWN', { tagIds: unknown });
  }
  return tagIds
    .map((id) => byId.get(id)!)
    .map((found) => ({
      id: found.id,
      name: found.name,
      backgroundColor: found.backgroundColor,
      textColor: found.textColor,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

/**
 * reason-enforcement.ts transitionReason + applyStageTransition, in backend order:
 * LOSS kind first, then WIN kind; a supplied id whose kind does not apply to the target status is
 * 422 CRM_REASON_KIND_MISMATCH; a changed id must exist and be active (422 CRM_REASON_UNAVAILABLE, checked before the
 * kind) and be of that kind (422 CRM_REASON_KIND_MISMATCH); an unchanged stored id is not re-validated. Only after
 * both: LOST needs a governed reason or a non-blank note (422 OPPORTUNITY_LOST_REASON_REQUIRED). The stored
 * lostReason is the trimmed note only (never the reason name); the name travels in lostReasonRef.
 */
async function resolveMoveReasons(
  existing: OpportunityRecord,
  targetFlag: OpportunityStageFlag,
  body: Pick<MoveStageBody, 'lostReason' | 'lostReasonId' | 'winReasonId'>,
): Promise<{
  lostReason: string | null;
  lostReasonId: string | null;
  lostReasonRef: { id: string; nameAr: string; nameEn: string } | null;
  winReasonId: string | null;
  winReason: { id: string; nameAr: string; nameEn: string } | null;
}> {
  const status = statusOfFlag(targetFlag);
  const enteredLost = status === 'LOST' && existing.status !== 'LOST';
  const enteredWon = status === 'WON' && existing.status !== 'WON';
  // Settings reasons with `active` omitted = every reason, active and inactive (ListGovernedReasonsDto).
  const catalog = (await fakeGetReasons({})).items;

  const transition = (
    kind: 'LOSS' | 'WIN',
    applies: boolean,
    entering: boolean,
    reasonId: string | undefined,
    current: string | null,
  ): { id: string; nameAr: string; nameEn: string } | null => {
    if (!applies) {
      if (reasonId) throw new ApiError(422, 'CRM_REASON_KIND_MISMATCH');
      return null;
    }
    const id = reasonId ?? (entering ? null : current);
    if (!id) return null;
    const found = catalog.find((r) => r.id === id);
    if (reasonId && reasonId !== current) {
      if (!found?.isActive) throw new ApiError(422, 'CRM_REASON_UNAVAILABLE');
      if (found.reasonKind !== kind) throw new ApiError(422, 'CRM_REASON_KIND_MISMATCH');
    }
    return found ? { id: found.id, nameAr: found.nameAr, nameEn: found.nameEn } : null;
  };

  const lostRef = transition('LOSS', status === 'LOST', enteredLost, body.lostReasonId, existing.lostReasonId);
  const winRef = transition('WIN', status === 'WON', enteredWon, body.winReasonId, existing.winReasonId);
  const note = enteredLost ? body.lostReason?.trim() || null : status === 'LOST' ? existing.lostReason : null;
  if (status === 'LOST' && !lostRef && !note) {
    throw new ApiError(422, 'OPPORTUNITY_LOST_REASON_REQUIRED');
  }
  return {
    lostReason: status === 'LOST' ? note : null,
    lostReasonId: lostRef?.id ?? null,
    lostReasonRef: lostRef,
    winReasonId: winRef?.id ?? null,
    winReason: winRef,
  };
}

/** applyStageTransition: entering WON or reopening a closed deal is refused for a blacklisted customer (409). */
function assertNotBlacklistedTransition(existing: OpportunityRecord, targetFlag: OpportunityStageFlag): void {
  const customer = CUSTOMERS_FAKE_DB.find((c) => c.id === existing.customerProfileId);
  const status = statusOfFlag(targetFlag);
  const enteredWon = status === 'WON' && existing.status !== 'WON';
  const wasTerminal = existing.status === 'WON' || existing.status === 'LOST';
  const isReopened = wasTerminal && status !== 'WON' && status !== 'LOST';
  if (customer?.status === 'BLACKLISTED' && (enteredWon || isReopened)) {
    throw new ApiError(409, 'CUSTOMER_PROFILE_BLACKLISTED');
  }
}

function applyStageTransition(
  existing: OpportunityRecord,
  targetPipeline: PipelineView,
  targetStage: PipelineStageView,
  resolved: Awaited<ReturnType<typeof resolveMoveReasons>>,
  historyReason: string | null,
): OpportunityRecord {
  const nextStatus = statusOfFlag(targetStage.flag);
  const nowIso = nextUpdatedAt(existing.updatedAt);
  const fromPipeline = PIPELINES_STORE.find((p) => p.id === existing.pipelineId) ?? targetPipeline;
  const fromStage = fromPipeline.stages.find((s) => s.id === existing.stageId) ?? null;

  const updated: OpportunityRecord = {
    ...existing,
    pipelineId: targetPipeline.id,
    stageId: targetStage.id,
    stageFlag: targetStage.flag,
    status: nextStatus,
    wonAt: nextStatus === 'WON' ? (existing.status === 'WON' ? existing.wonAt : nowIso) : null,
    lostAt: nextStatus === 'LOST' ? (existing.status === 'LOST' ? existing.lostAt : nowIso) : null,
    lostReason: nextStatus === 'LOST' ? resolved.lostReason : null,
    lostReasonId: nextStatus === 'LOST' ? resolved.lostReasonId : null,
    lostReasonRef: nextStatus === 'LOST' ? resolved.lostReasonRef : null,
    winReasonId: nextStatus === 'WON' ? resolved.winReasonId : null,
    winReason: nextStatus === 'WON' ? resolved.winReason : null,
    stageEnteredAt: nowIso,
    updatedAt: nowIso,
  };

  opportunities = opportunities.map((item) => (item.id === existing.id ? updated : item));

  const currentHistory = seedHistoryMap.get(existing.id) ?? [];
  const actor = OWNER_BY_ID.get(existing.ownerUserId ?? '') ?? FAKE_OWNERS[0];
  const entry: StageHistoryItem = {
    id: fakeId(),
    fromStageId: existing.stageId,
    toStageId: targetStage.id,
    fromStatus: existing.status,
    toStatus: nextStatus,
    changedAt: nowIso,
    changedByUserId: actor.id,
    changedByDisplayName: actor.displayName,
    changedByAvatarUrl: actor.avatarUrl,
    // history.reason = input.reason ?? input.lostReason (as sent, not trimmed)
    reason: historyReason ?? null,
    fromStageSnapshot: fromStage ? stageSnapshotOf(fromPipeline, fromStage) : null,
    toStageSnapshot: stageSnapshotOf(targetPipeline, targetStage),
  };
  seedHistoryMap.set(existing.id, [...currentHistory, entry]);

  return updated;
}

export async function fakeListPipelines(): Promise<PipelineView[]> {
  await oppDelay();
  return clone(
    PIPELINES_STORE.filter((p) => p.isActive).sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.nameEn.localeCompare(b.nameEn);
    }),
  );
}

export async function fakeGetPipeline(id: string): Promise<PipelineView> {
  await oppDelay();
  const pipeline = PIPELINES_STORE.find((p) => p.id === id && p.isActive);
  if (!pipeline) {
    throw new ApiError(404, 'PIPELINE_NOT_FOUND');
  }
  return clone(pipeline);
}

export async function fakeLoadBoard(pipelineId: string, body: BoardBody): Promise<BoardResponse> {
  await oppDelay();
  assertSearchFilters(body);
  if (body.limitPerStage !== undefined && body.limitPerStage !== 0 && body.limitPerStage !== BOARD_LIMIT) {
    throw validationFailed({ limitPerStage: ['is_in'] });
  }
  const pipeline = PIPELINES_STORE.find((p) => p.id === pipelineId && p.isActive);
  if (!pipeline) {
    throw new ApiError(404, 'PIPELINE_NOT_FOUND');
  }

  const matched = sortOpportunities(
    filterOpportunities(body).filter((rec) => rec.pipelineId === pipeline.id),
    body.sort,
  );

  const stages: BoardStage[] = pipeline.stages
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .filter((stage) => stage.isActive || matched.some((rec) => rec.stageId === stage.id))
    .map((stage) => {
      const laneRecords = matched.filter((rec) => rec.stageId === stage.id);
      const { summary, activitySummary } = summarizeLane(laneRecords);
      const limit = body.limitPerStage;
      const items = limit === 0 ? [] : laneRecords.slice(0, limit).map((rec) => toBoardRow(rec, body.branchId));
      const hasMore = limit === 0 ? laneRecords.length > 0 : laneRecords.length > limit;
      return {
        stage: clone(stage),
        items,
        summary,
        activitySummary,
        pageInfo: {
          limit,
          hasMore,
          nextCursor: limit > 0 && hasMore ? encodeCursor(stage.id, limit) : null,
        },
      };
    });

  return {
    pipeline: clone(pipeline),
    stages,
  };
}

export async function fakeLoadStagePage(
  pipelineId: string,
  stageId: string,
  body: StagePageBody,
): Promise<StagePageResponse> {
  await oppDelay();
  assertSearchFilters(body);
  if (body.limit !== undefined && body.limit !== BOARD_LIMIT) throw validationFailed({ limit: ['is_in'] });
  assertOptionalText(body.cursor, 'cursor', 1024);
  const pipeline = PIPELINES_STORE.find((p) => p.id === pipelineId && p.isActive);
  const stage = pipeline?.stages.find((s) => s.id === stageId);
  if (!pipeline || !stage) {
    throw new ApiError(404, 'PIPELINE_STAGE_NOT_FOUND');
  }

  const offset = body.cursor ? decodeCursor(body.cursor, stageId) : 0;
  const laneRecords = sortOpportunities(
    filterOpportunities(body).filter((rec) => rec.pipelineId === pipeline.id && rec.stageId === stageId),
    body.sort,
  );

  const { summary, activitySummary } = summarizeLane(laneRecords);
  const limit = body.limit || BOARD_LIMIT;
  const items = laneRecords.slice(offset, offset + limit).map((rec) => toBoardRow(rec, body.branchId));
  const nextOffset = offset + items.length;
  const hasMore = nextOffset < laneRecords.length;

  return {
    stageId,
    items,
    summary,
    activitySummary,
    pageInfo: {
      limit,
      hasMore,
      nextCursor: hasMore ? encodeCursor(stageId, nextOffset) : null,
    },
  };
}

export async function fakeSelectOpportunities(
  body: OpportunitySearchBody,
  limit = SELECTION_CAP,
): Promise<{ items: SelectedOpportunity[]; total: number; truncated: boolean }> {
  await oppDelay();
  assertSearchFilters(body);
  // OpportunitySelectionDto: @IsInt @Min(1) limit (400); the service refuses > 10 000 with 422.
  if (!Number.isInteger(limit) || limit < 1) throw validationFailed({ limit: ['min'] });
  if (limit > SELECTION_CAP) throw new ApiError(422, 'OPPORTUNITY_SELECTION_TOO_LARGE');
  const matched = sortOpportunities(filterOpportunities(body), body.sort);
  const cap = limit;
  const items: SelectedOpportunity[] = matched.slice(0, cap).map((rec) => ({
    id: rec.id,
    title: rec.title,
    ownerUserId: rec.ownerUserId,
    stageId: rec.stageId,
    status: rec.status,
    updatedAt: rec.updatedAt,
  }));
  return {
    items,
    total: matched.length,
    truncated: matched.length > cap,
  };
}

/** Fake-data helper for opportunity-bulk's fake module: every stored row in the list projection. Not an HTTP mirror. */
export function fakeAllOpportunityRows(): OpportunityRow[] {
  return opportunities.map((rec) => toListRow(rec));
}

export async function fakeSearchOpportunities(
  body: OpportunitySearchBody,
  page: number,
  limit: number,
): Promise<Page<OpportunityRow>> {
  await oppDelay();
  assertSearchFilters(body);
  const matched = sortOpportunities(filterOpportunities(body), body.sort);
  return pageOf(
    matched.map((rec) => toListRow(rec, body.branchId)),
    page,
    limit,
  );
}

export async function fakeListCustomerOpportunities(
  branchId: string,
  customerProfileId: string,
  page: number,
  limit: number,
): Promise<Page<OpportunityRow>> {
  await oppDelay();
  const matched = sortOpportunities(
    opportunities.filter((rec) => matchesBranch(rec, branchId) && rec.customerProfileId === customerProfileId),
  );
  return pageOf(
    matched.map((rec) => toListRow(rec, branchId)),
    page,
    limit,
  );
}

export async function fakeGetOpportunity(id: string): Promise<OpportunityRow> {
  await oppDelay();
  const found = opportunities.find((rec) => rec.id === id);
  if (!found) {
    throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND');
  }
  return toDetailRow(found);
}

/** CreateOpportunityDto, checked as the ValidationPipe does: every constraint before any service code (400). */
function assertCreateDto(body: CreateOpportunityBody): void {
  const raw = body as unknown as Record<string, unknown>;
  for (const field of ['branchId', 'customerProfileId', 'pipelineId', 'stageId'] as const) {
    if (typeof raw[field] !== 'string' || !(raw[field] as string).trim()) throw validationFailed({ [field]: ['is_uuid'] });
  }
  for (const field of ['leadId', 'contactPartyId', 'ownerUserId'] as const) {
    if (raw[field] !== undefined && (typeof raw[field] !== 'string' || !(raw[field] as string).trim())) {
      throw validationFailed({ [field]: ['is_uuid'] });
    }
  }
  if (typeof body.title !== 'string') throw validationFailed({ title: ['is_string'] });
  if (!body.title.trim()) throw validationFailed({ title: ['is_not_empty'] });
  if (body.title.trim().length > OPPORTUNITY_LIMITS.title) throw validationFailed({ title: ['max_length'] });
  validateImportanceAndProbability(body.importance, body.probabilityPercent);
  amountDto(body.amount);
  assertOptionalText(body.description, 'description', OPPORTUNITY_LIMITS.description);
  currencyDto(body.currencyCode);
  if (body.expectedCloseDate !== undefined) assertIsoDate(body.expectedCloseDate, 'expectedCloseDate');
  validateCardColor(body.cardColor);
  assertTagIdsDto(body.tagIds, false);
  if (body.customFields !== undefined && (typeof body.customFields !== 'object' || body.customFields === null)) {
    throw validationFailed({ customFields: ['is_object'] });
  }
}

/**
 * POST /crm/opportunities, in OpportunitiesService.create order: DTO (400) -> x-idempotency-key UUIDv7
 * (400 OPPORTUNITY_CREATE_IDEMPOTENCY_INVALID) -> amount needs currency (422) -> create scope (403) -> replay or
 * 409 OPPORTUNITY_CREATE_IDEMPOTENCY_MISMATCH -> customer (404) -> lead (422) -> contact (422) -> blacklisted (409)
 * -> owner (422) -> stage (404) -> terminal stage (422) -> tags (422 CRM_TAG_UNKNOWN).
 * Without a currency the backend falls back to the workspace default currency (or null); the fake has no
 * workspace default, so it stores null. Description and contactPartyId are stored as sent.
 */
/** Create without a currency stores the workspace default (opportunities.service.ts resolveWorkspaceDefaultCurrencyOrNull). */
async function workspaceDefaultCurrencyOrNull(): Promise<string | null> {
  try {
    return (await fakeGetWorkspaceSettings()).defaultCurrencyCode;
  } catch {
    return null;
  }
}

export async function fakeCreateOpportunity(
  body: CreateOpportunityBody,
  idempotencyKey: string,
): Promise<OpportunityRow> {
  await oppDelay();
  assertCreateDto(body);
  if (typeof idempotencyKey !== 'string' || !UUID_V7_RE.test(idempotencyKey)) {
    throw new ApiError(400, 'OPPORTUNITY_CREATE_IDEMPOTENCY_INVALID');
  }
  const amount = amountDto(body.amount) ?? null;
  const currencyCode = currencyDto(body.currencyCode) ?? null;
  assertAmountCurrency(amount, currencyCode);

  if (FAKE_OPPORTUNITY_READ_ONLY) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }

  const key = idempotencyKey.toLowerCase();
  const bodyKey = canonicalJson(body);
  const existingIdem = idempotencyStore.get(key);
  if (existingIdem) {
    if (existingIdem.bodyKey !== bodyKey) {
      throw new ApiError(409, 'OPPORTUNITY_CREATE_IDEMPOTENCY_MISMATCH');
    }
    return clone(existingIdem.result);
  }

  const customer = findCustomerOrThrow(body.customerProfileId);
  if (body.leadId && customer.sourceLeadId && body.leadId !== customer.sourceLeadId) {
    throw new ApiError(422, 'OPPORTUNITY_LEAD_CUSTOMER_MISMATCH');
  }
  const primaryContact = resolveCustomerContact(customer, body.contactPartyId);
  if (customer.status === 'BLACKLISTED') {
    throw new ApiError(409, 'CUSTOMER_PROFILE_BLACKLISTED');
  }

  const ownerId = body.ownerUserId?.trim() || null;
  let owner: FakeOwner | null = null;
  if (ownerId) {
    owner = OWNER_BY_ID.get(ownerId) ?? null;
    if (!owner) {
      throw new ApiError(422, 'OPPORTUNITY_OWNER_INELIGIBLE');
    }
  }

  const pipeline = PIPELINES_STORE.find((p) => p.id === body.pipelineId && p.isActive);
  const stage = pipeline?.stages.find((s) => s.id === body.stageId && s.isActive);
  if (!pipeline || !stage) {
    throw new ApiError(404, 'PIPELINE_STAGE_NOT_FOUND');
  }
  if (stage.flag === 'WON' || stage.flag === 'LOST') {
    throw new ApiError(422, 'OPPORTUNITY_CREATE_STAGE_TERMINAL');
  }

  const tags = await resolveTagsByIds(body.tagIds);
  const storedCurrencyCode = currencyCode ?? (await workspaceDefaultCurrencyOrNull());
  const nowIso = nextUpdatedAt();
  const id = fakeId();

  const created: OpportunityRecord = {
    id,
    branchId: body.branchId,
    customerProfileId: customer.id,
    customerPartyId: customer.partyId,
    leadId: body.leadId ?? null,
    contactPartyId: body.contactPartyId ?? null,
    pipelineId: pipeline.id,
    stageId: stage.id,
    stageFlag: stage.flag,
    status: statusOfFlag(stage.flag),
    title: body.title.trim(),
    importance: body.importance ?? 0,
    cardColor: body.cardColor ?? null,
    amount,
    currencyCode: storedCurrencyCode,
    description: body.description ?? null,
    expectedCloseDate: body.expectedCloseDate ?? null,
    probabilityPercent: body.probabilityPercent ?? null,
    ownerUserId: owner?.id ?? null,
    wonAt: null,
    lostAt: null,
    lostReason: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    customerProfileType: customer.profileType,
    customerDisplayName: customer.displayName,
    customerCompanyName: customer.companyName,
    customerPhone: customerPrimaryPhone(customer),
    customerEmail: customerPrimaryEmail(customer),
    customerCountry: customer.address?.country ?? null,
    customerCity: customer.address?.city ?? null,
    primaryContact,
    leadSourceName: customer.acquisitionSource?.nameEn ?? null,
    leadSourceIconUrl: customer.acquisitionSourceIconUrl,
    ownerDisplayName: owner?.displayName ?? null,
    ownerAvatarUrl: owner?.avatarUrl ?? null,
    openActivityCount: 0,
    nextOpenActivityAt: null,
    activityState: 'NO_OPEN',
    tags,
    winReason: null,
    lostReasonRef: null,
    stageEnteredAt: nowIso,
    customFields: body.customFields ? clone(body.customFields) : {},
    ownerTeamId: owner?.teamId ?? null,
    createdByUserId: FAKE_OWNERS[0].id,
    customerStatus: customer.status,
    leadSourceId: customer.acquisitionSourceId,
    lostReasonId: null,
    winReasonId: null,
    isSeeded: false,
  };

  opportunities = [created, ...opportunities];
  const actor = FAKE_OWNERS[0];
  seedHistoryMap.set(id, [
    {
      id: fakeId(),
      fromStageId: null,
      toStageId: stage.id,
      fromStatus: null,
      toStatus: created.status,
      changedAt: nowIso,
      changedByUserId: actor.id,
      changedByDisplayName: actor.displayName,
      changedByAvatarUrl: actor.avatarUrl,
      reason: null,
      fromStageSnapshot: null,
      toStageSnapshot: stageSnapshotOf(pipeline, stage),
    },
  ]);

  const result = toDetailRow(created);
  idempotencyStore.set(key, { bodyKey, result: clone(result) });
  return result;
}

/** UpdateOpportunityDto as the pipe sees it (400), including its null rules. */
function assertUpdateDto(body: UpdateOpportunityBody): void {
  assertExpectedUpdatedAt(body.expectedUpdatedAt);
  if (body.title !== undefined) {
    if (typeof body.title !== 'string') throw validationFailed({ title: ['is_string'] });
    if (!body.title.trim()) throw validationFailed({ title: ['is_not_empty'] });
    if (body.title.trim().length > OPPORTUNITY_LIMITS.title) throw validationFailed({ title: ['max_length'] });
  }
  validateImportanceAndProbability(body.importance, body.probabilityPercent);
  validateCardColor(body.cardColor);
  amountDto(body.amount);
  if (body.description !== null) assertOptionalText(body.description, 'description', OPPORTUNITY_LIMITS.description);
  // currencyCode: null is accepted only together with `amount: null` in the same PATCH.
  if (body.currencyCode === null && body.amount !== null) throw validationFailed({ currencyCode: ['is_string'] });
  currencyDto(body.currencyCode);
  // ownerUserId: `@ValidateIf(v !== undefined) @IsUUID('7')`, so null is refused (an owner cannot be cleared).
  if (body.ownerUserId !== undefined && (typeof body.ownerUserId !== 'string' || !body.ownerUserId.trim())) {
    throw validationFailed({ ownerUserId: ['is_uuid'] });
  }
  if (body.contactPartyId != null && (typeof body.contactPartyId !== 'string' || !body.contactPartyId.trim())) {
    throw validationFailed({ contactPartyId: ['is_uuid'] });
  }
  if (body.expectedCloseDate != null) assertIsoDate(body.expectedCloseDate, 'expectedCloseDate');
  if (body.customFields !== undefined && (typeof body.customFields !== 'object' || body.customFields === null)) {
    throw validationFailed({ customFields: ['is_object'] });
  }
}

/**
 * PATCH /crm/opportunities/:id, in OpportunitiesService.update order: DTO (400) -> not found (404) -> update scope
 * (403) -> amount needs currency, merged with the stored values, only when either is sent (422) -> owner (422) ->
 * contact (422) -> expectedUpdatedAt (409 CRM.OPPORTUNITY.CONCURRENT_UPDATE). The expectedUpdatedAt check itself
 * bumps updatedAt (its UPDATE ... SET updated_at), even when nothing else changes.
 */
export async function fakePatchOpportunity(id: string, body: UpdateOpportunityBody): Promise<OpportunityRow> {
  await oppDelay();
  assertUpdateDto(body);
  const existing = opportunities.find((rec) => rec.id === id);
  if (!existing) {
    throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND');
  }
  if (FAKE_OPPORTUNITY_READ_ONLY) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }

  const sentAmount = amountDto(body.amount);
  const sentCurrency = currencyDto(body.currencyCode);
  const nextAmount = sentAmount !== undefined ? sentAmount : existing.amount;
  const nextCurrency = sentCurrency !== undefined ? sentCurrency : existing.currencyCode;
  if (sentAmount !== undefined || sentCurrency !== undefined) {
    assertAmountCurrency(nextAmount, nextCurrency);
  }

  let owner: FakeOwner | null = null;
  if (body.ownerUserId !== undefined) {
    owner = OWNER_BY_ID.get(body.ownerUserId.trim()) ?? null;
    if (!owner) {
      throw new ApiError(422, 'OPPORTUNITY_OWNER_INELIGIBLE');
    }
  }

  const customer = findCustomerOrThrow(existing.customerProfileId);
  let nextContactId = existing.contactPartyId;
  let nextPrimaryContact = existing.primaryContact;
  if (body.contactPartyId !== undefined) {
    if (body.contactPartyId === null) {
      nextContactId = null;
      nextPrimaryContact = customerContactsForSeed(customer);
    } else {
      nextPrimaryContact = resolveCustomerContact(customer, body.contactPartyId);
      nextContactId = body.contactPartyId;
    }
  }

  if (body.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== existing.updatedAt) {
    throw new ApiError(409, 'CRM.OPPORTUNITY.CONCURRENT_UPDATE');
  }

  const nextCustomFields = { ...existing.customFields };
  if (body.customFields !== undefined) {
    for (const [key, val] of Object.entries(body.customFields)) {
      if (val === null || val === undefined) {
        delete nextCustomFields[key];
      } else {
        nextCustomFields[key] = val;
      }
    }
  }

  const updated: OpportunityRecord = {
    ...existing,
    title: body.title !== undefined ? body.title.trim() : existing.title,
    importance: body.importance !== undefined ? body.importance : existing.importance,
    cardColor: body.cardColor !== undefined ? body.cardColor : existing.cardColor,
    amount: nextAmount,
    currencyCode: nextCurrency,
    description: body.description === undefined ? existing.description : body.description,
    ownerUserId: owner ? owner.id : existing.ownerUserId,
    ownerDisplayName: owner ? owner.displayName : existing.ownerDisplayName,
    ownerAvatarUrl: owner ? owner.avatarUrl : existing.ownerAvatarUrl,
    ownerTeamId: owner ? owner.teamId : existing.ownerTeamId,
    contactPartyId: nextContactId,
    primaryContact: nextPrimaryContact,
    expectedCloseDate: body.expectedCloseDate !== undefined ? body.expectedCloseDate : existing.expectedCloseDate,
    probabilityPercent: body.probabilityPercent !== undefined ? body.probabilityPercent : existing.probabilityPercent,
    customFields: nextCustomFields,
    updatedAt: nextUpdatedAt(existing.updatedAt),
  };

  opportunities = opportunities.map((rec) => (rec.id === id ? updated : rec));
  return toDetailRow(updated);
}

/** MoveOpportunityStageDto / TransferOpportunityPipelineDto shared reason fields (400). */
function assertMoveReasonsDto(body: Partial<MoveStageBody>): void {
  assertExpectedUpdatedAt(body.expectedUpdatedAt);
  assertOptionalText(body.reason, 'reason', OPPORTUNITY_LIMITS.reason, true);
  assertOptionalText(body.lostReason, 'lostReason', OPPORTUNITY_LIMITS.reason, true);
  for (const field of ['lostReasonId', 'winReasonId'] as const) {
    if (body[field] !== undefined && (typeof body[field] !== 'string' || !body[field]!.trim())) {
      throw validationFailed({ [field]: ['is_uuid'] });
    }
  }
}

function bumpUpdatedAt(existing: OpportunityRecord): OpportunityRecord {
  const bumped = { ...existing, updatedAt: nextUpdatedAt(existing.updatedAt) };
  opportunities = opportunities.map((rec) => (rec.id === existing.id ? bumped : rec));
  return bumped;
}

/**
 * POST /crm/opportunities/:id/stage, in OpportunitiesService.moveStage order: DTO (400) -> 404 -> 403 ->
 * expectedUpdatedAt (409 CRM.OPPORTUNITY.STALE_MOVE, and it bumps updatedAt) -> stage in this pipeline (404) ->
 * same stage = success with no transition -> blacklisted (409) -> reasons (422).
 */
export async function fakeMoveOpportunityStage(id: string, body: MoveStageBody): Promise<OpportunityRow> {
  await oppDelay();
  assertMoveReasonsDto(body);
  if (typeof body.stageId !== 'string' || !body.stageId.trim()) throw validationFailed({ stageId: ['is_uuid'] });
  let existing = opportunities.find((rec) => rec.id === id);
  if (!existing) {
    throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND');
  }
  if (FAKE_OPPORTUNITY_READ_ONLY) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  if (body.expectedUpdatedAt !== undefined) {
    if (body.expectedUpdatedAt !== existing.updatedAt) {
      throw new ApiError(409, 'CRM.OPPORTUNITY.STALE_MOVE');
    }
    existing = bumpUpdatedAt(existing);
  }

  const pipeline = PIPELINES_STORE.find((p) => p.id === existing!.pipelineId && p.isActive);
  const targetStage = pipeline?.stages.find((s) => s.id === body.stageId && s.isActive);
  if (!pipeline || !targetStage) {
    throw new ApiError(404, 'PIPELINE_STAGE_NOT_FOUND');
  }
  if (existing.stageId === targetStage.id) {
    return toDetailRow(existing);
  }

  assertNotBlacklistedTransition(existing, targetStage.flag);
  const resolved = await resolveMoveReasons(existing, targetStage.flag, body);
  const updated = applyStageTransition(existing, pipeline, targetStage, resolved, body.reason ?? body.lostReason ?? null);
  return toDetailRow(updated);
}

/**
 * PUT /crm/opportunities/:id/pipeline, in OpportunitiesService.transferPipeline order: DTO (400) -> 404 -> 403 ->
 * expectedUpdatedAt (409 STALE_MOVE) -> target pipeline usable (404 PIPELINE_NOT_FOUND) -> same pipeline (422) ->
 * stage: the given one in the target pipeline, else the rank-1 active NEW stage (404 PIPELINE_STAGE_NOT_FOUND) ->
 * blacklisted (409) -> reasons (422).
 */
export async function fakeTransferOpportunityPipeline(
  id: string,
  body: TransferPipelineBody,
  idempotencyKey: string,
): Promise<OpportunityRow> {
  await oppDelay();
  // Gateway (gateway-idempotency.service.ts) before crm-app: key missing 400 GW.IDEM.MISSING, not UUIDv7
  // 400 GW.IDEM.BAD_VALUE, same key with another body 422 GW.IDEM.MISMATCH, same key and body = stored replay.
  if (!idempotencyKey) throw new ApiError(400, 'GW.IDEM.MISSING');
  if (!UUID_V7_RE.test(idempotencyKey)) throw new ApiError(400, 'GW.IDEM.BAD_VALUE');
  const gatewayKey = `transfer:${id}:${idempotencyKey.toLowerCase()}`;
  const bodyKey = canonicalJson(body);
  const stored = gatewayIdempotencyStore.get(gatewayKey);
  if (stored) {
    if (stored.bodyKey !== bodyKey) throw new ApiError(422, 'GW.IDEM.MISMATCH');
    return clone(stored.result);
  }
  const result = await transferOpportunityPipelineOnce(id, body);
  gatewayIdempotencyStore.set(gatewayKey, { bodyKey, result: clone(result) });
  return result;
}

const gatewayIdempotencyStore = new Map<string, { bodyKey: string; result: OpportunityRow }>();

async function transferOpportunityPipelineOnce(id: string, body: TransferPipelineBody): Promise<OpportunityRow> {
  assertMoveReasonsDto(body);
  if (typeof body.pipelineId !== 'string' || !body.pipelineId.trim()) throw validationFailed({ pipelineId: ['is_uuid'] });
  if (body.stageId !== undefined && (typeof body.stageId !== 'string' || !body.stageId.trim())) {
    throw validationFailed({ stageId: ['is_uuid'] });
  }
  let existing = opportunities.find((rec) => rec.id === id);
  if (!existing) {
    throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND');
  }
  if (FAKE_OPPORTUNITY_READ_ONLY) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  if (body.expectedUpdatedAt !== undefined) {
    if (body.expectedUpdatedAt !== existing.updatedAt) {
      throw new ApiError(409, 'CRM.OPPORTUNITY.STALE_MOVE');
    }
    existing = bumpUpdatedAt(existing);
  }

  const targetPipeline = PIPELINES_STORE.find((p) => p.id === body.pipelineId && p.isActive);
  if (!targetPipeline) {
    throw new ApiError(404, 'PIPELINE_NOT_FOUND');
  }
  if (body.pipelineId === existing.pipelineId) {
    throw new ApiError(422, 'OPPORTUNITY_PIPELINE_UNCHANGED');
  }

  const firstStage = targetPipeline.stages.slice().sort((a, b) => a.rank - b.rank)[0];
  const targetStage = body.stageId
    ? targetPipeline.stages.find((s) => s.id === body.stageId && s.isActive)
    : firstStage?.flag === 'NEW' && firstStage.isActive ? firstStage : undefined;
  if (!targetStage) {
    throw new ApiError(404, 'PIPELINE_STAGE_NOT_FOUND');
  }

  assertNotBlacklistedTransition(existing, targetStage.flag);
  const resolved = await resolveMoveReasons(existing, targetStage.flag, body);
  const updated = applyStageTransition(existing, targetPipeline, targetStage, resolved, body.reason ?? body.lostReason ?? null);
  return toDetailRow(updated);
}

/** DELETE /crm/opportunities/:id: DeleteRecordDto reason (trimmed, at most 1000; 400) -> 404 -> 403. */
export async function fakeDeleteOpportunity(id: string, reason?: string): Promise<void> {
  await oppDelay();
  if (reason !== undefined) {
    if (typeof reason !== 'string') throw validationFailed({ reason: ['is_string'] });
    if (reason.trim().length > OPPORTUNITY_LIMITS.reason) throw validationFailed({ reason: ['max_length'] });
  }
  const exists = opportunities.some((rec) => rec.id === id);
  if (!exists) {
    throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND');
  }
  if (FAKE_OPPORTUNITY_READ_ONLY) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  opportunities = opportunities.filter((rec) => rec.id !== id);
  seedHistoryMap.delete(id);
}

/** Rows carry the tag summary only (no timestamps), as the backend row projection does. */
function tagSummary({ id, name, backgroundColor, textColor }: OpportunityTag): OpportunityTag {
  return { id, name, backgroundColor, textColor };
}

function sortedTags(tags: readonly OpportunityTag[]): OpportunityTag[] {
  return tags.slice().sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

async function tagCatalogById(): Promise<Map<string, Tag>> {
  let catalog: readonly Tag[];
  try {
    catalog = await listTags();
  } catch {
    catalog = FALLBACK_TAGS;
  }
  return new Map(catalog.map((t) => [t.id, t]));
}

/** The tag endpoints answer TagView: the record's tags with the catalogue timestamps. */
async function tagViews(tags: readonly OpportunityTag[]): Promise<OpportunityTagView[]> {
  const byId = await tagCatalogById();
  return sortedTags(tags).map((tag) => ({
    ...tag,
    createdAt: byId.get(tag.id)?.createdAt ?? FALLBACK_TAG_TIMESTAMP,
    updatedAt: byId.get(tag.id)?.updatedAt ?? FALLBACK_TAG_TIMESTAMP,
  }));
}

/** GET /crm/opportunities/:id/tags: the record's tags ordered by name, id. */
export async function fakeListOpportunityTags(id: string): Promise<OpportunityTagView[]> {
  await oppDelay();
  const existing = opportunities.find((rec) => rec.id === id);
  if (!existing) {
    throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND');
  }
  return tagViews(existing.tags);
}

/**
 * POST /crm/opportunities/:id/tags: DTO (400) -> 404 -> 403 -> unknown tag (422 CRM_TAG_UNKNOWN) -> any already
 * attached (409 CRM_RECORD_TAG_ALREADY_ATTACHED, details { tagIds }: the whole request is refused). Returns every
 * tag now on the record. Tag links do not change the opportunity's updatedAt.
 */
export async function fakeAttachOpportunityTags(id: string, tagIds: string[]): Promise<OpportunityTagView[]> {
  await oppDelay();
  assertTagIdsDto(tagIds, true);
  const existing = opportunities.find((rec) => rec.id === id);
  if (!existing) {
    throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND');
  }
  if (FAKE_OPPORTUNITY_READ_ONLY) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  const resolved = await resolveTagsByIds(tagIds);
  const current = new Set(existing.tags.map((t) => t.id));
  if (resolved.some((tag) => current.has(tag.id))) {
    throw new ApiError(409, 'CRM_RECORD_TAG_ALREADY_ATTACHED', { tagIds: [...tagIds] });
  }
  const nextTags = sortedTags([...existing.tags, ...resolved]);
  opportunities = opportunities.map((rec) => (rec.id === id ? { ...existing, tags: nextTags } : rec));
  return tagViews(nextTags);
}

/** DELETE /crm/opportunities/:id/tags/:tagId: 404 -> 403 -> link missing (404 CRM_RECORD_TAG_NOT_FOUND). */
export async function fakeDetachOpportunityTag(id: string, tagId: string): Promise<void> {
  await oppDelay();
  const existing = opportunities.find((rec) => rec.id === id);
  if (!existing) {
    throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND');
  }
  if (FAKE_OPPORTUNITY_READ_ONLY) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  if (!existing.tags.some((t) => t.id === tagId)) {
    throw new ApiError(404, 'CRM_RECORD_TAG_NOT_FOUND');
  }
  opportunities = opportunities.map((rec) =>
    rec.id === id ? { ...existing, tags: existing.tags.filter((t) => t.id !== tagId) } : rec,
  );
}

/**
 * GET /crm/opportunities/capabilities?branchId=: `{ branchId, opportunities }`. move/transfer/bulk.assign/
 * bulk.moveStage follow update, bulk.createActivity follows read, bulk.delete follows delete; null = unavailable.
 */
export async function fakeGetOpportunityCapabilities(branchId: string): Promise<OpportunityCapabilitiesResponse> {
  await oppDelay();
  assertBranchId(branchId);
  const allScope: Scope = { scope: 'all', ownerUserIds: null };
  const update = FAKE_OPPORTUNITY_READ_ONLY ? null : allScope;
  const remove = FAKE_OPPORTUNITY_READ_ONLY ? null : allScope;
  return {
    branchId,
    opportunities: {
      create: allScope,
      update,
      delete: remove,
      move: update,
      transfer: update,
      bulk: {
        assign: update,
        moveStage: update,
        createActivity: allScope,
        delete: remove,
      },
      export: true,
    },
  };
}

/** Default page of GET /crm/opportunities/:id/stage-history (OpportunityStageHistoryQueryDto limit = 100). */
const STAGE_HISTORY_PAGE = 100;

/**
 * GET /crm/opportunities/:id/stage-history: newest first, `{ items, nextCursor }`. The cursor is opaque; one the
 * fake did not issue is 400 OPPORTUNITY_HISTORY_CURSOR_INVALID, as the backend answers a cursor it cannot decode.
 */
export async function fakeListStageHistory(
  id: string,
  cursor: string | null,
): Promise<{ items: StageHistoryItem[]; nextCursor: string | null }> {
  await oppDelay();
  if (cursor !== null && cursor.length > 256) throw validationFailed({ cursor: ['max_length'] });
  const existing = opportunities.find((rec) => rec.id === id);
  if (!existing) {
    throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND');
  }
  if (cursor !== null && !/^h\d+$/.test(cursor)) {
    throw new ApiError(400, 'OPPORTUNITY_HISTORY_CURSOR_INVALID');
  }
  const all = (seedHistoryMap.get(id) ?? []).slice().reverse();
  const offset = cursor ? Number.parseInt(cursor.slice(1), 10) : 0;
  const slice = all.slice(offset, offset + STAGE_HISTORY_PAGE);
  const nextOffset = offset + slice.length;
  return {
    items: clone(slice),
    nextCursor: nextOffset < all.length ? `h${nextOffset}` : null,
  };
}

/**
 * GET /crm/opportunities/reasons?kind= -> `{ items }` (OpportunitiesService.listReasons). `kind` is required
 * (400 otherwise); only active reasons of that kind, ordered by sortOrder then code, in the narrow picker view.
 */
export async function fakeGetOpportunityReasons(query: OpportunityReasonsQuery): Promise<OpportunityReasonListResponse> {
  await oppDelay();
  if (query?.kind !== 'WIN' && query?.kind !== 'LOSS') {
    throw validationFailed({ kind: ['is_enum'] });
  }
  if (FAKE_REASONS_FORBIDDEN) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  const { items } = await fakeGetReasons({ kind: query.kind, active: 'true' });
  return {
    items: items
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
      .map((r) => ({
        id: r.id,
        reasonKind: query.kind,
        code: r.code,
        nameEn: r.nameEn,
        nameAr: r.nameAr,
        definitionEn: r.definitionEn,
        definitionAr: r.definitionAr,
        polarity: r.polarity,
        sortOrder: r.sortOrder,
      })),
  };
}

/**
 * Fake-data helper for opportunity-bulk's fake module (active reasons of one kind, full settings rows).
 * Not an HTTP mirror: the route is fakeGetOpportunityReasons.
 */
export async function fakeListOpportunityReasons(kind: 'WIN' | 'LOSS'): Promise<Reason[]> {
  if (FAKE_REASONS_FORBIDDEN) {
    await oppDelay();
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  return fakeListReasons(kind, true);
}

export async function fakeSearchCustomerOptions(_branchId: string, query: string): Promise<CustomerOption[]> {
  await oppDelay();
  const term = query.trim().toLowerCase();
  return CUSTOMERS_FAKE_DB.filter(
    (c) =>
      !term ||
      c.displayName.toLowerCase().includes(term) ||
      (c.companyName?.toLowerCase().includes(term) ?? false) ||
      (c.email?.toLowerCase().includes(term) ?? false) ||
      (c.companyEmail?.toLowerCase().includes(term) ?? false) ||
      (c.primaryMobile?.toLowerCase().includes(term) ?? false) ||
      (c.companyPhone?.toLowerCase().includes(term) ?? false),
  )
    .slice(0, 20)
    .map(
      (c): CustomerOption => ({
        id: c.id,
        partyId: c.partyId,
        profileType: c.profileType,
        displayName: c.displayName,
        companyName: c.companyName,
        status: c.status,
        phone: customerPrimaryPhone(c),
        email: customerPrimaryEmail(c),
      }),
    );
}

export async function fakeGetCustomerOption(id: string): Promise<CustomerOption> {
  await oppDelay();
  const c = findCustomerOrThrow(id);
  return {
    id: c.id,
    partyId: c.partyId,
    profileType: c.profileType,
    displayName: c.displayName,
    companyName: c.companyName,
    status: c.status,
    phone: customerPrimaryPhone(c),
    email: customerPrimaryEmail(c),
  };
}

export async function fakeListCustomerContacts(customerProfileId: string): Promise<CustomerContactOption[]> {
  await oppDelay();
  const customer = findCustomerOrThrow(customerProfileId);
  const contacts: CustomerContactOption[] = customer.contacts.map((c) => ({
    partyId: c.partyId,
    displayName: c.displayName,
    jobTitle: c.jobTitle,
    email: c.email,
    phones: [...c.phones],
    isPrimary: c.isPrimary,
    isCustomerParty: false,
  }));

  if (customer.profileType === 'INDIVIDUAL') {
    contacts.unshift({
      partyId: customer.partyId,
      displayName: customer.displayName,
      jobTitle: null,
      email: customer.email,
      phones: [...customer.phones],
      isPrimary: true,
      isCustomerParty: true,
    });
  }

  return contacts;
}

function mapCustomFieldDef(field: CustomField): CustomFieldDef {
  return {
    id: field.id,
    fieldKey: field.fieldKey,
    nameAr: field.nameAr,
    nameEn: field.nameEn,
    type: field.type,
    placeholderAr: field.placeholderAr,
    placeholderEn: field.placeholderEn,
    options: field.options
      .filter((opt) => opt.isActive)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((opt) => ({
        key: opt.key,
        nameAr: opt.nameAr,
        nameEn: opt.nameEn,
      })),
    requiredOnCreate: isRequiredForOperation(field, 'CREATE', 'OPPORTUNITY'),
    requiredOnUpdate: isRequiredForOperation(field, 'UPDATE', 'OPPORTUNITY'),
    sortOrder: field.sortOrder,
  };
}

export async function fakeListOpportunityCustomFields(): Promise<CustomFieldDef[]> {
  const all = await fakeListCustomFields();
  return all
    .filter((f) => f.ownerType === 'OPPORTUNITY' && f.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(mapCustomFieldDef);
}

export async function fakeGetOpportunityCustomValues(
  _branchId: string,
  id: string,
): Promise<Record<string, unknown>> {
  await oppDelay();
  const existing = opportunities.find((rec) => rec.id === id);
  if (!existing) {
    throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND');
  }
  return clone(existing.customFields);
}

function deterministicHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export async function fakeGetRelatedCounts(id: string): Promise<OpportunityRelatedCounts> {
  await oppDelay();
  if (FAKE_TRADE_FORBIDDEN) {
    return { quotations: null, salesOrders: null };
  }
  if (id === ACME_OPPORTUNITY_ID) {
    return { quotations: 2, salesOrders: 1 };
  }
  const h = deterministicHash(id);
  return {
    quotations: h % 4,
    salesOrders: (h >> 2) % 4,
  };
}

export async function fakeListLinkedQuotations(
  id: string,
  page: number,
  limit: number,
): Promise<Page<LinkedQuotation>> {
  await oppDelay();
  if (FAKE_TRADE_FORBIDDEN) {
    throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
  }
  const opp = opportunities.find((rec) => rec.id === id);
  if (!opp) {
    throw new ApiError(404, 'OPPORTUNITY_NOT_FOUND');
  }

  const count = id === ACME_OPPORTUNITY_ID ? 2 : deterministicHash(id) % 4;
  const statuses = ['DRAFT', 'SENT', 'ACCEPTED'] as const;
  const currency = opp.currencyCode ?? 'EGP';
  const baseDateMs = Date.parse(opp.createdAt);

  const rows: LinkedQuotation[] = Array.from({ length: count }, (_, idx) => {
    const seq = idx + 1;
    const revNum = seq === 1 ? 2 : 1;
    const lifecycleStatus = id === ACME_OPPORTUNITY_ID ? (idx === 0 ? 'SENT' : 'DRAFT') : statuses[(idx + count) % statuses.length];
    const businessDate = new Date(baseDateMs + seq * 3 * DAY_MS).toISOString().slice(0, 10);
    const validUntil = new Date(baseDateMs + (seq * 3 + 30) * DAY_MS).toISOString().slice(0, 10);
    const grandTotal =
      id === ACME_OPPORTUNITY_ID
        ? idx === 0
          ? '250000.00000000'
          : '185000.50000000'
        : opp.amount ?? `${25000 * seq}.00000000`;

    return {
      id: `qt-${id.slice(-4)}-${seq}`,
      documentNumber: lifecycleStatus === 'DRAFT' ? null : `QT-2026-${String(42 + idx + (deterministicHash(id) % 50)).padStart(5, '0')}`,
      draftReference: lifecycleStatus === 'DRAFT' ? `DRF-QT-${String(100 + seq)}` : null,
      lifecycleStatus,
      grandTotal,
      currencyCode: currency,
      businessDate,
      currentRevision: {
        id: `qtr-${id.slice(-4)}-${seq}`,
        revisionNumber: revNum,
        status: lifecycleStatus,
        validUntil,
      },
    };
  });

  return pageOf(rows, page, limit);
}

export function fakeCanManageTags(): boolean {
  return FAKE_CAN_MANAGE_TAGS;
}

export function fakeCanManagePipelines(): boolean {
  return FAKE_CAN_MANAGE_PIPELINES;
}

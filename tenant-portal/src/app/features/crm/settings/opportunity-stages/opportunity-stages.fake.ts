import { ApiError, checkRequiredText, crmValidationFailed, fakeDelay, fakeId } from '../shared/settings-api';
import {
  CreateOpportunityStageInput,
  OpportunityStage,
  OpportunityStageFlag,
  StageCategory,
  StageUsagePipeline,
  UpdateOpportunityStageInput,
  OPPORTUNITY_STAGE_FLAGS,
  STAGE_CATEGORIES,
  allowedCategories,
} from './opportunity-stages.model';

/**
 * Pipelines register how stages are used (avoids a circular import with
 * `pipelines.fake.ts`, which reads this catalogue at load time).
 */
let computeStageUsageSync: () => Record<string, StageUsagePipeline[]> = () => ({});
export function registerStageUsage(provider: () => Record<string, StageUsagePipeline[]>): void {
  computeStageUsageSync = provider;
}

const SEED_TIMESTAMP = '2026-01-10T09:00:00.000Z';
const MAX_OPPORTUNITY_STAGES = 500;
const MAX_STAGE_NAME_LENGTH = 80;

export const SYSTEM_STAGE_IDS = {
  NEW: '01950000-0000-7000-8000-000000000421',
  QUALIFICATION: '01950000-0000-7000-8000-000000000423',
  PROPOSAL: '01950000-0000-7000-8000-000000000424',
  NEGOTIATION: '01950000-0000-7000-8000-000000000425',
  WON: '01950000-0000-7000-8000-000000000428',
  LOST: '01950000-0000-7000-8000-000000000429',
} as const;

export const CANONICAL_SYSTEM_STAGE_IDS: readonly string[] = [
  SYSTEM_STAGE_IDS.NEW,
  SYSTEM_STAGE_IDS.QUALIFICATION,
  SYSTEM_STAGE_IDS.PROPOSAL,
  SYSTEM_STAGE_IDS.NEGOTIATION,
  SYSTEM_STAGE_IDS.WON,
  SYSTEM_STAGE_IDS.LOST,
];

interface SystemStageSeed {
  id: string;
  nameAr: string;
  nameEn: string;
  flag: OpportunityStageFlag;
  category: StageCategory;
}

const CANONICAL_SYSTEM_SEEDS: readonly SystemStageSeed[] = [
  { id: SYSTEM_STAGE_IDS.NEW, nameAr: 'جديد', nameEn: 'New', flag: 'NEW', category: 'OPEN' },
  {
    id: SYSTEM_STAGE_IDS.QUALIFICATION,
    nameAr: 'تأهيل',
    nameEn: 'Qualification',
    flag: 'QUALIFICATION',
    category: 'IN_PROGRESS',
  },
  { id: SYSTEM_STAGE_IDS.PROPOSAL, nameAr: 'عرض', nameEn: 'Proposal', flag: 'PROPOSAL', category: 'IN_PROGRESS' },
  {
    id: SYSTEM_STAGE_IDS.NEGOTIATION,
    nameAr: 'تفاوض',
    nameEn: 'Negotiation',
    flag: 'NEGOTIATION',
    category: 'IN_PROGRESS',
  },
  { id: SYSTEM_STAGE_IDS.WON, nameAr: 'تم الفوز', nameEn: 'Won', flag: 'WON', category: 'POSITIVE' },
  { id: SYSTEM_STAGE_IDS.LOST, nameAr: 'خسارة', nameEn: 'Lost', flag: 'LOST', category: 'NEGATIVE' },
];

export const opportunityStagesStore: OpportunityStage[] = CANONICAL_SYSTEM_SEEDS.map((seed) => ({
  ...seed,
  isActive: true,
  isSystem: true,
  createdAt: SEED_TIMESTAMP,
  updatedAt: SEED_TIMESTAMP,
}));

/**
 * Create/UpdateOpportunityStageDto through the ValidationPipe (400 CRM_VALIDATION_FAILED, before any service
 * check): names trimmed @IsNotEmpty @MaxLength(80); flag and category @IsEnum; isActive @IsBoolean.
 */
function assertStageBody(body: Partial<CreateOpportunityStageInput> & { isActive?: unknown }, partial: boolean): void {
  const details: Record<string, string[]> = {};
  for (const field of ['nameAr', 'nameEn'] as const) {
    const value = body[field];
    if (value === undefined && partial) continue;
    checkRequiredText(details, field, typeof value === 'string' ? value.trim() : value, MAX_STAGE_NAME_LENGTH);
  }
  if (!(body.flag === undefined && partial) && !OPPORTUNITY_STAGE_FLAGS.includes(body.flag as OpportunityStageFlag)) {
    details['flag'] = ['is_enum'];
  }
  if (!(body.category === undefined && partial) && !STAGE_CATEGORIES.includes(body.category as StageCategory)) {
    details['category'] = ['is_enum'];
  }
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') details['isActive'] = ['is_boolean'];
  if (Object.keys(details).length > 0) throw crmValidationFailed(details);
}

function cloneStage(stage: OpportunityStage): OpportunityStage {
  return { ...stage };
}

export function resetCanonicalSystemStages(now: string): void {
  for (const seed of CANONICAL_SYSTEM_SEEDS) {
    const existing = opportunityStagesStore.find((item) => item.id === seed.id);
    if (existing) {
      existing.nameAr = seed.nameAr;
      existing.nameEn = seed.nameEn;
      existing.flag = seed.flag;
      existing.category = seed.category;
      existing.isActive = true;
      existing.isSystem = true;
      existing.updatedAt = now;
    } else {
      opportunityStagesStore.push({
        ...seed,
        isActive: true,
        isSystem: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

export async function fakeListOpportunityStages(): Promise<OpportunityStage[]> {
  await fakeDelay();
  return opportunityStagesStore
    .slice()
    // OpportunityStagesService.boundedCatalog: isSystem DESC, nameEn ASC, createdAt ASC, id ASC.
    .sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
      return (
        a.nameEn.localeCompare(b.nameEn, 'en') ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id)
      );
    })
    .map(cloneStage);
}

export async function fakeCreateOpportunityStage(input: CreateOpportunityStageInput): Promise<OpportunityStage> {
  await fakeDelay();
  assertStageBody(input, false);
  const nameAr = input.nameAr.trim();
  const nameEn = input.nameEn.trim();
  if (!allowedCategories(input.flag).includes(input.category)) {
    throw new ApiError(422, 'OPPORTUNITY_STAGE_CATEGORY_INVALID');
  }
  if (opportunityStagesStore.length >= MAX_OPPORTUNITY_STAGES) {
    throw new ApiError(422, 'OPPORTUNITY_STAGE_LIMIT_EXCEEDED');
  }

  const now = new Date().toISOString();
  const created: OpportunityStage = {
    id: fakeId(),
    nameAr,
    nameEn,
    flag: input.flag,
    category: input.category,
    isActive: true,
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  };
  opportunityStagesStore.push(created);
  return cloneStage(created);
}

export async function fakeUpdateOpportunityStage(
  id: string,
  changes: UpdateOpportunityStageInput,
): Promise<OpportunityStage> {
  await fakeDelay();
  assertStageBody(changes, true);
  const stage = opportunityStagesStore.find((item) => item.id === id);
  if (!stage) {
    throw new ApiError(404, 'OPPORTUNITY_STAGE_NOT_FOUND');
  }

  const nextFlag = changes.flag ?? stage.flag;
  const nextCategory = changes.category ?? stage.category;
  const flagChanged = changes.flag !== undefined && changes.flag !== stage.flag;
  const deactivating = changes.isActive === false && stage.isActive;

  // Check pairing on the merged result before system/usage locks.
  if (!allowedCategories(nextFlag).includes(nextCategory)) {
    throw new ApiError(422, 'OPPORTUNITY_STAGE_CATEGORY_INVALID');
  }

  if (stage.isSystem && (flagChanged || deactivating)) {
    throw new ApiError(422, 'OPPORTUNITY_STAGE_SYSTEM_PROTECTED');
  }

  const usage = computeStageUsageSync()[stage.id] ?? [];
  if (usage.length > 0 && (flagChanged || deactivating)) {
    // ConflictException with code and message only: callers reload stage usage themselves.
    throw new ApiError(409, 'OPPORTUNITY_STAGE_IN_USE');
  }

  const nextNameAr = changes.nameAr !== undefined ? changes.nameAr.trim() : stage.nameAr;
  const nextNameEn = changes.nameEn !== undefined ? changes.nameEn.trim() : stage.nameEn;

  stage.nameAr = nextNameAr;
  stage.nameEn = nextNameEn;
  stage.flag = nextFlag;
  stage.category = nextCategory;
  if (changes.isActive !== undefined) {
    stage.isActive = changes.isActive;
  }
  stage.updatedAt = new Date().toISOString();

  return cloneStage(stage);
}

export async function fakeDeleteOpportunityStage(id: string): Promise<void> {
  await fakeDelay();
  const index = opportunityStagesStore.findIndex((item) => item.id === id);
  if (index < 0) {
    throw new ApiError(404, 'OPPORTUNITY_STAGE_NOT_FOUND');
  }

  const stage = opportunityStagesStore[index];
  if (stage.isSystem) {
    throw new ApiError(422, 'OPPORTUNITY_STAGE_SYSTEM_PROTECTED');
  }

  const usage = computeStageUsageSync()[stage.id] ?? [];
  if (usage.length > 0) {
    throw new ApiError(409, 'OPPORTUNITY_STAGE_IN_USE');
  }

  opportunityStagesStore.splice(index, 1);
}

export async function fakeStageUsage(): Promise<Record<string, StageUsagePipeline[]>> {
  await fakeDelay();
  const usage = computeStageUsageSync();
  const copy: Record<string, StageUsagePipeline[]> = {};
  for (const [stageId, pipelines] of Object.entries(usage)) {
    copy[stageId] = pipelines.map((pipeline) => ({ ...pipeline }));
  }
  return copy;
}

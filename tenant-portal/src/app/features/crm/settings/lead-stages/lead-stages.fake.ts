import { ApiError, checkRequiredText, crmValidationFailed, fakeDelay, fakeId, newIdempotencyKey } from '../shared/settings-api';
import {
  CreateLeadStageInput,
  LEAD_STAGE_FLAGS,
  LEAD_STAGE_LIMIT,
  LEAD_STAGE_NAME_MAX,
  LeadStage,
  LeadStageFlag,
  UpdateLeadStagePatch,
  isProtectedStage,
  isTerminalStage,
} from './lead-stages.model';

const SEED_TIME = '2026-11-01T09:00:00.000Z';

let stages: LeadStage[] = [
  {
    id: '018f0000-0000-7000-8000-000000000410',
    sortOrder: 1,
    flag: 'NEW',
    category: 'IN_PROGRESS',
    nameAr: 'جديد',
    nameEn: 'New',
    isDefault: true,
    isActive: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
  {
    id: '018f0000-0000-7000-8000-000000000411',
    sortOrder: 2,
    flag: 'CONTACTED',
    category: 'IN_PROGRESS',
    nameAr: 'تم التواصل',
    nameEn: 'Contacted',
    isDefault: false,
    isActive: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
  {
    id: '018f0000-0000-7000-8000-000000000412',
    sortOrder: 3,
    flag: 'QUALIFYING',
    category: 'IN_PROGRESS',
    nameAr: 'تحت التأهيل',
    nameEn: 'Qualifying',
    isDefault: false,
    isActive: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
  {
    id: '018f0000-0000-7000-8000-000000000413',
    sortOrder: 4,
    flag: 'QUALIFIED',
    category: 'POSITIVE',
    nameAr: 'مؤهل',
    nameEn: 'Qualified',
    isDefault: false,
    isActive: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
  {
    id: '018f0000-0000-7000-8000-000000000414',
    sortOrder: 5,
    flag: 'NURTURING',
    category: 'IN_PROGRESS',
    nameAr: 'متابعة لاحقة',
    nameEn: 'Nurturing',
    isDefault: false,
    isActive: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
  {
    id: '018f0000-0000-7000-8000-000000000415',
    sortOrder: 6,
    flag: 'ON_HOLD',
    category: 'IN_PROGRESS',
    nameAr: 'معلق',
    nameEn: 'On hold',
    isDefault: false,
    isActive: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
  {
    id: '018f0000-0000-7000-8000-000000000416',
    sortOrder: 7,
    flag: 'DISQUALIFIED',
    category: 'NEGATIVE',
    nameAr: 'غير مؤهل',
    nameEn: 'Disqualified',
    isDefault: false,
    isActive: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
  {
    id: '018f0000-0000-7000-8000-000000000417',
    sortOrder: 8,
    flag: 'CONVERTED',
    category: 'POSITIVE',
    nameAr: 'تم التحويل',
    nameEn: 'Converted',
    isDefault: false,
    isActive: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
];

const usageCounts = new Map<string, number>([
  ['018f0000-0000-7000-8000-000000000411', 4],
  ['018f0000-0000-7000-8000-000000000412', 2],
  ['018f0000-0000-7000-8000-000000000413', 2],
  ['018f0000-0000-7000-8000-000000000414', 0],
  ['018f0000-0000-7000-8000-000000000415', 0],
]);

function cloneStage(stage: LeadStage): LeadStage {
  return { ...stage };
}

function canonicalize(list: readonly LeadStage[]): LeadStage[] {
  const first = list.filter((item) => item.flag === 'NEW');
  const middle = list.filter((item) => !isProtectedStage(item)).sort((a, b) => a.sortOrder - b.sortOrder);
  const disqualified = list.filter((item) => item.flag === 'DISQUALIFIED');
  const converted = list.filter((item) => item.flag === 'CONVERTED');
  return [...first, ...middle, ...disqualified, ...converted].map((item, index) => ({
    ...item,
    sortOrder: index + 1,
  }));
}

/** StageCategoryEnum (shared with opportunity stages): OPEN passes the DTO and is refused by the service (422). */
const STAGE_CATEGORY_ENUM: readonly string[] = ['OPEN', 'IN_PROGRESS', 'POSITIVE', 'NEGATIVE'];

/**
 * Create/UpdateLeadStageDto through the ValidationPipe (400 CRM_VALIDATION_FAILED, before any service check).
 * Names are NOT trimmed by this DTO: @IsString @IsNotEmpty @MaxLength(80) on the value as sent.
 */
function assertLeadStageBody(body: Partial<CreateLeadStageInput> & { isActive?: unknown }, partial: boolean): void {
  const details: Record<string, string[]> = {};
  for (const field of ['nameAr', 'nameEn'] as const) {
    if (body[field] === undefined && partial) continue;
    checkRequiredText(details, field, body[field], LEAD_STAGE_NAME_MAX);
  }
  if (!(body.flag === undefined && partial) && !LEAD_STAGE_FLAGS.includes(body.flag as LeadStageFlag)) {
    details['flag'] = ['is_enum'];
  }
  if (!(body.category === undefined && partial) && !STAGE_CATEGORY_ENUM.includes(body.category as string)) {
    details['category'] = ['is_enum'];
  }
  if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean') details['isDefault'] = ['is_boolean'];
  if (body.isActive !== undefined && typeof body.isActive !== 'boolean') details['isActive'] = ['is_boolean'];
  if (Object.keys(details).length > 0) throw crmValidationFailed(details);
}

// GET /api/tenant/crm/v1/lead-stages
export async function fakeListLeadStages(): Promise<LeadStage[]> {
  await fakeDelay();
  stages = canonicalize(stages);
  return stages.map(cloneStage);
}

// POST /api/tenant/crm/v1/lead-stages (201)
export async function fakeCreateLeadStage(input: CreateLeadStageInput): Promise<LeadStage> {
  await fakeDelay();
  assertLeadStageBody(input, false);
  // LeadStagesService.create: catalogue limit, then category (OPEN refused), then protected flag.
  if (stages.length >= LEAD_STAGE_LIMIT) {
    throw new ApiError(422, 'LEAD_STAGE_LIMIT_EXCEEDED');
  }
  if (input.category === 'OPEN') {
    throw new ApiError(422, 'LEAD_STAGE_CATEGORY_INVALID');
  }
  if (isProtectedStage({ flag: input.flag })) {
    throw new ApiError(422, 'LEAD_STAGE_PROTECTED');
  }

  const nameAr = input.nameAr;
  const nameEn = input.nameEn;
  const now = new Date().toISOString();
  const hasActiveDefault = stages.some((item) => item.isDefault && item.isActive);
  const makeDefault = Boolean(input.isDefault) || !hasActiveDefault;

  if (makeDefault) {
    stages = stages.map((item) => (item.isDefault ? { ...item, isDefault: false, updatedAt: now } : item));
  }

  const created: LeadStage = {
    id: fakeId(),
    nameAr,
    nameEn,
    flag: input.flag,
    category: input.category,
    sortOrder: stages.length,
    isDefault: makeDefault,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const disqualifiedIndex = stages.findIndex((item) => item.flag === 'DISQUALIFIED');
  const insertAt = disqualifiedIndex >= 0 ? disqualifiedIndex : stages.length;
  const next = [...stages.slice(0, insertAt), created, ...stages.slice(insertAt)].map((item, index) => ({
    ...item,
    sortOrder: index + 1,
  }));
  stages = next;
  usageCounts.set(created.id, 0);

  return cloneStage(stages.find((item) => item.id === created.id)!);
}

// PATCH /api/tenant/crm/v1/lead-stages/:id
export async function fakeUpdateLeadStage(id: string, patch: UpdateLeadStagePatch): Promise<LeadStage> {
  await fakeDelay();
  assertLeadStageBody(patch, true);
  const index = stages.findIndex((item) => item.id === id);
  if (index < 0) {
    throw new ApiError(404, 'LEAD_STAGE_NOT_FOUND');
  }

  const current = stages[index];
  if (isProtectedStage(current)) {
    throw new ApiError(422, 'LEAD_STAGE_PROTECTED');
  }
  if (patch.flag !== undefined && isProtectedStage({ flag: patch.flag })) {
    throw new ApiError(422, 'LEAD_STAGE_PROTECTED');
  }
  if ((patch.category ?? current.category) === 'OPEN') {
    throw new ApiError(422, 'LEAD_STAGE_CATEGORY_INVALID');
  }
  if (patch.flag !== undefined && patch.flag !== current.flag && (usageCounts.get(id) ?? 0) > 0) {
    throw new ApiError(409, 'LEAD_STAGE_IN_USE');
  }
  if (patch.isActive === false && current.isDefault) {
    throw new ApiError(422, 'LEAD_STAGE_DEFAULT_DEACTIVATE');
  }

  const updated: LeadStage = {
    ...current,
    nameAr: patch.nameAr ?? current.nameAr,
    nameEn: patch.nameEn ?? current.nameEn,
    flag: patch.flag ?? current.flag,
    category: (patch.category ?? current.category) as LeadStage['category'],
    isActive: patch.isActive ?? current.isActive,
    updatedAt: new Date().toISOString(),
  };

  stages = stages.map((item) => (item.id === id ? updated : item));
  return cloneStage(updated);
}

// POST /api/tenant/crm/v1/lead-stages/:id/default
export async function fakeSetDefaultLeadStage(id: string): Promise<LeadStage> {
  await fakeDelay();
  const target = stages.find((item) => item.id === id);
  if (!target) {
    throw new ApiError(404, 'LEAD_STAGE_NOT_FOUND');
  }
  if (!target.isActive) {
    throw new ApiError(422, 'LEAD_STAGE_DEFAULT_INACTIVE');
  }
  if (isTerminalStage(target)) {
    throw new ApiError(422, 'LEAD_STAGE_DEFAULT_TERMINAL');
  }

  const now = new Date().toISOString();
  stages = stages.map((item) => {
    if (item.id === id) return { ...item, isDefault: true, updatedAt: now };
    if (item.isDefault) return { ...item, isDefault: false, updatedAt: now };
    return item;
  });

  return cloneStage(stages.find((item) => item.id === id)!);
}

// PATCH /api/tenant/crm/v1/lead-stages/reorder (x-idempotency-key)
export async function fakeReorderLeadStages(
  orderedIds: readonly string[],
  _idempotencyKey = newIdempotencyKey(),
): Promise<LeadStage[]> {
  await fakeDelay();
  // DTO validation (@ArrayUnique) runs before the service: duplicates are 400, not 422.
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw crmValidationFailed({ orderedIds: ['array_unique'] });
  }
  if (orderedIds.length !== stages.length) {
    throw new ApiError(422, 'LEAD_STAGE_REORDER_INVALID');
  }

  const byId = new Map(stages.map((item) => [item.id, item]));
  const reordered: LeadStage[] = [];
  for (const id of orderedIds) {
    const found = byId.get(id);
    if (!found) {
      throw new ApiError(422, 'LEAD_STAGE_REORDER_INVALID');
    }
    reordered.push(found);
  }

  const last = reordered.length - 1;
  if (
    reordered.length < 3 ||
    reordered[0]?.flag !== 'NEW' ||
    reordered[last - 1]?.flag !== 'DISQUALIFIED' ||
    reordered[last]?.flag !== 'CONVERTED'
  ) {
    throw new ApiError(422, 'LEAD_STAGE_REORDER_INVALID');
  }

  const now = new Date().toISOString();
  stages = reordered.map((item, index) => ({
    ...item,
    sortOrder: index + 1,
    updatedAt: item.sortOrder !== index + 1 ? now : item.updatedAt,
  }));

  return stages.map(cloneStage);
}

// DELETE /api/tenant/crm/v1/lead-stages/:id (204)
export async function fakeDeleteLeadStage(id: string): Promise<void> {
  await fakeDelay();
  const target = stages.find((item) => item.id === id);
  if (!target) {
    throw new ApiError(404, 'LEAD_STAGE_NOT_FOUND');
  }
  if (isProtectedStage(target)) {
    throw new ApiError(422, 'LEAD_STAGE_PROTECTED');
  }
  if ((usageCounts.get(id) ?? 0) > 0) {
    throw new ApiError(409, 'LEAD_STAGE_IN_USE');
  }
  if (target.isDefault) {
    throw new ApiError(422, 'LEAD_STAGE_DEFAULT_DELETE');
  }

  stages = stages
    .filter((item) => item.id !== id)
    .map((item, index) => ({ ...item, sortOrder: index + 1 }));
  usageCounts.delete(id);
}

// GET /api/tenant/crm/v1/settings (requireQualifiedForConversion from CRM general settings)
export function fakeRequireQualifiedForConversion(): boolean {
  return true;
}

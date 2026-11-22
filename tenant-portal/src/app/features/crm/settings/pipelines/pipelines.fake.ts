import {
  CANONICAL_SYSTEM_STAGE_IDS,
  SYSTEM_STAGE_IDS,
  opportunityStagesStore,
  registerStageUsage,
  resetCanonicalSystemStages,
} from '../opportunity-stages/opportunity-stages.fake';
import { OpportunityStage, StageUsagePipeline } from '../opportunity-stages/opportunity-stages.model';
import { ApiError, checkRequiredText, crmValidationFailed, fakeDelay, fakeId } from '../shared/settings-api';
import {
  AssignmentOptions,
  AssignmentTeamOption,
  AssignmentUserOption,
  CreatePipelineInput,
  PIPELINE_ASSIGNMENT_MAX_COUNT,
  PIPELINE_CODE_MAX,
  PIPELINE_CODE_PATTERN,
  PIPELINE_DESCRIPTION_MAX,
  PIPELINE_MAX_COUNT,
  PIPELINE_NAME_MAX,
  PIPELINE_SEARCH_MAX,
  PIPELINE_STAGE_MAX_COUNT,
  Pipeline,
  PipelineAccessMode,
  PipelineAssignments,
  PipelineReadView,
  PipelineStage,
  ReplaceAssignmentsInput,
  UpdatePipelineInput,
} from './pipelines.model';

const SEED_TIMESTAMP = '2026-01-12T10:00:00.000Z';

interface MembershipRecord {
  id: string;
  opportunityStageId: string;
  opportunityCount: number;
}

interface PipelineRecord {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  description: string | null;
  isActive: boolean;
  accessMode: PipelineAccessMode;
  userIds: string[];
  teamIds: string[];
  memberships: MembershipRecord[];
  createdAt: string;
  updatedAt: string;
}

const CANONICAL_STAGE_SET = new Set<string>(CANONICAL_SYSTEM_STAGE_IDS);
const REQUIRED_FLAGS = new Set(['NEW', 'WON', 'LOST']);

let defaultPipelineId = '01950000-0000-7000-8000-000000000201';
const usedCodes = new Set<string>(['DEFAULT']);

const pipelinesStore: PipelineRecord[] = [
  {
    id: defaultPipelineId,
    code: 'DEFAULT',
    nameAr: 'الافتراضي',
    nameEn: 'Default',
    description: null,
    isActive: true,
    accessMode: 'ALL',
    userIds: [],
    teamIds: [],
    memberships: [
      { id: 'ps-def-1', opportunityStageId: SYSTEM_STAGE_IDS.NEW, opportunityCount: 0 },
      { id: 'ps-def-2', opportunityStageId: SYSTEM_STAGE_IDS.QUALIFICATION, opportunityCount: 0 },
      { id: 'ps-def-3', opportunityStageId: SYSTEM_STAGE_IDS.PROPOSAL, opportunityCount: 0 },
      { id: 'ps-def-4', opportunityStageId: SYSTEM_STAGE_IDS.NEGOTIATION, opportunityCount: 0 },
      { id: 'ps-def-5', opportunityStageId: SYSTEM_STAGE_IDS.WON, opportunityCount: 0 },
      { id: 'ps-def-6', opportunityStageId: SYSTEM_STAGE_IDS.LOST, opportunityCount: 0 },
    ],
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  },
];

export const FAKE_OPPORTUNITY_COUNTS = new Map<string, number>([
  ['ps-def-2', 3],
  ['01950000-0000-7000-8000-000000000430', 2],
]);

function opportunityCountOf(membership: MembershipRecord): number {
  const mapped =
    FAKE_OPPORTUNITY_COUNTS.get(membership.id) ??
    FAKE_OPPORTUNITY_COUNTS.get(membership.opportunityStageId);
  if (mapped !== undefined) return mapped;
  return membership.opportunityCount;
}

const FAKE_USERS: readonly AssignmentUserOption[] = [
  { id: 'u1', label: 'Tariq Al-Mansour', status: 'ACTIVE' },
  { id: 'u2', label: 'Sara El-Sayed', status: 'ACTIVE' },
  { id: 'u3', label: 'Omar Hassan', status: 'ACTIVE' },
  { id: 'u4', label: 'Lina Haddad', status: 'ACTIVE' },
  { id: 'u5', label: 'Karim Nabil', status: 'ACTIVE' },
  { id: 'u6', label: 'Nour Al-Din', status: 'ACTIVE' },
  { id: 'u7', label: 'Maha Youssef', status: 'ACTIVE' },
  { id: 'u8', label: 'Yara Adel', status: 'INVITED' },
];

const FAKE_TEAMS: readonly AssignmentTeamOption[] = [
  { id: 't1', label: 'Enterprise Sales', code: 'ENT-SALES', status: 'ACTIVE' },
  { id: 't2', label: 'SMB Sales', code: 'SMB-SALES', status: 'ACTIVE' },
  { id: 't3', label: 'Account Management', code: 'ACC-MGT', status: 'ACTIVE' },
  { id: 't4', label: 'Channel Partners', code: 'PARTNERS', status: 'ACTIVE' },
];

function stageLookup(): Map<string, OpportunityStage> {
  return new Map(opportunityStagesStore.map((stage) => [stage.id, stage]));
}

function hydrateStage(pipelineId: string, membership: MembershipRecord, rank: number, lookup: Map<string, OpportunityStage>): PipelineStage {
  const stage = lookup.get(membership.opportunityStageId);
  return {
    id: membership.id,
    pipelineId,
    opportunityStageId: membership.opportunityStageId,
    rank,
    nameAr: stage?.nameAr ?? membership.opportunityStageId,
    nameEn: stage?.nameEn ?? membership.opportunityStageId,
    flag: stage?.flag ?? 'DISCOVERY',
    category: stage?.category ?? 'IN_PROGRESS',
    isActive: stage?.isActive ?? false,
    isSystem: stage?.isSystem ?? false,
  };
}

function hydratePipeline(record: PipelineRecord): Pipeline {
  const lookup = stageLookup();
  return {
    id: record.id,
    code: record.code,
    nameAr: record.nameAr,
    nameEn: record.nameEn,
    description: record.description,
    isDefault: record.id === defaultPipelineId,
    isActive: record.isActive,
    accessMode: record.accessMode,
    stages: record.memberships.map((membership, index) => hydrateStage(record.id, membership, index + 1, lookup)),
    assignments: {
      accessMode: record.accessMode,
      userIds: [...record.userIds].sort(),
      teamIds: [...record.teamIds].sort(),
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function computeStageUsageSync(): Record<string, StageUsagePipeline[]> {
  const usage: Record<string, StageUsagePipeline[]> = {};
  for (const pipeline of pipelinesStore) {
    for (const membership of pipeline.memberships) {
      const list = usage[membership.opportunityStageId] ?? [];
      if (!list.some((item) => item.id === pipeline.id)) {
        list.push({ id: pipeline.id, nameAr: pipeline.nameAr, nameEn: pipeline.nameEn });
      }
      usage[membership.opportunityStageId] = list;
    }
  }
  return usage;
}

/**
 * GET crm/pipelines (crm.pipelines.read): active pipelines the actor can reach through ALL, a direct user
 * assignment or a team assignment, ordered by code; no `assignments` (PipelinesService.findAll, includeAssignments
 * false). The fake has no actor, so every active pipeline counts as reachable.
 */
export async function fakeListPipelinesForRead(): Promise<PipelineReadView[]> {
  await fakeDelay();
  return pipelinesStore
    .filter((record) => record.isActive)
    .sort((a, b) => a.code.localeCompare(b.code, 'en') || a.id.localeCompare(b.id, 'en'))
    .map((record) => {
      const { assignments: _assignments, ...view } = hydratePipeline(record);
      return view;
    });
}

export async function fakeListPipelinesConfiguration(): Promise<Pipeline[]> {
  await fakeDelay();
  return pipelinesStore
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code, 'en'))
    .map(hydratePipeline);
}

export async function fakeGetPipelineConfiguration(id: string): Promise<Pipeline> {
  await fakeDelay();
  const record = pipelinesStore.find((item) => item.id === id);
  if (!record) {
    throw new ApiError(404, 'PIPELINE_NOT_FOUND');
  }
  return hydratePipeline(record);
}

export async function fakeCreatePipeline(input: CreatePipelineInput): Promise<Pipeline> {
  await fakeDelay();
  // CreatePipelineDto (pipe, 400): code trimmed + upper-cased then @IsNotEmpty @MaxLength(48) @Matches; names
  // trimmed @IsNotEmpty @MaxLength(80); description trimmed @MaxLength(2000); stageIds @ArrayNotEmpty
  // @ArrayUnique @ArrayMaxSize(100).
  const code = input.code.trim().toUpperCase();
  const nameAr = input.nameAr.trim();
  const nameEn = input.nameEn.trim();
  const description = input.description == null ? null : input.description.trim();
  const details: Record<string, string[]> = {};
  checkRequiredText(details, 'code', code, PIPELINE_CODE_MAX);
  if (!details['code'] && !PIPELINE_CODE_PATTERN.test(code)) details['code'] = ['matches'];
  checkRequiredText(details, 'nameAr', nameAr, PIPELINE_NAME_MAX);
  checkRequiredText(details, 'nameEn', nameEn, PIPELINE_NAME_MAX);
  if (description !== null && description.length > PIPELINE_DESCRIPTION_MAX) details['description'] = ['max_length'];
  if (input.stageIds !== undefined) {
    if (input.stageIds.length === 0) details['stageIds'] = ['array_not_empty'];
    else if (new Set(input.stageIds).size !== input.stageIds.length) details['stageIds'] = ['array_unique'];
    else if (input.stageIds.length > PIPELINE_STAGE_MAX_COUNT) details['stageIds'] = ['array_max_size'];
  }
  if (Object.keys(details).length > 0) throw crmValidationFailed(details);

  // PipelinesService.create: catalogue limit, then code, then the stage set.
  if (pipelinesStore.length >= PIPELINE_MAX_COUNT) {
    throw new ApiError(422, 'PIPELINE_CATALOG_LIMIT_EXCEEDED');
  }
  if (usedCodes.has(code)) {
    throw new ApiError(409, 'PIPELINE_CODE_TAKEN');
  }

  const stageIds = input.stageIds ?? [...CANONICAL_SYSTEM_STAGE_IDS];
  const lookup = stageLookup();
  const resolvedStages: OpportunityStage[] = [];
  for (const stageId of stageIds) {
    const stage = lookup.get(stageId);
    if (!stage || !stage.isActive) {
      throw new ApiError(422, 'PIPELINE_STAGE_SELECTION_INVALID');
    }
    resolvedStages.push(stage);
  }

  const counts = { NEW: 0, WON: 0, LOST: 0 };
  for (const stage of resolvedStages) {
    if (stage.flag === 'NEW') counts.NEW++;
    else if (stage.flag === 'WON') counts.WON++;
    else if (stage.flag === 'LOST') counts.LOST++;
  }
  if (counts.NEW !== 1 || counts.WON !== 1 || counts.LOST !== 1) {
    throw new ApiError(422, 'PIPELINE_STAGES_REQUIRED');
  }
  if (resolvedStages[0]?.flag !== 'NEW') {
    throw new ApiError(422, 'PIPELINE_STAGE_REORDER_INVALID');
  }

  const now = new Date().toISOString();
  const makeDefault = input.isDefault === true;
  if (makeDefault) {
    const previous = pipelinesStore.find((item) => item.id === defaultPipelineId);
    if (previous) {
      previous.updatedAt = now;
    }
  }

  const id = fakeId();
  const created: PipelineRecord = {
    id,
    code,
    nameAr,
    nameEn,
    description,
    isActive: true,
    accessMode: 'ALL',
    userIds: [],
    teamIds: [],
    memberships: resolvedStages.map((stage) => ({
      id: fakeId(),
      opportunityStageId: stage.id,
      opportunityCount: 0,
    })),
    createdAt: now,
    updatedAt: now,
  };

  if (makeDefault) {
    defaultPipelineId = id;
  }
  usedCodes.add(code);
  pipelinesStore.push(created);
  return hydratePipeline(created);
}

export async function fakeUpdatePipeline(id: string, changes: UpdatePipelineInput): Promise<Pipeline> {
  await fakeDelay();
  // UpdatePipelineDto (pipe, 400, before the 404): trimmed names @IsNotEmpty @MaxLength(80); description
  // optional (null clears) @MaxLength(2000).
  const details: Record<string, string[]> = {};
  if (changes.nameAr !== undefined) checkRequiredText(details, 'nameAr', changes.nameAr.trim(), PIPELINE_NAME_MAX);
  if (changes.nameEn !== undefined) checkRequiredText(details, 'nameEn', changes.nameEn.trim(), PIPELINE_NAME_MAX);
  if (typeof changes.description === 'string' && changes.description.trim().length > PIPELINE_DESCRIPTION_MAX) {
    details['description'] = ['max_length'];
  }
  if (Object.keys(details).length > 0) throw crmValidationFailed(details);
  const record = pipelinesStore.find((item) => item.id === id);
  if (!record) {
    throw new ApiError(404, 'PIPELINE_NOT_FOUND');
  }
  if (record.id === defaultPipelineId && changes.isActive === false) {
    throw new ApiError(422, 'PIPELINE_DEFAULT_DEACTIVATE');
  }

  if (changes.nameAr !== undefined) record.nameAr = changes.nameAr.trim();
  if (changes.nameEn !== undefined) record.nameEn = changes.nameEn.trim();
  if (changes.description !== undefined) {
    record.description = changes.description === null ? null : changes.description.trim();
  }
  if (changes.isActive !== undefined) {
    record.isActive = changes.isActive;
  }

  record.updatedAt = new Date().toISOString();
  return hydratePipeline(record);
}

export async function fakeDeletePipeline(id: string): Promise<void> {
  await fakeDelay();
  const index = pipelinesStore.findIndex((item) => item.id === id);
  if (index < 0) {
    throw new ApiError(404, 'PIPELINE_NOT_FOUND');
  }

  const record = pipelinesStore[index];
  if (record.id === defaultPipelineId) {
    throw new ApiError(422, 'PIPELINE_DEFAULT_DELETE');
  }

  const totalOpportunities = record.memberships.reduce((sum, item) => sum + opportunityCountOf(item), 0);
  if (totalOpportunities > 0) {
    // ConflictException with code and message only: no details reach the client.
    throw new ApiError(409, 'PIPELINE_IN_USE');
  }

  pipelinesStore.splice(index, 1);
}

export async function fakeSetDefaultPipeline(id: string, _idempotencyKey?: string): Promise<Pipeline> {
  await fakeDelay();
  const record = pipelinesStore.find((item) => item.id === id);
  if (!record) {
    throw new ApiError(404, 'PIPELINE_NOT_FOUND');
  }
  if (!record.isActive) {
    throw new ApiError(422, 'PIPELINE_DEFAULT_INACTIVE');
  }
  if (record.accessMode === 'RESTRICTED') {
    throw new ApiError(422, 'PIPELINE_DEFAULT_RESTRICTED');
  }

  const now = new Date().toISOString();
  const previous = pipelinesStore.find((item) => item.id === defaultPipelineId);
  if (previous && previous.id !== id) {
    previous.updatedAt = now;
  }
  defaultPipelineId = id;
  record.updatedAt = now;
  return hydratePipeline(record);
}

export async function fakeResetPipeline(id: string): Promise<Pipeline> {
  await fakeDelay();
  const record = pipelinesStore.find((item) => item.id === id);
  if (!record) {
    throw new ApiError(404, 'PIPELINE_NOT_FOUND');
  }
  if (record.id !== defaultPipelineId) {
    throw new ApiError(422, 'PIPELINE_RESET_DEFAULT_ONLY');
  }

  const blocked = record.memberships.some(
    (membership) => !CANONICAL_STAGE_SET.has(membership.opportunityStageId) && opportunityCountOf(membership) > 0,
  );
  if (blocked) {
    throw new ApiError(409, 'PIPELINE_RESET_BLOCKED');
  }

  const now = new Date().toISOString();
  resetCanonicalSystemStages(now);

  const existingByStageId = new Map(record.memberships.map((item) => [item.opportunityStageId, item]));
  record.memberships = CANONICAL_SYSTEM_STAGE_IDS.map((stageId) => {
    const existing = existingByStageId.get(stageId);
    return existing ?? { id: fakeId(), opportunityStageId: stageId, opportunityCount: 0 };
  });
  record.isActive = true;
  record.accessMode = 'ALL';
  record.userIds = [];
  record.teamIds = [];
  record.updatedAt = now;

  return hydratePipeline(record);
}

export async function fakeAddPipelineStage(id: string, opportunityStageId: string): Promise<PipelineStage> {
  await fakeDelay();
  const record = pipelinesStore.find((item) => item.id === id);
  if (!record) {
    throw new ApiError(404, 'PIPELINE_NOT_FOUND');
  }

  const lookup = stageLookup();
  const stage = lookup.get(opportunityStageId);
  if (!stage || !stage.isActive) {
    throw new ApiError(404, 'OPPORTUNITY_STAGE_NOT_FOUND');
  }

  // PipelinesService.addStage: limit, then already assigned, then a second NEW/WON/LOST.
  if (record.memberships.length >= PIPELINE_STAGE_MAX_COUNT) {
    throw new ApiError(422, 'PIPELINE_STAGE_LIMIT');
  }

  if (record.memberships.some((item) => item.opportunityStageId === opportunityStageId)) {
    throw new ApiError(409, 'PIPELINE_STAGE_ALREADY_ASSIGNED');
  }

  if (REQUIRED_FLAGS.has(stage.flag)) {
    const hasFlag = record.memberships.some((item) => lookup.get(item.opportunityStageId)?.flag === stage.flag);
    if (hasFlag) {
      throw new ApiError(422, 'PIPELINE_STAGE_SEMANTIC_DUPLICATE');
    }
  }

  const membership: MembershipRecord = {
    id: fakeId(),
    opportunityStageId,
    opportunityCount: 0,
  };
  record.memberships.push(membership);
  record.updatedAt = new Date().toISOString();

  return hydrateStage(record.id, membership, record.memberships.length, lookup);
}

export async function fakeReorderPipelineStages(
  id: string,
  orderedMembershipIds: string[],
  _idempotencyKey?: string,
): Promise<PipelineStage[]> {
  await fakeDelay();
  // ReorderPipelineStagesDto (pipe, 400): body `orderedIds` @ArrayNotEmpty @ArrayUnique @ArrayMaxSize(100).
  if (orderedMembershipIds.length === 0) throw crmValidationFailed({ orderedIds: ['array_not_empty'] });
  if (new Set(orderedMembershipIds).size !== orderedMembershipIds.length) {
    throw crmValidationFailed({ orderedIds: ['array_unique'] });
  }
  if (orderedMembershipIds.length > PIPELINE_STAGE_MAX_COUNT) {
    throw crmValidationFailed({ orderedIds: ['array_max_size'] });
  }
  const record = pipelinesStore.find((item) => item.id === id);
  if (!record) {
    throw new ApiError(404, 'PIPELINE_NOT_FOUND');
  }

  if (orderedMembershipIds.length !== record.memberships.length) {
    throw new ApiError(422, 'PIPELINE_STAGE_REORDER_INVALID');
  }

  const byId = new Map(record.memberships.map((item) => [item.id, item]));
  const reordered: MembershipRecord[] = [];
  for (const membershipId of orderedMembershipIds) {
    const membership = byId.get(membershipId);
    if (!membership) {
      throw new ApiError(422, 'PIPELINE_STAGE_REORDER_INVALID');
    }
    reordered.push(membership);
  }

  const lookup = stageLookup();
  const firstStage = lookup.get(reordered[0]?.opportunityStageId ?? '');
  if (firstStage?.flag !== 'NEW') {
    throw new ApiError(422, 'PIPELINE_STAGE_REORDER_INVALID');
  }

  record.memberships = reordered;
  record.updatedAt = new Date().toISOString();
  return record.memberships.map((membership, index) => hydrateStage(record.id, membership, index + 1, lookup));
}

export async function fakeRemovePipelineStage(id: string, membershipId: string): Promise<void> {
  await fakeDelay();
  const record = pipelinesStore.find((item) => item.id === id);
  if (!record) {
    throw new ApiError(404, 'PIPELINE_NOT_FOUND');
  }

  const index = record.memberships.findIndex((item) => item.id === membershipId);
  if (index < 0) {
    throw new ApiError(404, 'PIPELINE_STAGE_NOT_FOUND');
  }

  const membership = record.memberships[index];
  const stage = stageLookup().get(membership.opportunityStageId);
  if (stage && REQUIRED_FLAGS.has(stage.flag)) {
    throw new ApiError(422, 'PIPELINE_STAGE_REQUIRED');
  }
  const opportunityCount = opportunityCountOf(membership);
  if (opportunityCount > 0) {
    throw new ApiError(409, 'PIPELINE_STAGE_IN_USE');
  }

  record.memberships.splice(index, 1);
  record.updatedAt = new Date().toISOString();
}

export async function fakeAssignmentOptions(search = '', limit = 50): Promise<AssignmentOptions> {
  await fakeDelay(150);
  // PipelineAssignmentOptionsQueryDto: search trimmed @MaxLength(80); limit @IsInt 1..100 (default 50).
  const term = search.trim();
  if (term.length > PIPELINE_SEARCH_MAX) throw crmValidationFailed({ search: ['max_length'] });
  if (!Number.isInteger(limit) || limit < 1) throw crmValidationFailed({ limit: ['min'] });
  if (limit > 100) throw crmValidationFailed({ limit: ['max'] });
  const lower = term.toLowerCase();
  const byLabel = (a: { label: string }, b: { label: string }) =>
    a.label.toLowerCase().localeCompare(b.label.toLowerCase(), 'en');
  const users = FAKE_USERS.filter((user) => !lower || user.label.toLowerCase().includes(lower))
    .sort(byLabel)
    .slice(0, limit)
    .map((user) => ({ ...user }));
  const teams = FAKE_TEAMS.filter(
    (team) => !lower || team.label.toLowerCase().includes(lower) || team.code.toLowerCase().includes(lower),
  )
    .sort(byLabel)
    .slice(0, limit)
    .map((team) => ({ ...team }));
  return { users, teams };
}

/**
 * PUT crm/pipelines/:id/assignments. Answers the assignments view `{accessMode, userIds, teamIds}` (ids sorted),
 * not the pipeline (PipelinesService.replaceAssignments).
 */
export async function fakeReplaceAssignments(
  id: string,
  input: ReplaceAssignmentsInput,
  _idempotencyKey?: string,
): Promise<PipelineAssignments> {
  await fakeDelay();
  // ReplacePipelineAssignmentsDto (pipe, 400): userIds/teamIds @ArrayUnique @ArrayMaxSize(100).
  const details: Record<string, string[]> = {};
  for (const field of ['userIds', 'teamIds'] as const) {
    const ids = input[field];
    if (new Set(ids).size !== ids.length) details[field] = ['array_unique'];
    else if (ids.length > PIPELINE_ASSIGNMENT_MAX_COUNT) details[field] = ['array_max_size'];
  }
  if (Object.keys(details).length > 0) throw crmValidationFailed(details);

  const record = pipelinesStore.find((item) => item.id === id);
  if (!record) {
    throw new ApiError(404, 'PIPELINE_NOT_FOUND');
  }

  if (record.id === defaultPipelineId && input.accessMode !== 'ALL') {
    throw new ApiError(422, 'PIPELINE_DEFAULT_RESTRICTED');
  }

  const targetCount = input.userIds.length + input.teamIds.length;
  if ((input.accessMode === 'ALL' && targetCount > 0) || (input.accessMode === 'RESTRICTED' && targetCount === 0)) {
    throw new ApiError(422, 'PIPELINE_ASSIGNMENTS_INVALID');
  }

  // Only newly added targets are checked; retained ones stay even if they became ineligible.
  const validUserIds = new Set(FAKE_USERS.map((user) => user.id));
  const validTeamIds = new Set(FAKE_TEAMS.map((team) => team.id));
  if (input.userIds.some((userId) => !record.userIds.includes(userId) && !validUserIds.has(userId))) {
    throw new ApiError(422, 'PIPELINE_ASSIGNMENT_USERS_INVALID');
  }
  if (input.teamIds.some((teamId) => !record.teamIds.includes(teamId) && !validTeamIds.has(teamId))) {
    throw new ApiError(422, 'PIPELINE_ASSIGNMENT_TEAMS_INVALID');
  }

  record.accessMode = input.accessMode;
  record.userIds = [...input.userIds];
  record.teamIds = [...input.teamIds];
  record.updatedAt = new Date().toISOString();

  return {
    accessMode: record.accessMode,
    userIds: [...record.userIds].sort(),
    teamIds: [...record.teamIds].sort(),
  };
}

registerStageUsage(computeStageUsageSync);

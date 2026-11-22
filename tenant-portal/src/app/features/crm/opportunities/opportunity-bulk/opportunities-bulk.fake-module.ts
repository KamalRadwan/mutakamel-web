import { FakeBulkModule, registerFakeBulkModule } from '../../../../shared/bulk-jobs/bulk-jobs.fake';
import {
  BULK_JOB_LIMITS,
  BulkJob,
  BulkJobItem,
  BulkJobItemStatus,
  BulkJobSubmit,
} from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { FAKE_CURRENT_USER_ID, fakeCreate as fakeCreateActivity } from '../../../../shared/widgets/activities/activities.fake';
import {
  ActivityDirection,
  ActivityError,
  ActivityPriority,
  ActivityType,
} from '../../../../shared/widgets/activities/activities.model';
import { ApiError } from '../../settings/shared/settings-api';
import { listAssignableOwners } from '../opportunities.api';
import {
  FAKE_OPPORTUNITY_READ_ONLY,
  RENEWALS_PIPELINE_ID,
  fakeAllOpportunityRows,
  fakeDeleteOpportunity,
  fakeListOpportunityReasons,
  fakeListPipelines,
  fakeMoveOpportunityStage,
  fakePatchOpportunity,
  fakeSearchOpportunities,
  fakeSelectOpportunities,
} from '../opportunities.fake';
import {
  OPPORTUNITY_LIMITS,
  type MoveStageBody,
  type OpportunityRow,
  type OpportunitySearchBody,
  type OwnerOption,
  type PipelineStageView,
  type PipelineView,
  type SelectedOpportunity,
} from '../opportunities.model';
import {
  type BatchAssigneeMode,
  type BatchOrder,
  computeBatchActivitySchedule,
} from './activity-modal/bulk-schedule';
import {
  CRM_OPPORTUNITIES_BULK_APP,
  CRM_OPPORTUNITIES_BULK_MODULE_ID,
} from './bulk-runner';
import { OPPORTUNITY_SELECTION_LIMIT } from './opportunity-selection';

interface ResolvedOpportunityItem {
  entityId: string;
  label: string;
  preStatus?: 'SKIPPED' | 'FAILED';
  code?: string;
  data?: Record<string, string | number | null>;
}

interface ChunkItemOutcome {
  ordinal: number;
  status: BulkJobItemStatus;
  code?: string;
  field?: string;
  refId?: string;
}

const CREATE_ACTIVITY_CHUNK_SIZE = 20;

export const FAKE_CRM_OPPORTUNITIES_BULK = {
  opportunitiesDisabled: false,
};

let cachedOwnerNames = new Map<string, string>();
let cachedPipelines = new Map<string, PipelineView>();

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function currentLang(): 'ar' | 'en' {
  return typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en';
}

function extractSearchBody(query: unknown, fallbackBranchId?: string): OpportunitySearchBody {
  const rec = asRecord(query);
  if (!rec) return { branchId: fallbackBranchId ?? '' };
  const nested = asRecord(rec['search']);
  const source = nested ?? rec;
  return {
    ...(source as Partial<OpportunitySearchBody>),
    branchId: typeof source['branchId'] === 'string' ? source['branchId'] : (fallbackBranchId ?? ''),
  };
}

/** The branchId the QUERY selection carries (top level, or under `search`), as the backend parses it. */
function queryBranchId(query: unknown): unknown {
  const rec = asRecord(query);
  if (!rec) return undefined;
  const source = asRecord(rec['search']) ?? rec;
  return source['branchId'];
}

function toSelectedOpportunityFromResolved(item: ResolvedOpportunityItem): SelectedOpportunity {
  return {
    id: item.entityId,
    title: item.label,
    ownerUserId: typeof item.data?.['ownerUserId'] === 'string' ? item.data['ownerUserId'] : null,
    stageId: typeof item.data?.['stageId'] === 'string' ? item.data['stageId'] : '',
    status: (typeof item.data?.['status'] === 'string' ? item.data['status'] : 'IN_PROGRESS') as SelectedOpportunity['status'],
    updatedAt: typeof item.data?.['updatedAt'] === 'string' ? item.data['updatedAt'] : '',
  };
}

async function refreshOwnerCache(branchId: string | undefined): Promise<Map<string, string>> {
  try {
    const owners: OwnerOption[] = await listAssignableOwners(branchId ?? '');
    const map = new Map<string, string>();
    for (const owner of owners) {
      map.set(owner.id, owner.displayName);
    }
    cachedOwnerNames = map;
    return map;
  } catch {
    return cachedOwnerNames;
  }
}

async function refreshPipelineCache(): Promise<Map<string, PipelineView>> {
  const pipelines = await fakeListPipelines();
  cachedPipelines = new Map(pipelines.map((p) => [p.id, p]));
  return cachedPipelines;
}

async function loadAllOpportunitiesMap(): Promise<Map<string, OpportunityRow>> {
  // Fake-data read of every stored row (not an HTTP mirror: the search route requires a branchId).
  return new Map(fakeAllOpportunityRows().map((row) => [row.id, row]));
}

const ACTIVITY_PARAM_KEYS = new Set(['activity', 'schedule', 'startAt']);
const ACTIVITY_KEYS = new Set([
  'type', 'subject', 'description', 'direction', 'priority',
  'reminderOffsetMinutes', 'location', 'meetingUrl', 'durationMinutes',
]);
const SCHEDULE_KEYS = new Set(['startAt', 'gapMinutes', 'order', 'assignee', 'spacePerAssignee']);

function hasOnlyKeys(rec: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(rec).every((key) => allowed.has(key));
}

function isStrictActivityParams(params: Record<string, unknown> | null): boolean {
  if (!params || !hasOnlyKeys(params, ACTIVITY_PARAM_KEYS)) return false;
  const activity = asRecord(params['activity']);
  const schedule = asRecord(params['schedule']);
  if (!activity || !schedule) return false;
  if (!hasOnlyKeys(activity, ACTIVITY_KEYS) || !('durationMinutes' in activity)) return false;
  if (!hasOnlyKeys(schedule, SCHEDULE_KEYS)) return false;
  if (schedule['order'] !== 'TABLE' && schedule['order'] !== 'OWNER') return false;
  if (typeof schedule['spacePerAssignee'] !== 'boolean') return false;
  const assignee = asRecord(schedule['assignee']);
  if (!assignee) return false;
  switch (assignee['mode']) {
    case 'LEAD_OWNER':
    case 'ME':
      return hasOnlyKeys(assignee, new Set(['mode']));
    case 'USER':
      return hasOnlyKeys(assignee, new Set(['mode', 'userId'])) && asTrimmedString(assignee['userId']).length > 0;
    default:
      return false;
  }
}

async function validateMoveStageAsync(body: BulkJobSubmit): Promise<void> {
  const params = asRecord(body.params);
  const pipelineId = asTrimmedString(params?.['pipelineId']);
  const stageId = asTrimmedString(params?.['stageId']);
  const winReasonId = asTrimmedString(params?.['winReasonId']);
  const lostReasonId = asTrimmedString(params?.['lostReasonId']);
  const lostReason = asTrimmedString(params?.['lostReason']);
  const reason = asTrimmedString(params?.['reason']);

  if (!pipelineId || !stageId) {
    throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
  }
  if (reason.length > OPPORTUNITY_LIMITS.reason || lostReason.length > OPPORTUNITY_LIMITS.reason) {
    throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'reason' });
  }

  const pipelines = await refreshPipelineCache();
  const pipeline = pipelines.get(pipelineId);
  const targetStage: PipelineStageView | undefined = pipeline?.stages.find((s) => s.id === stageId && s.isActive);
  if (!pipeline || !targetStage) {
    throw new ApiError(404, 'PIPELINE_STAGE_NOT_FOUND');
  }

  if (targetStage.flag === 'LOST') {
    if (winReasonId) {
      throw new ApiError(422, 'CRM_REASON_KIND_MISMATCH');
    }
    if (!lostReasonId && !lostReason) {
      throw new ApiError(422, 'OPPORTUNITY_LOST_REASON_REQUIRED');
    }
    if (lostReasonId) {
      const activeLoss = await fakeListOpportunityReasons('LOSS').catch(() => null);
      if (activeLoss && !activeLoss.some((r) => r.id === lostReasonId && r.isActive)) {
        throw new ApiError(422, 'CRM_REASON_UNAVAILABLE');
      }
    }
  } else if (targetStage.flag === 'WON') {
    if (lostReasonId) {
      throw new ApiError(422, 'CRM_REASON_KIND_MISMATCH');
    }
    if (winReasonId) {
      const activeWin = await fakeListOpportunityReasons('WIN').catch(() => null);
      if (activeWin && !activeWin.some((r) => r.id === winReasonId && r.isActive)) {
        throw new ApiError(422, 'CRM_REASON_UNAVAILABLE');
      }
    }
  } else if (winReasonId || lostReasonId) {
    throw new ApiError(422, 'CRM_REASON_KIND_MISMATCH');
  }
}

const CRM_OPPORTUNITIES_FAKE_BULK_MODULE: FakeBulkModule = {
  module: CRM_OPPORTUNITIES_BULK_MODULE_ID,

  chunkSize(action: string): number {
    return action === 'CREATE_ACTIVITY' ? CREATE_ACTIVITY_CHUNK_SIZE : BULK_JOB_LIMITS.chunkSize;
  },

  validate(body: BulkJobSubmit): void {
    if (FAKE_CRM_OPPORTUNITIES_BULK.opportunitiesDisabled) {
      // crm-module-switch disabled(): details.companyId is [] without a company context, else [companyId].
      throw new ApiError(403, 'CRM_OPPORTUNITIES_DISABLED', { companyId: [] });
    }
    if (FAKE_OPPORTUNITY_READ_ONLY) {
      throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
    }
    // Backend authorizeSubmit: a QUERY for another branch than the job scope is refused.
    if (body.selection.kind === 'QUERY' && queryBranchId(body.selection.query) !== body.scope.branchId) {
      throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
    }

    const params = asRecord(body.params);
    switch (body.action) {
      case 'ASSIGN': {
        const ownerUserId = asTrimmedString(params?.['ownerUserId']);
        if (!ownerUserId) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        return;
      }
      case 'MOVE_STAGE': {
        const pipelineId = asTrimmedString(params?.['pipelineId']);
        const stageId = asTrimmedString(params?.['stageId']);
        if (!pipelineId || !stageId) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        const reason = params?.['reason'];
        const lostReason = params?.['lostReason'];
        if (
          (reason !== undefined && reason !== null && (typeof reason !== 'string' || reason.trim().length > OPPORTUNITY_LIMITS.reason)) ||
          (lostReason !== undefined &&
            lostReason !== null &&
            (typeof lostReason !== 'string' || lostReason.trim().length > OPPORTUNITY_LIMITS.reason))
        ) {
          throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'reason' });
        }
        return;
      }
      case 'CREATE_ACTIVITY': {
        // Mirrors the backend strict zod schema: unknown keys and the old shape are rejected.
        if (!isStrictActivityParams(params)) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        const activity = asRecord(params?.['activity']);
        const schedule = asRecord(params?.['schedule']);
        const subject = asTrimmedString(activity?.['subject']);
        if (!subject) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        const startRaw =
          typeof params?.['startAt'] === 'string'
            ? params['startAt']
            : typeof schedule?.['startAt'] === 'string'
              ? schedule['startAt']
              : '';
        const startDate = startRaw ? new Date(startRaw) : null;
        if (!startDate || Number.isNaN(startDate.getTime())) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        if (startDate.getTime() <= Date.now()) {
          throw new ApiError(422, 'OPPORTUNITY_BULK_START_IN_PAST');
        }
        const gapMinutes = Number(schedule?.['gapMinutes']);
        if (!Number.isInteger(gapMinutes) || gapMinutes < 1 || gapMinutes > 1440) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        return;
      }
      case 'DELETE': {
        const reason = params?.['reason'];
        if (
          reason !== undefined &&
          reason !== null &&
          (typeof reason !== 'string' || reason.trim().length > OPPORTUNITY_LIMITS.reason)
        ) {
          throw new ApiError(400, 'CRM_VALIDATION_FAILED', { field: 'reason' });
        }
        return;
      }
      default:
        throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
    }
  },

  /** Submit-time stage and reason checks (assertBulkMoveStage): after validate(), before the BULK_JOB_ACTIVE check. */
  async validateAsync(body: BulkJobSubmit): Promise<void> {
    if (body.action === 'MOVE_STAGE') {
      await validateMoveStageAsync(body);
    }
  },

  async resolve(body: BulkJobSubmit): Promise<ResolvedOpportunityItem[]> {
    await refreshOwnerCache(body.scope.branchId);

    let rows: SelectedOpportunity[] = [];
    const missingIds = new Set<string>();
    let byId: Map<string, OpportunityRow> | null = null;

    if (body.selection.kind === 'QUERY') {
      const searchBody = extractSearchBody(body.selection.query, body.scope.branchId);
      const res = await fakeSelectOpportunities(searchBody, OPPORTUNITY_SELECTION_LIMIT);
      if (res.truncated) {
        throw new ApiError(422, 'BULK_SELECTION_TOO_LARGE', {
          max: [String(BULK_JOB_LIMITS.maxItems)],
        });
      }
      const excluded = new Set(body.selection.excludedIds ?? []);
      rows = res.items.filter((row) => !excluded.has(row.id));
    } else {
      byId = await loadAllOpportunitiesMap();
      for (const id of body.selection.ids) {
        const found = byId.get(id);
        if (found) {
          rows.push({
            id: found.id,
            title: found.title,
            ownerUserId: found.ownerUserId,
            stageId: found.stageId,
            status: found.status,
            updatedAt: found.updatedAt,
          });
        } else {
          missingIds.add(id);
          rows.push({
            id,
            title: '',
            ownerUserId: null,
            stageId: '',
            status: 'IN_PROGRESS',
            updatedAt: '',
          });
        }
      }
    }

    // Backend resolve: MOVE_STAGE items of another pipeline are SKIPPED at submit.
    const movePipelineId = body.action === 'MOVE_STAGE' ? asTrimmedString(asRecord(body.params)?.['pipelineId']) : '';
    if (movePipelineId && !byId) {
      byId = await loadAllOpportunitiesMap();
    }

    return rows.map((row): ResolvedOpportunityItem => {
      if (missingIds.has(row.id)) {
        return {
          entityId: row.id,
          label: row.title,
          preStatus: 'FAILED',
          code: 'OPPORTUNITY_NOT_FOUND',
        };
      }
      const pipelineMismatch = movePipelineId !== '' && byId?.get(row.id)?.pipelineId !== movePipelineId;
      return {
        entityId: row.id,
        label: row.title,
        ...(pipelineMismatch ? { preStatus: 'SKIPPED' as const, code: 'OPPORTUNITY_PIPELINE_MISMATCH' } : {}),
        data: {
          ownerUserId: row.ownerUserId,
          stageId: row.stageId,
          status: row.status,
          updatedAt: row.updatedAt,
        },
      };
    });
  },

  prepare(body: BulkJobSubmit, rawItems: unknown[]): { summary?: Record<string, string | number> } {
    if (body.action !== 'CREATE_ACTIVITY') return {};

    const items = rawItems as ResolvedOpportunityItem[];
    const params = asRecord(body.params);
    const activity = asRecord(params?.['activity']);
    const schedule = asRecord(params?.['schedule']);

    const startRaw =
      typeof params?.['startAt'] === 'string'
        ? params['startAt']
        : typeof schedule?.['startAt'] === 'string'
          ? schedule['startAt']
          : '';
    const start = new Date(startRaw);
    const gapMinutes = Number(schedule?.['gapMinutes'] ?? 15);
    const durationRaw = activity?.['durationMinutes'];
    const durationMinutes = typeof durationRaw === 'number' && durationRaw > 0 ? durationRaw : null;
    const order: BatchOrder = schedule?.['order'] === 'OWNER' ? 'owner' : 'table';
    const assignee = asRecord(schedule?.['assignee']);
    const assigneeMode: BatchAssigneeMode =
      assignee?.['mode'] === 'ME' ? 'me' : assignee?.['mode'] === 'USER' ? 'other' : 'owner';
    const chosenAssigneeId = typeof assignee?.['userId'] === 'string' ? assignee['userId'] : '';
    const spacePerAssignee = Boolean(schedule?.['spacePerAssignee']);

    const pendingItems = items.filter((item) => !item.preStatus);
    const nonPendingItems = items.filter((item) => !!item.preStatus);
    const itemById = new Map(pendingItems.map((item) => [item.entityId, item]));

    const computed = computeBatchActivitySchedule({
      rows: pendingItems.map(toSelectedOpportunityFromResolved),
      start,
      gapMinutes,
      durationMinutes,
      order,
      assigneeMode,
      chosenAssigneeId,
      spacePerAssignee,
      currentUserId: FAKE_CURRENT_USER_ID,
      currentUserName: cachedOwnerNames.get(FAKE_CURRENT_USER_ID) ?? FAKE_CURRENT_USER_ID,
      ownerNames: cachedOwnerNames,
    });

    const orderedPending: ResolvedOpportunityItem[] = [];
    for (const scheduled of computed.items) {
      const target = itemById.get(scheduled.row.id);
      if (!target) continue;
      target.data = {
        ...target.data,
        dueAt: scheduled.dueAt,
        endsAt: scheduled.endsAt,
        assigneeUserId: scheduled.assigneeUserId,
      };
      orderedPending.push(target);
    }

    items.splice(0, items.length, ...orderedPending, ...nonPendingItems);

    if (computed.firstStart && computed.lastStart) {
      return {
        summary: {
          firstDueAt: computed.firstStart.toISOString(),
          lastDueAt: computed.lastStart.toISOString(),
        },
      };
    }
    return {};
  },

  async executeChunk(
    job: BulkJob,
    rawParams: unknown,
    items: BulkJobItem[],
  ): Promise<ChunkItemOutcome[]> {
    if (FAKE_CRM_OPPORTUNITIES_BULK.opportunitiesDisabled) {
      return items.map((item) => ({
        ordinal: item.ordinal,
        status: 'FAILED',
        code: 'CRM_OPPORTUNITIES_DISABLED',
      }));
    }

    const params = asRecord(rawParams);
    const byId = await loadAllOpportunitiesMap();

    switch (job.action) {
      case 'ASSIGN': {
        const ownerUserId = asTrimmedString(params?.['ownerUserId']);
        return Promise.all(
          items.map(async (item): Promise<ChunkItemOutcome> => {
            const existing = byId.get(item.entityId);
            if (!existing) {
              return { ordinal: item.ordinal, status: 'FAILED', code: 'OPPORTUNITY_NOT_FOUND' };
            }
            if (FAKE_OPPORTUNITY_READ_ONLY) {
              return { ordinal: item.ordinal, status: 'SKIPPED', code: 'CRM_SCOPED_PERMISSION_DENIED' };
            }
            if (existing.ownerUserId === ownerUserId) {
              return { ordinal: item.ordinal, status: 'UNCHANGED' };
            }
            if (existing.pipelineId === RENEWALS_PIPELINE_ID && ownerUserId === 'u3') {
              return { ordinal: item.ordinal, status: 'FAILED', code: 'OPPORTUNITY_OWNER_INELIGIBLE' };
            }
            try {
              await fakePatchOpportunity(existing.id, {
                expectedUpdatedAt: existing.updatedAt,
                ownerUserId,
              });
              return { ordinal: item.ordinal, status: 'SUCCEEDED' };
            } catch (error) {
              const code = error instanceof ApiError ? error.code : 'generic';
              return {
                ordinal: item.ordinal,
                status: code === 'CRM_SCOPED_PERMISSION_DENIED' ? 'SKIPPED' : 'FAILED',
                code,
              };
            }
          }),
        );
      }

      case 'MOVE_STAGE': {
        const pipelineId = asTrimmedString(params?.['pipelineId']);
        const stageId = asTrimmedString(params?.['stageId']);
        const winReasonId = asTrimmedString(params?.['winReasonId']);
        const lostReasonId = asTrimmedString(params?.['lostReasonId']);
        const lostReason = asTrimmedString(params?.['lostReason']);
        const reason = asTrimmedString(params?.['reason']);

        return Promise.all(
          items.map(async (item): Promise<ChunkItemOutcome> => {
            const existing = byId.get(item.entityId);
            if (!existing) {
              return { ordinal: item.ordinal, status: 'FAILED', code: 'OPPORTUNITY_NOT_FOUND' };
            }
            if (existing.pipelineId !== pipelineId) {
              return { ordinal: item.ordinal, status: 'SKIPPED', code: 'OPPORTUNITY_PIPELINE_MISMATCH' };
            }
            if (FAKE_OPPORTUNITY_READ_ONLY) {
              return { ordinal: item.ordinal, status: 'SKIPPED', code: 'CRM_SCOPED_PERMISSION_DENIED' };
            }
            if (existing.stageId === stageId) {
              return { ordinal: item.ordinal, status: 'UNCHANGED' };
            }
            const moveBody: MoveStageBody = {
              stageId,
              expectedUpdatedAt: existing.updatedAt,
              ...(winReasonId ? { winReasonId } : {}),
              ...(lostReasonId ? { lostReasonId } : {}),
              ...(lostReason ? { lostReason } : {}),
              ...(reason ? { reason } : {}),
            };
            try {
              await fakeMoveOpportunityStage(existing.id, moveBody);
              return { ordinal: item.ordinal, status: 'SUCCEEDED' };
            } catch (error) {
              const code = error instanceof ApiError ? error.code : 'generic';
              return {
                ordinal: item.ordinal,
                status: code === 'CRM_SCOPED_PERMISSION_DENIED' ? 'SKIPPED' : 'FAILED',
                code,
              };
            }
          }),
        );
      }

      case 'CREATE_ACTIVITY': {
        if (!isStrictActivityParams(params)) {
          return items.map((item) => ({
            ordinal: item.ordinal,
            status: 'FAILED',
            code: 'CRM_VALIDATION_FAILED',
          }));
        }
        const activity = asRecord(params?.['activity']) ?? {};
        const type = (activity['type'] as ActivityType) ?? 'CALL';
        const subject = typeof activity['subject'] === 'string' ? activity['subject'] : '';
        const description = typeof activity['description'] === 'string' ? activity['description'] : undefined;
        const direction =
          typeof activity['direction'] === 'string' ? (activity['direction'] as ActivityDirection) : undefined;
        const priority =
          typeof activity['priority'] === 'string' ? (activity['priority'] as ActivityPriority) : undefined;
        const reminderOffsetMinutes =
          typeof activity['reminderOffsetMinutes'] === 'number' ? activity['reminderOffsetMinutes'] : undefined;
        const location = typeof activity['location'] === 'string' ? activity['location'] : undefined;
        const meetingUrl = typeof activity['meetingUrl'] === 'string' ? activity['meetingUrl'] : undefined;

        return Promise.all(
          items.map(async (item): Promise<ChunkItemOutcome> => {
            const existing = byId.get(item.entityId);
            if (!existing) {
              return { ordinal: item.ordinal, status: 'FAILED', code: 'ACTIVITY_TARGET_NOT_FOUND' };
            }
            if (FAKE_OPPORTUNITY_READ_ONLY) {
              return { ordinal: item.ordinal, status: 'SKIPPED', code: 'CRM_SCOPED_PERMISSION_DENIED' };
            }
            const dueAt =
              typeof item.data?.['dueAt'] === 'string'
                ? item.data['dueAt']
                : new Date(Date.now() + 60_000).toISOString();
            const endsAt = typeof item.data?.['endsAt'] === 'string' ? item.data['endsAt'] : undefined;
            const assigneeUserId =
              typeof item.data?.['assigneeUserId'] === 'string' ? item.data['assigneeUserId'] : undefined;

            try {
              const created = await fakeCreateActivity({
                target: { app: 'CRM', type: 'OPPORTUNITY', id: existing.id },
                type,
                subject,
                ...(description ? { description } : {}),
                ...(direction ? { direction } : {}),
                ...(priority ? { priority } : {}),
                ...(reminderOffsetMinutes !== undefined ? { reminderOffsetMinutes } : {}),
                ...(location ? { location } : {}),
                ...(meetingUrl ? { meetingUrl } : {}),
                dueAt,
                ...(endsAt ? { endsAt } : {}),
                ...(assigneeUserId ? { assigneeUserId } : {}),
                status: 'PLANNED',
              });
              return { ordinal: item.ordinal, status: 'SUCCEEDED', refId: created.id };
            } catch (error) {
              if (error instanceof ActivityError) {
                return {
                  ordinal: item.ordinal,
                  status: 'FAILED',
                  code: error.code,
                  ...(error.field ? { field: error.field } : {}),
                };
              }
              return { ordinal: item.ordinal, status: 'FAILED', code: 'generic' };
            }
          }),
        );
      }

      case 'DELETE': {
        const cleanReason = asTrimmedString(params?.['reason']) || undefined;
        return Promise.all(
          items.map(async (item): Promise<ChunkItemOutcome> => {
            const existing = byId.get(item.entityId);
            if (!existing) {
              return { ordinal: item.ordinal, status: 'FAILED', code: 'OPPORTUNITY_NOT_FOUND' };
            }
            if (FAKE_OPPORTUNITY_READ_ONLY) {
              return { ordinal: item.ordinal, status: 'SKIPPED', code: 'CRM_SCOPED_PERMISSION_DENIED' };
            }
            try {
              await fakeDeleteOpportunity(existing.id, cleanReason);
              return { ordinal: item.ordinal, status: 'SUCCEEDED' };
            } catch (error) {
              const code = error instanceof ApiError ? error.code : 'generic';
              return {
                ordinal: item.ordinal,
                status: code === 'CRM_SCOPED_PERMISSION_DENIED' ? 'SKIPPED' : 'FAILED',
                code,
              };
            }
          }),
        );
      }

      default:
        throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
    }
  },

  async current(entityIds: string[]): Promise<Map<string, Record<string, string | number | null>>> {
    const wanted = new Set(entityIds);
    const byId = await loadAllOpportunitiesMap();
    const map = new Map<string, Record<string, string | number | null>>();
    for (const id of wanted) {
      const opp = byId.get(id);
      if (!opp) continue;
      map.set(id, {
        id: opp.id,
        title: opp.title,
        ownerUserId: opp.ownerUserId,
        pipelineId: opp.pipelineId,
        stageId: opp.stageId,
        stageFlag: opp.stageFlag,
        status: opp.status,
        updatedAt: opp.updatedAt,
      });
    }
    return map;
  },

  paramsSummary(body: BulkJobSubmit): Record<string, string | number | null> {
    const params = asRecord(body.params);
    switch (body.action) {
      case 'ASSIGN': {
        const ownerUserId = asTrimmedString(params?.['ownerUserId']);
        return {
          ownerUserId: ownerUserId || null,
          ownerName: cachedOwnerNames.get(ownerUserId) ?? (ownerUserId || null),
        };
      }
      case 'MOVE_STAGE': {
        const pipelineId = asTrimmedString(params?.['pipelineId']);
        const stageId = asTrimmedString(params?.['stageId']);
        const stage = cachedPipelines.get(pipelineId)?.stages.find((s) => s.id === stageId) ?? null;
        const stageName = stage ? (currentLang() === 'ar' ? stage.nameAr : stage.nameEn) : stageId;
        return {
          pipelineId: pipelineId || null,
          stageId: stageId || null,
          stageName: stageName || null,
          stageFlag: stage?.flag ?? null,
        };
      }
      case 'CREATE_ACTIVITY': {
        const activity = asRecord(params?.['activity']);
        return {
          activityType: typeof activity?.['type'] === 'string' ? activity['type'] : 'CALL',
          subject: typeof activity?.['subject'] === 'string' ? activity['subject'] : '',
        };
      }
      case 'DELETE':
        return {};
      default:
        return {};
    }
  },
};

let registered = false;

export function registerCrmOpportunitiesFakeBulkModule(): void {
  if (registered) return;
  registered = true;
  registerFakeBulkModule(CRM_OPPORTUNITIES_BULK_APP, CRM_OPPORTUNITIES_FAKE_BULK_MODULE);
}

registerCrmOpportunitiesFakeBulkModule();

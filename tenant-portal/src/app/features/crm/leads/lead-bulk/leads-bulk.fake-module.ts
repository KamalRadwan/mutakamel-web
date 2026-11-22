import { FakeBulkModule, registerFakeBulkModule } from '../../../../shared/bulk-jobs/bulk-jobs.fake';
import {
  BULK_JOB_LIMITS,
  BulkJob,
  BulkJobItem,
  BulkJobItemStatus,
  BulkJobSubmit,
} from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { ActivityDirection, ActivityPriority, ActivityType } from '../../../../shared/widgets/activities/activities.model';
import { fakeListReasons } from '../../settings/reasons/reasons.fake';
import { ApiError, newIdempotencyKey } from '../../settings/shared/settings-api';
import { LeadSearchBody } from '../lead-search/lead-search.compile';
import {
  BatchActivityCommon,
  BatchActivityItem,
  BulkItemStatus,
  FAKE_CURRENT_USER_ID,
  fakeActivitiesBatch,
  fakeBulkDelete,
  fakeBulkStage,
  fakeBulkUpdate,
  fakeGetOwnerDisplayName,
  fakeGetStageForBulk,
  fakeIsAssignableOwnerInBranch,
  fakeOwnerNameMap,
  fakeProjectCurrentLeads,
  fakeSelectLeads,
} from '../leads.fake';
import { LeadStatus, StageFlag } from '../leads.model';
import {
  computeBatchActivitySchedule,
  fromBulkActivitySchedule,
  parseBulkActivitySchedule,
} from './activity-modal/bulk-schedule';
import { SELECTION_LIMIT, SelectedRow } from './lead-bulk.model';

interface ResolvedLeadItem {
  entityId: string;
  label: string;
  preStatus?: 'SKIPPED' | 'FAILED';
  code?: string;
  data?: Record<string, string | number | null>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

const QUERY_KEYS = new Set(['search', 'sort']);
const QUERY_SORTS = new Set(['createdAt:ASC', 'createdAt:DESC', 'displayName:ASC', 'displayName:DESC']);

/** Strict like `leadBulkQuerySchema`: `{ search: LeadSearchFiltersDto, sort? }`, and `search.branchId` is required. */
function parseBulkQuery(query: unknown): LeadSearchBody {
  const rec = asRecord(query);
  const search = asRecord(rec?.['search']);
  if (!rec || !search || Object.keys(rec).some((key) => !QUERY_KEYS.has(key))) {
    throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
  }
  if (rec['sort'] !== undefined && !QUERY_SORTS.has(rec['sort'] as string)) {
    throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
  }
  if (typeof search['branchId'] !== 'string' || !search['branchId'].trim()) {
    throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
  }
  return search as unknown as LeadSearchBody;
}

/** Params keys allowed by the strict backend zod schemas (crm-leads-bulk.schemas.ts). */
const PARAM_KEYS: Record<string, ReadonlySet<string>> = {
  ASSIGN: new Set(['ownerUserId']),
  MOVE_STAGE: new Set(['stageId', 'reasonId']),
  DELETE: new Set(['reason']),
  CREATE_ACTIVITY: new Set(['activity', 'schedule', 'startAt']),
};

function assertStrictParams(action: string, params: Record<string, unknown> | null): void {
  const allowed = PARAM_KEYS[action];
  if (!allowed || !params) return;
  if (Object.keys(params).some((key) => !allowed.has(key))) {
    throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
  }
}

/**
 * The handler's `stage()` check: a missing, inactive or Converted stage is LEAD_CONVERSION_REQUIRED;
 * a Disqualified stage needs an active DISQUALIFICATION governed reason, else CRM_REASON_REQUIRED.
 */
async function stageError(stageId: string, reasonId: string | null): Promise<string | null> {
  const stage = stageId ? fakeGetStageForBulk(stageId) : null;
  if (!stage || !stage.isActive || stage.flag === 'CONVERTED') return 'LEAD_CONVERSION_REQUIRED';
  if (stage.flag === 'DISQUALIFIED') {
    if (!reasonId) return 'CRM_REASON_REQUIRED';
    const governed = await fakeListReasons('DISQUALIFICATION', true);
    if (!governed.some((reason) => reason.id === reasonId)) return 'CRM_REASON_REQUIRED';
  }
  return null;
}

function stageParams(params: Record<string, unknown> | null): { stageId: string; reasonId: string | null } {
  const stageId = typeof params?.['stageId'] === 'string' ? params['stageId'].trim() : '';
  const reasonId = typeof params?.['reasonId'] === 'string' && params['reasonId'].trim() ? params['reasonId'].trim() : null;
  return { stageId, reasonId };
}

function mapLegacyStatus(status: BulkItemStatus): BulkJobItemStatus {
  switch (status) {
    case 'UPDATED':
    case 'DELETED':
    case 'CREATED':
      return 'SUCCEEDED';
    case 'UNCHANGED':
      return 'UNCHANGED';
    case 'SKIPPED':
      return 'SKIPPED';
    case 'FAILED':
      return 'FAILED';
  }
}

function currentLang(): 'ar' | 'en' {
  return typeof document !== 'undefined' && document.documentElement.lang === 'ar' ? 'ar' : 'en';
}

function toSelectedRowFromResolved(item: ResolvedLeadItem): SelectedRow {
  return {
    id: item.entityId,
    displayName: item.label,
    ownerUserId: typeof item.data?.['ownerUserId'] === 'string' ? item.data['ownerUserId'] : null,
    stageId: typeof item.data?.['stageId'] === 'string' ? item.data['stageId'] : '',
    stageFlag: (typeof item.data?.['stageFlag'] === 'string' ? item.data['stageFlag'] : 'NEW') as StageFlag,
    status: (typeof item.data?.['status'] === 'string' ? item.data['status'] : 'OPEN') as LeadStatus,
  };
}

function failAll(items: BulkJobItem[], code: string): { ordinal: number; status: BulkJobItemStatus; code: string }[] {
  return items.map((item) => ({ ordinal: item.ordinal, status: 'FAILED' as const, code }));
}

export const FAKE_CRM_LEADS_BULK = {
  leadsDisabled: false,
};

const CREATE_ACTIVITY_CHUNK_SIZE = 20;

export const CRM_LEADS_FAKE_BULK_MODULE: FakeBulkModule = {
  module: 'crm.leads',

  chunkSize(action: string): number {
    return action === 'CREATE_ACTIVITY' ? CREATE_ACTIVITY_CHUNK_SIZE : BULK_JOB_LIMITS.chunkSize;
  },

  validate(body: BulkJobSubmit): void {
    if (FAKE_CRM_LEADS_BULK.leadsDisabled) {
      // crm-module-switch disabled(): details.companyId is [] without a company context, else [companyId].
      throw new ApiError(403, 'CRM_LEADS_DISABLED', { companyId: [] });
    }
    const params = asRecord(body.params);
    assertStrictParams(body.action, params);
    // Shared kit: a BRANCH-scoped handler needs scope.branchId (submit.service.ts).
    const scopeBranchId = body.scope?.branchId?.trim() ?? '';
    if (!scopeBranchId) {
      throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
    }
    // authorizeSubmit: a QUERY selection must search the scope branch.
    if (body.selection.kind === 'QUERY') {
      const search = parseBulkQuery(body.selection.query);
      if (search.branchId !== scopeBranchId) {
        throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
      }
    }
    switch (body.action) {
      case 'ASSIGN': {
        const ownerUserId = typeof params?.['ownerUserId'] === 'string' ? params['ownerUserId'].trim() : '';
        if (!ownerUserId) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        if (!fakeIsAssignableOwnerInBranch(body.scope.branchId, ownerUserId)) {
          throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
        }
        return;
      }
      case 'MOVE_STAGE': {
        if (!stageParams(params).stageId) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        // Stage and governed-reason checks need the async reason lookup; they run first in resolve().
        return;
      }
      case 'DELETE': {
        const reason = params?.['reason'];
        if (reason !== undefined && reason !== null && (typeof reason !== 'string' || reason.length > 1000)) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        return;
      }
      case 'CREATE_ACTIVITY': {
        const activity = asRecord(params?.['activity']);
        const subject = typeof activity?.['subject'] === 'string' ? activity['subject'].trim() : '';
        if (!subject) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        // Strict like the backend zod schema: schedule.assignee.{mode,userId}; the old
        // flat assigneeMode / assigneeUserId keys and lowercase order values are rejected.
        const schedule = parseBulkActivitySchedule(params?.['schedule']);
        if (!schedule) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        const startRaw = typeof params?.['startAt'] === 'string' ? params['startAt'] : schedule.startAt;
        const startDate = new Date(startRaw);
        if (Number.isNaN(startDate.getTime())) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        if (startDate.getTime() <= Date.now()) {
          throw new ApiError(422, 'LEAD_BULK_START_IN_PAST');
        }
        return;
      }
      default:
        throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
    }
  },

  /** Backend authorizeSubmit: stage and reason errors come before the 409 BULK_JOB_ACTIVE check. */
  async validateAsync(body: BulkJobSubmit): Promise<void> {
    if (body.action !== 'MOVE_STAGE') return;
    const { stageId, reasonId } = stageParams(asRecord(body.params));
    const code = await stageError(stageId, reasonId);
    if (code) throw new ApiError(422, code);
  },

  async resolve(body: BulkJobSubmit): Promise<ResolvedLeadItem[]> {
    // Backend resolve(): converted leads are pre-skipped for ASSIGN and MOVE_STAGE (by stage flag).
    const skipConverted = body.action === 'ASSIGN' || body.action === 'MOVE_STAGE';
    const branchId = body.scope.branchId ?? '';

    let rows: SelectedRow[] = [];
    const missingIds = new Set<string>();

    if (body.selection.kind === 'QUERY') {
      const searchBody = { ...parseBulkQuery(body.selection.query), branchId };
      const res = await fakeSelectLeads(searchBody, SELECTION_LIMIT);
      if (res.truncated) {
        throw new ApiError(422, 'BULK_SELECTION_TOO_LARGE', { max: [String(BULK_JOB_LIMITS.maxItems)] });
      }
      const excluded = new Set(body.selection.excludedIds ?? []);
      rows = res.items.filter((row) => !excluded.has(row.id));
    } else {
      const res = await fakeSelectLeads({ branchId }, SELECTION_LIMIT);
      const byId = new Map(res.items.map((row) => [row.id, row]));
      for (const id of body.selection.ids) {
        const found = byId.get(id);
        if (found) {
          rows.push(found);
        } else {
          missingIds.add(id);
          rows.push({
            id,
            displayName: id,
            ownerUserId: null,
            stageId: '',
            stageFlag: 'NEW',
            status: 'OPEN',
          });
        }
      }
    }

    return rows.map((row): ResolvedLeadItem => {
      if (missingIds.has(row.id)) {
        return {
          entityId: row.id,
          label: row.displayName,
          preStatus: 'FAILED',
          code: 'LEAD_NOT_FOUND',
        };
      }
      if (skipConverted && row.stageFlag === 'CONVERTED') {
        return {
          entityId: row.id,
          label: row.displayName,
          preStatus: 'SKIPPED',
          code: 'CONVERTED',
        };
      }
      return {
        entityId: row.id,
        label: row.displayName,
        data: {
          ownerUserId: row.ownerUserId,
          stageId: row.stageId,
          stageFlag: row.stageFlag,
          status: row.status,
        },
      };
    });
  },

  prepare(body: BulkJobSubmit, rawItems: unknown[]): { summary?: Record<string, string | number> } {
    if (body.action !== 'CREATE_ACTIVITY') return {};

    const items = rawItems as ResolvedLeadItem[];
    const params = asRecord(body.params);
    const activity = asRecord(params?.['activity']);
    const schedule = parseBulkActivitySchedule(params?.['schedule']);
    if (!schedule) return {};

    const startRaw = typeof params?.['startAt'] === 'string' ? params['startAt'] : schedule.startAt;
    const start = new Date(startRaw);
    const gapMinutes = schedule.gapMinutes;
    const durationRaw = activity?.['durationMinutes'];
    const durationMinutes = typeof durationRaw === 'number' && durationRaw > 0 ? durationRaw : null;
    const { order, assigneeMode, chosenAssigneeId } = fromBulkActivitySchedule(schedule);
    const spacePerAssignee = schedule.spacePerAssignee;

    const pendingItems = items.filter((item) => !item.preStatus);
    const nonPendingItems = items.filter((item) => !!item.preStatus);
    const itemById = new Map(pendingItems.map((item) => [item.entityId, item]));

    const computed = computeBatchActivitySchedule({
      rows: pendingItems.map(toSelectedRowFromResolved),
      start,
      gapMinutes,
      durationMinutes,
      order,
      assigneeMode,
      chosenAssigneeId,
      spacePerAssignee,
      currentUserId: FAKE_CURRENT_USER_ID,
      currentUserName: fakeGetOwnerDisplayName(FAKE_CURRENT_USER_ID) ?? FAKE_CURRENT_USER_ID,
      ownerNames: fakeOwnerNameMap(),
    });

    const orderedPending: ResolvedLeadItem[] = [];
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
  ): Promise<{ ordinal: number; status: BulkJobItemStatus; code?: string; field?: string; refId?: string }[]> {
    if (FAKE_CRM_LEADS_BULK.leadsDisabled) {
      return items.map((item) => ({
        ordinal: item.ordinal,
        status: 'FAILED' as const,
        code: 'CRM_LEADS_DISABLED',
      }));
    }

    const params = asRecord(rawParams);
    const key = newIdempotencyKey();
    const byLeadId = new Map(items.map((item) => [item.entityId, item]));
    const leadIds = items.map((item) => item.entityId);

    switch (job.action) {
      case 'ASSIGN': {
        const ownerUserId = typeof params?.['ownerUserId'] === 'string' ? params['ownerUserId'] : '';
        // Handler executeChunk: an owner no longer assignable fails every item of the chunk.
        if (!fakeIsAssignableOwnerInBranch(job.scope.branchId, ownerUserId)) {
          return failAll(items, 'CRM_SCOPED_PERMISSION_DENIED');
        }
        const results = await fakeBulkUpdate(leadIds, ownerUserId, key);
        // A lead converted after submit fails with LEAD_ALREADY_CONVERTED (executeBulkLead -> assertNotConverted).
        return results.map((res) => ({
          ordinal: byLeadId.get(res.leadId)!.ordinal,
          status: mapLegacyStatus(res.status),
          ...(res.code ? { code: res.code } : {}),
        }));
      }
      case 'MOVE_STAGE': {
        const { stageId, reasonId } = stageParams(params);
        // Handler executeChunk re-runs stage(): a stage or reason that became invalid fails every item.
        const code = await stageError(stageId, reasonId);
        if (code) return failAll(items, code);
        const results = await fakeBulkStage(leadIds, stageId, reasonId, key);
        return results.map((res) => ({
          ordinal: byLeadId.get(res.leadId)!.ordinal,
          status: mapLegacyStatus(res.status),
          ...(res.code ? { code: res.code } : {}),
        }));
      }
      case 'DELETE': {
        const reason = typeof params?.['reason'] === 'string' ? params['reason'] : null;
        const results = await fakeBulkDelete(leadIds, reason, key);
        return results.map((res) => ({
          ordinal: byLeadId.get(res.leadId)!.ordinal,
          status: mapLegacyStatus(res.status),
          ...(res.code ? { code: res.code } : {}),
        }));
      }
      case 'CREATE_ACTIVITY': {
        const activity = asRecord(params?.['activity']) ?? {};
        const common: BatchActivityCommon = {
          type: (activity['type'] as ActivityType) ?? 'CALL',
          subject: typeof activity['subject'] === 'string' ? activity['subject'] : '',
          ...(typeof activity['description'] === 'string' ? { description: activity['description'] } : {}),
          ...(typeof activity['direction'] === 'string' ? { direction: activity['direction'] as ActivityDirection } : {}),
          ...(typeof activity['priority'] === 'string' ? { priority: activity['priority'] as ActivityPriority } : {}),
          ...(typeof activity['reminderOffsetMinutes'] === 'number'
            ? { reminderOffsetMinutes: activity['reminderOffsetMinutes'] }
            : {}),
          ...(typeof activity['location'] === 'string' ? { location: activity['location'] } : {}),
          ...(typeof activity['meetingUrl'] === 'string' ? { meetingUrl: activity['meetingUrl'] } : {}),
        };

        const batchItems: BatchActivityItem[] = items.map((item) => ({
          target: { app: 'CRM', type: 'LEAD', id: item.entityId },
          dueAt:
            typeof item.data?.['dueAt'] === 'string'
              ? item.data['dueAt']
              : new Date(Date.now() + 60_000).toISOString(),
          ...(typeof item.data?.['endsAt'] === 'string' ? { endsAt: item.data['endsAt'] } : {}),
          ...(typeof item.data?.['assigneeUserId'] === 'string'
            ? { assigneeUserId: item.data['assigneeUserId'] }
            : {}),
        }));

        const response = await fakeActivitiesBatch(common, batchItems, key);
        const byIndex = new Map(response.results.map((entry) => [entry.index, entry]));

        return items.map((item, index) => {
          const res = byIndex.get(index);
          if (!res) {
            return { ordinal: item.ordinal, status: 'FAILED', code: 'generic' };
          }
          if (res.status === 'CREATED') {
            return {
              ordinal: item.ordinal,
              status: 'SUCCEEDED',
              ...(res.activityId ? { refId: res.activityId } : {}),
            };
          }
          return {
            ordinal: item.ordinal,
            status: 'FAILED',
            code: res.code ?? 'generic',
            ...(res.field ? { field: res.field } : {}),
          };
        });
      }
      default:
        throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
    }
  },

  async current(entityIds: string[]): Promise<Map<string, Record<string, string | number | null>>> {
    return fakeProjectCurrentLeads(entityIds);
  },

  paramsSummary(body: BulkJobSubmit): Record<string, string | number | null> {
    const params = asRecord(body.params);
    switch (body.action) {
      case 'ASSIGN': {
        const ownerUserId = typeof params?.['ownerUserId'] === 'string' ? params['ownerUserId'] : '';
        return {
          ownerUserId,
          ownerName: fakeGetOwnerDisplayName(ownerUserId) ?? ownerUserId,
        };
      }
      case 'MOVE_STAGE': {
        const stageId = typeof params?.['stageId'] === 'string' ? params['stageId'] : '';
        const stage = fakeGetStageForBulk(stageId);
        const stageName = stage ? (currentLang() === 'ar' ? stage.nameAr : stage.nameEn) : stageId;
        return {
          stageId,
          stageName,
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

export function registerCrmLeadsFakeBulkModule(): void {
  if (registered) return;
  registered = true;
  registerFakeBulkModule('crm', CRM_LEADS_FAKE_BULK_MODULE);
}

registerCrmLeadsFakeBulkModule();

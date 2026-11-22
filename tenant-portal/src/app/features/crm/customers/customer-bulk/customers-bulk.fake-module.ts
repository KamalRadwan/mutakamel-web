import { FakeBulkModule, registerFakeBulkModule } from '../../../../shared/bulk-jobs/bulk-jobs.fake';
import {
  BULK_JOB_LIMITS,
  BulkJob,
  BulkJobItem,
  BulkJobItemStatus,
  BulkJobSubmit,
} from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { fakeCreate } from '../../../../shared/widgets/activities/activities.fake';
import {
  ACTIVITY_PRIORITIES,
  ACTIVITY_TYPES,
  ActivityDirection,
  ActivityError,
  ActivityPriority,
  ActivityType,
} from '../../../../shared/widgets/activities/activities.model';
import { isValidMeetingLink } from '../../../../shared/widgets/activities/activity-form/activity-form.model';
import { ApiError } from '../../settings/shared/settings-api';
import { isManualStatus } from '../customer-statuses';
import {
  DEFAULT_CUSTOMER_BRANCH_ID,
  FAKE_CURRENT_USER_ID,
  fakeCanManageStatus,
  fakeDeleteCustomer,
  fakeGetCustomer,
  fakeGetCustomerCapabilities,
  fakeListBranchOwners,
  fakePatchCustomer,
  fakeSetCustomerStatus,
} from '../customers.fake';
import { CustomerSearchBody, CustomerStatus, ManualCustomerStatus } from '../customers.model';
import {
  computeCustomerBatchActivitySchedule,
  fromWireCustomerActivitySchedule,
  parseCustomerBulkActivitySchedule,
} from './activity-modal/customer-bulk-schedule';
import { fakeSelectCustomers } from './customer-bulk.api';
import {
  CUSTOMERS_BULK_APP,
  CUSTOMERS_BULK_MODULE_ID,
  CUSTOMER_BULK_REASON_MAX,
  CUSTOMER_SELECTION_LIMIT,
  CustomerBulkSort,
  SelectedCustomerRow,
} from './customer-bulk.model';

interface ResolvedCustomerItem {
  entityId: string;
  label: string;
  preStatus?: 'SKIPPED' | 'FAILED';
  code?: string;
  data?: Record<string, string | number | null>;
}

interface ChunkItemResult {
  ordinal: number;
  status: BulkJobItemStatus;
  code?: string;
  field?: string;
  refId?: string;
}

const CREATE_ACTIVITY_CHUNK_SIZE = 20;
const ACTIVITY_PARAM_KEYS = new Set(['activity', 'schedule']);
const ACTIVITY_KEYS = new Set([
  'type',
  'subject',
  'description',
  'direction',
  'priority',
  'reminderOffsetMinutes',
  'location',
  'meetingUrl',
  'durationMinutes',
]);
const ALLOWED_DIRECTIONS = new Set<string>(['INBOUND', 'OUTBOUND', 'INTERNAL']);
const ALLOWED_REMINDERS = new Set<number>([0, 5, 10, 15, 30, 60, 1440]);
const SORT_FIELDS = new Set(['createdAt', 'displayName', 'updatedAt', 'rating', 'status']);

const ownerNamesCache = new Map<string, string>();
const rowMetaByJobItem = new Map<string, SelectedCustomerRow>();

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function hasOnlyKeys(rec: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(rec).every((key) => allowed.has(key));
}

interface ParamsIssue {
  path: (string | number)[];
  code: string;
  message: string;
}

/** Statuses accepted by the backend schema `customerBulkStatusSchema` (ACTIVE_CUSTOMER is then refused by the domain guard). */
const SCHEMA_STATUSES: readonly string[] = ['PROSPECT', 'ACTIVE_CUSTOMER', 'INACTIVE', 'BLACKLISTED'];

function describeType(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function invalidTypeIssue(path: (string | number)[], expected: string, value: unknown): ParamsIssue {
  return { path, code: 'invalid_type', message: `Invalid input: expected ${expected}, received ${describeType(value)}` };
}

/** zod strictObject issues: a non-object params value, or the unknown keys (one `unrecognized_keys` issue at the root). */
function strictParamsIssues(params: Record<string, unknown> | null, allowed: readonly string[]): ParamsIssue[] {
  if (!params) return [invalidTypeIssue([], 'object', params)];
  const unknown = Object.keys(params).filter((key) => !allowed.includes(key));
  if (unknown.length === 0) return [];
  const label = unknown.length === 1 ? 'key' : 'keys';
  return [
    {
      path: [],
      code: 'unrecognized_keys',
      message: `Unrecognized ${label}: ${unknown.map((key) => `"${key}"`).join(', ')}`,
    },
  ];
}

/** Same error as the bulk kit `parseOrThrow`: 400 BULK_JOB_PARAMS_INVALID with `details.issues`. */
function throwIfIssues(issues: ParamsIssue[]): void {
  if (issues.length > 0) {
    throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID', { issues });
  }
}

function normalizeSort(raw: unknown): CustomerBulkSort | undefined {
  if (typeof raw !== 'string') return undefined;
  const parts = raw.split(':');
  if (parts.length !== 2) return undefined;
  const [field, dir] = parts;
  if (!SORT_FIELDS.has(field)) return undefined;
  if (dir !== 'ASC' && dir !== 'DESC') return undefined;
  return `${field}:${dir}` as CustomerBulkSort;
}

function extractQuerySelection(query: unknown): { search: CustomerSearchBody; sort?: CustomerBulkSort } {
  const rec = asRecord(query);
  if (!rec) return { search: { branchId: '' } };
  if ('search' in rec && typeof rec['search'] === 'object' && rec['search'] !== null && !Array.isArray(rec['search'])) {
    return {
      search: rec['search'] as CustomerSearchBody,
      sort: normalizeSort(rec['sort']),
    };
  }
  return {
    search: rec as unknown as CustomerSearchBody,
    sort: undefined,
  };
}

function isStrictActivityParams(params: Record<string, unknown> | null): boolean {
  if (!params || !hasOnlyKeys(params, ACTIVITY_PARAM_KEYS)) return false;
  const activity = asRecord(params['activity']);
  const schedule = parseCustomerBulkActivitySchedule(params['schedule']);
  if (!activity || !schedule) return false;
  if (!hasOnlyKeys(activity, ACTIVITY_KEYS) || !('durationMinutes' in activity)) return false;

  const type = activity['type'];
  if (typeof type !== 'string' || !(ACTIVITY_TYPES as readonly string[]).includes(type)) return false;

  const subject = asTrimmedString(activity['subject']);
  if (subject.length < 1 || subject.length > 180) return false;

  if (activity['description'] !== undefined) {
    if (typeof activity['description'] !== 'string' || Array.from(activity['description']).length > 4000) {
      return false;
    }
  }

  if (activity['direction'] !== undefined) {
    if (type !== 'CALL' && type !== 'EMAIL') return false;
    if (typeof activity['direction'] !== 'string' || !ALLOWED_DIRECTIONS.has(activity['direction'])) return false;
  }

  if (activity['priority'] !== undefined) {
    if (
      typeof activity['priority'] !== 'string' ||
      !(ACTIVITY_PRIORITIES as readonly string[]).includes(activity['priority'])
    ) {
      return false;
    }
  }

  if (activity['reminderOffsetMinutes'] !== undefined) {
    const rem = activity['reminderOffsetMinutes'];
    if (typeof rem !== 'number' || !Number.isInteger(rem) || rem < 0 || rem > 40320) return false;
  }

  if (activity['location'] !== undefined) {
    if (type !== 'MEETING' && type !== 'VISIT') return false;
    if (typeof activity['location'] !== 'string' || Array.from(activity['location']).length > 180) return false;
  }

  if (activity['meetingUrl'] !== undefined) {
    if (type !== 'MEETING' && type !== 'VISIT') return false;
    const url = activity['meetingUrl'];
    if (typeof url !== 'string' || url.length > 2048 || !isValidMeetingLink(url)) return false;
  }

  const dur = activity['durationMinutes'];
  if (dur !== null && (typeof dur !== 'number' || !Number.isInteger(dur) || dur < 1 || dur > 20160)) {
    return false;
  }

  return true;
}

async function cacheBranchOwners(branchId: string): Promise<void> {
  const owners = await fakeListBranchOwners(branchId || DEFAULT_CUSTOMER_BRANCH_ID);
  for (const owner of owners) {
    ownerNamesCache.set(owner.userId, owner.name);
  }
}

function ownerNameFor(ownerUserId: string | null): string | null {
  if (!ownerUserId) return null;
  return ownerNamesCache.get(ownerUserId) ?? null;
}

const CRM_CUSTOMERS_FAKE_BULK_MODULE: FakeBulkModule = {
  module: CUSTOMERS_BULK_MODULE_ID,

  chunkSize(action: string): number {
    return action === 'CREATE_ACTIVITY' ? CREATE_ACTIVITY_CHUNK_SIZE : BULK_JOB_LIMITS.chunkSize;
  },

  validate(body: BulkJobSubmit): void {
    const scopeBranchId = body.scope?.branchId?.trim() || '';
    if (body.selection.kind === 'QUERY') {
      const { search } = extractQuerySelection(body.selection.query);
      if (scopeBranchId && search.branchId && search.branchId !== scopeBranchId) {
        throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
      }
    }

    const params = asRecord(body.params);
    switch (body.action) {
      case 'ASSIGN': {
        // Backend: z.strictObject({ ownerUserId: z.uuidv7() }) (the fake owners use short ids, so no uuid check).
        const issues = strictParamsIssues(params, ['ownerUserId']);
        const ownerUserId = params?.['ownerUserId'];
        if (typeof ownerUserId !== 'string' || !ownerUserId.trim()) {
          issues.push(
            typeof ownerUserId === 'string'
              ? { path: ['ownerUserId'], code: 'invalid_format', message: 'Invalid UUID' }
              : invalidTypeIssue(['ownerUserId'], 'string', ownerUserId),
          );
        }
        throwIfIssues(issues);
        return;
      }
      case 'SET_STATUS': {
        // Backend: z.strictObject({ status: z.enum([...]) }); ACTIVE_CUSTOMER passes the schema and gets the domain 422.
        const issues = strictParamsIssues(params, ['status']);
        const status = params?.['status'];
        if (typeof status !== 'string' || !SCHEMA_STATUSES.includes(status)) {
          issues.push({
            path: ['status'],
            code: 'invalid_value',
            message: `Invalid option: expected one of ${SCHEMA_STATUSES.map((s) => `"${s}"`).join('|')}`,
          });
        }
        throwIfIssues(issues);
        if (status === 'ACTIVE_CUSTOMER') {
          throw new ApiError(422, 'CUSTOMER_PROFILE_ACTIVATION_REQUIRES_WON');
        }
        if (!isManualStatus(status as CustomerStatus)) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        if (!fakeCanManageStatus()) {
          throw new ApiError(403, 'CUSTOMER_PROFILE_STATUS_MANAGE_REQUIRED');
        }
        return;
      }
      case 'DELETE': {
        // Backend: z.strictObject({ reason: z.string().max(1000).nullish() }).
        const issues = strictParamsIssues(params, ['reason']);
        const reason = params?.['reason'];
        if (reason !== undefined && reason !== null) {
          if (typeof reason !== 'string') {
            issues.push(invalidTypeIssue(['reason'], 'string', reason));
          } else if (reason.length > CUSTOMER_BULK_REASON_MAX) {
            issues.push({
              path: ['reason'],
              code: 'too_big',
              message: `Too big: expected string to have <=${CUSTOMER_BULK_REASON_MAX} characters`,
            });
          }
        }
        throwIfIssues(issues);
        return;
      }
      case 'CREATE_ACTIVITY': {
        if (!isStrictActivityParams(params)) {
          throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
        }
        const schedule = parseCustomerBulkActivitySchedule(params?.['schedule'])!;
        if (Date.parse(schedule.startAt) <= Date.now()) {
          throw new ApiError(422, 'CUSTOMER_BULK_START_IN_PAST');
        }
        return;
      }
      default:
        throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
    }
  },

  async resolve(body: BulkJobSubmit): Promise<ResolvedCustomerItem[]> {
    const branchId = body.scope?.branchId?.trim() || DEFAULT_CUSTOMER_BRANCH_ID;
    await cacheBranchOwners(branchId);

    const caps = await fakeGetCustomerCapabilities(branchId);
    const params = asRecord(body.params);

    if (body.action === 'ASSIGN') {
      const targetOwnerId = asTrimmedString(params?.['ownerUserId']);
      const owners = await fakeListBranchOwners(branchId);
      const allowedInBranch = owners.some((o) => o.userId === targetOwnerId);
      const updateCap = caps.customerProfiles.update;
      const allowedByScope =
        !!updateCap && (updateCap.ownerUserIds === null || updateCap.ownerUserIds.includes(targetOwnerId));
      if (!allowedInBranch || !allowedByScope) {
        throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
      }
    }

    if (body.action === 'SET_STATUS' && !caps.customerProfiles.update) {
      throw new ApiError(403, 'CRM_SCOPED_PERMISSION_DENIED');
    }

    let rows: SelectedCustomerRow[] = [];
    const missingIds = new Set<string>();

    if (body.selection.kind === 'QUERY') {
      const { search, sort } = extractQuerySelection(body.selection.query);
      const effectiveSearch: CustomerSearchBody = {
        ...search,
        branchId: search.branchId || branchId,
      };
      const res = await fakeSelectCustomers(effectiveSearch, sort, CUSTOMER_SELECTION_LIMIT);
      if (res.truncated) {
        throw new ApiError(422, 'BULK_SELECTION_TOO_LARGE', { max: [String(BULK_JOB_LIMITS.maxItems)] });
      }
      const excluded = new Set(body.selection.excludedIds ?? []);
      rows = res.items.filter((row) => !excluded.has(row.id));
    } else {
      const res = await fakeSelectCustomers({ branchId }, undefined, CUSTOMER_SELECTION_LIMIT);
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
            status: 'PROSPECT',
            updatedAt: '',
          });
        }
      }
    }

    const targetStatus = body.action === 'SET_STATUS' ? asTrimmedString(params?.['status']) : '';

    return rows.map((row): ResolvedCustomerItem => {
      if (missingIds.has(row.id)) {
        return {
          entityId: row.id,
          label: row.displayName,
          preStatus: 'FAILED',
          code: 'CUSTOMER_PROFILE_NOT_FOUND',
        };
      }

      rowMetaByJobItem.set(row.id, row);
      const data: Record<string, string | number | null> = {
        ownerUserId: row.ownerUserId,
        ownerName: ownerNameFor(row.ownerUserId),
      };

      if (body.action === 'SET_STATUS' && row.status === targetStatus) {
        return {
          entityId: row.id,
          label: row.displayName,
          preStatus: 'SKIPPED',
          code: 'UNCHANGED',
          data,
        };
      }

      if (body.action === 'DELETE' && row.status === 'BLACKLISTED') {
        return {
          entityId: row.id,
          label: row.displayName,
          preStatus: 'SKIPPED',
          code: 'BLACKLISTED',
          data,
        };
      }

      return {
        entityId: row.id,
        label: row.displayName,
        data,
      };
    });
  },

  prepare(body: BulkJobSubmit, rawItems: unknown[]): { summary?: Record<string, string | number> } {
    if (body.action !== 'CREATE_ACTIVITY') return {};

    const items = rawItems as ResolvedCustomerItem[];
    const params = asRecord(body.params);
    const activity = asRecord(params?.['activity']);
    const schedule = parseCustomerBulkActivitySchedule(params?.['schedule']);
    if (!schedule) return {};

    const start = new Date(schedule.startAt);
    const durationRaw = activity?.['durationMinutes'];
    const durationMinutes = typeof durationRaw === 'number' && durationRaw > 0 ? durationRaw : null;
    const { order, assigneeMode, chosenAssigneeId } = fromWireCustomerActivitySchedule(schedule);

    const pendingItems = items.filter((item) => !item.preStatus);
    const nonPendingItems = items.filter((item) => !!item.preStatus);
    const itemById = new Map(pendingItems.map((item) => [item.entityId, item]));

    const scheduleRows: SelectedCustomerRow[] = pendingItems.map((item) => {
      const cached = rowMetaByJobItem.get(item.entityId);
      return (
        cached ?? {
          id: item.entityId,
          displayName: item.label,
          ownerUserId: typeof item.data?.['ownerUserId'] === 'string' ? item.data['ownerUserId'] : null,
          status: 'PROSPECT',
          updatedAt: '',
        }
      );
    });

    const computed = computeCustomerBatchActivitySchedule({
      rows: scheduleRows,
      start,
      gapMinutes: schedule.gapMinutes,
      durationMinutes,
      order,
      assigneeMode,
      chosenAssigneeId,
      spacePerAssignee: schedule.spacePerAssignee,
      currentUserId: FAKE_CURRENT_USER_ID,
      currentUserName: ownerNamesCache.get(FAKE_CURRENT_USER_ID) ?? FAKE_CURRENT_USER_ID,
      ownerNames: ownerNamesCache,
    });

    const orderedPending: ResolvedCustomerItem[] = [];
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

  async executeChunk(job: BulkJob, rawParams: unknown, items: BulkJobItem[]): Promise<ChunkItemResult[]> {
    const params = asRecord(rawParams);

    switch (job.action) {
      case 'ASSIGN': {
        const ownerUserId = asTrimmedString(params?.['ownerUserId']);
        return Promise.all(
          items.map(async (item): Promise<ChunkItemResult> => {
            try {
              await fakePatchCustomer(item.entityId, { ownerUserId });
              return { ordinal: item.ordinal, status: 'SUCCEEDED' };
            } catch (error) {
              const code = error instanceof ApiError ? error.code : 'generic';
              return { ordinal: item.ordinal, status: 'FAILED', code };
            }
          }),
        );
      }

      case 'SET_STATUS': {
        const status = asTrimmedString(params?.['status']) as ManualCustomerStatus;
        return Promise.all(
          items.map(async (item): Promise<ChunkItemResult> => {
            try {
              const current = await fakeGetCustomer(item.entityId);
              if (current.status === status) {
                return { ordinal: item.ordinal, status: 'SKIPPED', code: 'UNCHANGED' };
              }
              await fakeSetCustomerStatus(item.entityId, status);
              return { ordinal: item.ordinal, status: 'SUCCEEDED' };
            } catch (error) {
              const code = error instanceof ApiError ? error.code : 'generic';
              return { ordinal: item.ordinal, status: 'FAILED', code };
            }
          }),
        );
      }

      case 'CREATE_ACTIVITY': {
        const activity = asRecord(params?.['activity']) ?? {};
        const type = (activity['type'] as ActivityType) ?? 'CALL';
        const subject = asTrimmedString(activity['subject']);
        const description = typeof activity['description'] === 'string' ? activity['description'] : undefined;
        const direction =
          typeof activity['direction'] === 'string' ? (activity['direction'] as ActivityDirection) : undefined;
        const priority =
          typeof activity['priority'] === 'string' ? (activity['priority'] as ActivityPriority) : undefined;
        const reminderOffsetMinutes =
          typeof activity['reminderOffsetMinutes'] === 'number' && ALLOWED_REMINDERS.has(activity['reminderOffsetMinutes'])
            ? activity['reminderOffsetMinutes']
            : typeof activity['reminderOffsetMinutes'] === 'number'
              ? activity['reminderOffsetMinutes']
              : undefined;
        const location = typeof activity['location'] === 'string' ? activity['location'] : undefined;
        const meetingUrl = typeof activity['meetingUrl'] === 'string' ? activity['meetingUrl'] : undefined;

        return Promise.all(
          items.map(async (item): Promise<ChunkItemResult> => {
            try {
              await fakeGetCustomer(item.entityId);
            } catch {
              return { ordinal: item.ordinal, status: 'FAILED', code: 'CUSTOMER_PROFILE_NOT_FOUND' };
            }

            const dueAt =
              typeof item.data?.['dueAt'] === 'string'
                ? item.data['dueAt']
                : new Date(Date.now() + 60_000).toISOString();
            const endsAt = typeof item.data?.['endsAt'] === 'string' ? item.data['endsAt'] : undefined;
            const assigneeUserId =
              typeof item.data?.['assigneeUserId'] === 'string' ? item.data['assigneeUserId'] : undefined;

            try {
              const created = await fakeCreate({
                target: { app: 'CRM', type: 'CUSTOMER_PROFILE', id: item.entityId },
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
        const reason = asTrimmedString(params?.['reason']) || undefined;
        return Promise.all(
          items.map(async (item): Promise<ChunkItemResult> => {
            try {
              await fakeDeleteCustomer(item.entityId, reason);
              return { ordinal: item.ordinal, status: 'SUCCEEDED' };
            } catch (error) {
              const code = error instanceof ApiError ? error.code : 'generic';
              if (code === 'CUSTOMER_PROFILE_BLACKLISTED') {
                return { ordinal: item.ordinal, status: 'SKIPPED', code: 'BLACKLISTED' };
              }
              return { ordinal: item.ordinal, status: 'FAILED', code };
            }
          }),
        );
      }

      default:
        throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID');
    }
  },

  async current(entityIds: string[]): Promise<Map<string, Record<string, string | number | null>>> {
    const map = new Map<string, Record<string, string | number | null>>();
    await Promise.all(
      entityIds.map(async (id) => {
        try {
          const customer = await fakeGetCustomer(id);
          map.set(id, {
            ownerUserId: customer.ownerUserId,
            status: customer.status,
            updatedAt: customer.updatedAt,
          });
        } catch {
          // Deleted or unreachable customer leaves current === null in item list.
        }
      }),
    );
    return map;
  },

  paramsSummary(body: BulkJobSubmit): Record<string, string | number | null> {
    const params = asRecord(body.params);
    switch (body.action) {
      case 'ASSIGN': {
        const ownerUserId = asTrimmedString(params?.['ownerUserId']);
        return {
          ownerUserId: ownerUserId || null,
          ownerName: ownerNameFor(ownerUserId) ?? (ownerUserId || null),
        };
      }
      case 'SET_STATUS': {
        const status = asTrimmedString(params?.['status']);
        return {
          status: status || null,
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

export function registerCrmCustomersFakeBulkModule(): void {
  if (registered) return;
  registered = true;
  registerFakeBulkModule(CUSTOMERS_BULK_APP, CRM_CUSTOMERS_FAKE_BULK_MODULE);
}

registerCrmCustomersFakeBulkModule();

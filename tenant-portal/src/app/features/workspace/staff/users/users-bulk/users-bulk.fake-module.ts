import { ApiError } from '../../../../../core/api/api-errors';
import { toCorePage } from '../../../../../core/api/core-page';
import { fakeId } from '../../../../../core/fake/fake-utils';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import { FakeBulkModule, registerFakeBulkModule } from '../../../../../shared/bulk-jobs/bulk-jobs.fake';
import { BulkJobSubmit } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { fakePreviewSeats } from '../../../seats/seats.fake';
import {
  buildActorMeSync, fakeGetUser, fakeInviteUser, fakeListBranchRoles, fakeListScopeRoles,
  fakeSetBranchRoles, fakeSetScopeRoles, getStaffSeatSource,
} from '../../shared/staff.fake';
import { CreateImportBatchBody, ImportBatchCreated, ImportBatchRow, ImportBatchRowStatus } from '../users.api';

interface AssignmentScope { target: 'TENANT' | 'COMPANY' | 'BRANCH'; companyId?: string; branchId?: string; }
interface AssignParams { roleId: string; confirmAddonCascade: boolean; branchId?: string; scope?: AssignmentScope; }
interface ImportParams { batchId: string; confirmAddonCascade: boolean; skipRolesThatDontFit: boolean; }
interface StagedBatch { created: ImportBatchCreated; rows: ImportBatchRow[]; submitted: boolean; }

const batches = new Map<string, StagedBatch>();
const stagingKeys = new Map<string, { fingerprint: string; created: ImportBatchCreated }>();

export function resetUsersBulkFake(): void {
  batches.clear();
  stagingKeys.clear();
}

function invalidParams(): never { throw new ApiError(400, 'BULK_JOB_PARAMS_INVALID'); }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalidParams();
  return value as Record<string, unknown>;
}
function closed(value: Record<string, unknown>, keys: string[]): void {
  if (Object.keys(value).some((key) => !keys.includes(key))) invalidParams();
}
function nonempty(value: unknown): boolean { return typeof value === 'string' && value.trim().length > 0; }

function validateParams(body: BulkJobSubmit): void {
  if (body.module !== 'core.users' || body.selection.kind !== 'IDS') invalidParams();
  const params = record(body.params);
  if (typeof params['confirmAddonCascade'] !== 'boolean') invalidParams();
  if (body.action === 'ASSIGN_ROLE') {
    closed(params, ['roleId', 'confirmAddonCascade', 'branchId', 'scope']);
    if (!nonempty(params['roleId']) || ('branchId' in params) === ('scope' in params)) invalidParams();
    if ('branchId' in params) {
      if (!nonempty(params['branchId'])) invalidParams();
    } else {
      const scope = record(params['scope']);
      closed(scope, ['target', 'companyId', 'branchId']);
      if (scope['target'] === 'TENANT') {
        if ('companyId' in scope || 'branchId' in scope) invalidParams();
      } else if (scope['target'] === 'COMPANY') {
        if (!nonempty(scope['companyId']) || 'branchId' in scope) invalidParams();
      } else if (scope['target'] === 'BRANCH') {
        if (!nonempty(scope['branchId'])) invalidParams();
      } else invalidParams();
    }
  } else if (body.action === 'IMPORT') {
    closed(params, ['batchId', 'confirmAddonCascade', 'skipRolesThatDontFit']);
    if (!nonempty(params['batchId']) || typeof params['skipRolesThatDontFit'] !== 'boolean') invalidParams();
  } else invalidParams();
}

function getBatch(id: string): StagedBatch {
  const batch = batches.get(id);
  if (!batch) throw new ApiError(404, 'IMPORT_BATCH_NOT_FOUND');
  if (Date.parse(batch.created.expiresAt) <= Date.now()) throw new ApiError(410, 'IMPORT_BATCH_EXPIRED');
  return batch;
}

export async function fakeCreateImportBatch(body: CreateImportBatchBody, key: string): Promise<ImportBatchCreated> {
  const fingerprint = JSON.stringify(body);
  const cached = stagingKeys.get(key);
  if (cached) {
    if (cached.fingerprint !== fingerprint) throw new ApiError(422, 'GW.IDEM.MISMATCH');
    return structuredClone(cached.created);
  }
  if (!body.rows.length || body.rows.length > 5000 || !['STRICT', 'SKIP_ROLES_THAT_DONT_FIT'].includes(body.mode)) invalidParams();
  const existing = getStaffSeatSource().users;
  const emails = new Set<string>();
  const codes = new Set<string>();
  const rows: ImportBatchRow[] = body.rows.map((data, index) => {
    const errors: Record<string, string[]> = {};
    const email = data.email.trim().toLowerCase();
    const code = data.employeeCode?.trim().toLowerCase();
    if (!email || !data.firstName.trim() || !data.lastName.trim()) errors['data'] = ['CORE_VALIDATION_FAILED'];
    if (existing.some((user) => user.email.toLowerCase() === email)) errors['email'] = ['TENANT_EMAIL_TAKEN'];
    if (emails.has(email)) errors['email'] = ['IMPORT_ROW_DUPLICATE_IN_BATCH'];
    if (code && codes.has(code)) errors['employeeCode'] = ['IMPORT_ROW_DUPLICATE_IN_BATCH'];
    emails.add(email);
    if (code) codes.add(code);
    return { id: fakeId(), rowNo: index + 1, data: structuredClone(data), errors,
      status: Object.keys(errors).length ? 'INVALID' : 'VALID', resultCode: null };
  });
  const valid = rows.filter((row) => row.status === 'VALID').length;
  const created = { batchId: fakeId(), total: rows.length, valid, invalid: rows.length - valid,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() };
  batches.set(created.batchId, { created, rows, submitted: false });
  stagingKeys.set(key, { fingerprint, created });
  return structuredClone(created);
}

export async function fakeListImportBatchRows(id: string, query: { page?: number; limit?: number; status?: ImportBatchRowStatus } = {}) {
  const batch = getBatch(id);
  const rows = batch.rows.filter((row) => !query.status || row.status === query.status);
  return structuredClone(toCorePage(rows, Math.max(1, query.page ?? 1), Math.max(1, Math.min(100, query.limit ?? 20))));
}

async function assignRole(userId: string, params: AssignParams): Promise<'SUCCEEDED' | 'UNCHANGED'> {
  const user = await fakeGetUser(userId);
  if (userId === buildActorMeSync().id || user.isTenantOwner) throw new ApiError(403, 'USER_SELF_FORBIDDEN');
  const opts = { confirmAddonCascade: params.confirmAddonCascade };
  if (params.branchId) {
    const existing = await fakeListBranchRoles(userId);
    if (existing.some((grant) => grant.roleId === params.roleId && grant.branchId === params.branchId)) return 'UNCHANGED';
    const next = { roleId: params.roleId, branchId: params.branchId };
    const preview = await fakePreviewSeats([{ kind: 'BULK_ROLE', roleId: params.roleId,
      scope: { target: 'BRANCH', branchId: params.branchId }, userIds: [userId] }]);
    if (!preview.ok) throw new ApiError(422, 'SEAT_CAPACITY_INSUFFICIENT');
    await fakeSetBranchRoles(userId, [...existing.map(({ roleId, branchId }) => ({ roleId, branchId })), next], newIdempotencyKey(), opts);
  } else {
    const scope = params.scope!;
    const existing = await fakeListScopeRoles(userId);
    const next = { roleId: params.roleId, scopeTarget: scope.target, companyId: scope.companyId, branchId: scope.branchId };
    if (existing.some((grant) => grant.roleId === next.roleId && grant.scopeTarget === next.scopeTarget &&
      (grant.companyId ?? null) === (next.companyId ?? null) && (grant.branchId ?? null) === (next.branchId ?? null))) return 'UNCHANGED';
    const preview = await fakePreviewSeats([{ kind: 'BULK_ROLE', roleId: params.roleId, scope, userIds: [userId] }]);
    if (!preview.ok) throw new ApiError(422, 'SEAT_CAPACITY_INSUFFICIENT');
    await fakeSetScopeRoles(userId, [...existing, next], newIdempotencyKey(), opts);
  }
  return 'SUCCEEDED';
}

export const CORE_USERS_FAKE_BULK_MODULE: FakeBulkModule = {
  module: 'core.users',
  validate: validateParams,
  async validateAsync(body) {
    const permission = body.action === 'ASSIGN_ROLE' ? 'users.user.assign_roles' : 'users.user.invite';
    if (!buildActorMeSync().permissions.includes(permission)) throw new ApiError(403, 'MISSING_REQUIRED_PERMISSIONS');
    if (body.action !== 'IMPORT') return;
    const batch = getBatch((body.params as ImportParams).batchId);
    if (batch.submitted) throw new ApiError(409, 'IMPORT_BATCH_ALREADY_SUBMITTED');
    if (!batch.created.valid) throw new ApiError(422, 'IMPORT_BATCH_NO_VALID_ROWS');
    const validIds = new Set(batch.rows.filter((row) => row.status === 'VALID').map((row) => row.id));
    if (body.selection.kind !== 'IDS' || body.selection.ids.length !== validIds.size ||
      new Set(body.selection.ids).size !== validIds.size || body.selection.ids.some((id) => !validIds.has(id))) invalidParams();
  },
  async resolve(body) {
    if (body.selection.kind !== 'IDS') return invalidParams();
    if (body.action === 'IMPORT') {
      const batch = getBatch((body.params as ImportParams).batchId);
      batch.submitted = true;
      return batch.rows.filter((row) => row.status === 'VALID').map((row) => ({ entityId: row.id, label: row.data.email }));
    }
    const users = getStaffSeatSource().users;
    return body.selection.ids.map((id) => {
      const user = users.find((candidate) => candidate.userId === id);
      return { entityId: id, label: user?.name ?? id,
        ...(!user ? { preStatus: 'FAILED' as const, code: 'TENANT_USER_NOT_FOUND' } : {}) };
    });
  },
  async executeChunk(job, rawParams, items) {
    const results: Awaited<ReturnType<FakeBulkModule['executeChunk']>> = [];
    for (const item of items) {
      let row: ImportBatchRow | undefined;
      try {
        if (job.action === 'ASSIGN_ROLE') {
          results.push({ ordinal: item.ordinal, status: await assignRole(item.entityId, rawParams as AssignParams) });
          continue;
        }
        const params = rawParams as ImportParams;
        const batch = batches.get(params.batchId);
        row = batch?.submitted ? batch.rows.find((candidate) => candidate.id === item.entityId) : undefined;
        if (!row) throw new ApiError(404, 'IMPORT_BATCH_NOT_FOUND');
        if (row.status === 'IMPORTED') {
          results.push({ ordinal: item.ordinal, status: 'UNCHANGED' });
          continue;
        }
        if (row.status === 'INVALID') invalidParams();
        let data = row.data;
        if (params.skipRolesThatDontFit) {
          const accepted: NonNullable<typeof data.roleAssignments> = [];
          for (const role of data.roleAssignments ?? []) {
            const preview = await fakePreviewSeats([{ kind: 'IMPORT', rows: [{ ...data, roleAssignments: [...accepted, role] }] }]);
            if (preview.ok) accepted.push(role);
          }
          data = { ...data, roleAssignments: accepted };
        } else {
          const preview = await fakePreviewSeats([{ kind: 'IMPORT', rows: [data] }]);
          if (!preview.ok) throw new ApiError(422, 'SEAT_CAPACITY_INSUFFICIENT');
        }
        const created = await fakeInviteUser(data, newIdempotencyKey());
        row.status = 'IMPORTED';
        row.resultCode = null;
        results.push({ ordinal: item.ordinal, status: 'SUCCEEDED', refId: created.id });
      } catch (error) {
        const code = error instanceof ApiError ? error.code : 'BULK_JOB_ITEM_FAILED';
        if (row && row.status !== 'INVALID') { row.status = 'FAILED'; row.resultCode = code; }
        results.push({ ordinal: item.ordinal, status: 'FAILED', code });
      }
    }
    return results;
  },
  paramsSummary(body): Record<string, string | number | null> {
    const params = record(body.params);
    return body.action === 'IMPORT'
      ? { batchId: String(params['batchId']), confirmAddonCascade: String(params['confirmAddonCascade']), skipRolesThatDontFit: String(params['skipRolesThatDontFit']) }
      : { roleId: String(params['roleId']), target: params['branchId'] ? 'BRANCH' : String(record(params['scope'])['target']), confirmAddonCascade: String(params['confirmAddonCascade']) };
  },
};

registerFakeBulkModule('core', CORE_USERS_FAKE_BULK_MODULE);

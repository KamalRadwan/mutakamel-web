import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { BulkJob, BulkJobItem, BulkJobSubmit } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { fakeGetUser, resetStaffFake, setFakeActor } from '../../shared/staff.fake';
import { CORE_USERS_BULK_MODULE } from './users-bulk.descriptor';
import { CORE_USERS_FAKE_BULK_MODULE as module, fakeCreateImportBatch, fakeListImportBatchRows, resetUsersBulkFake } from './users-bulk.fake-module';

function job(action: string): BulkJob {
  return { id: 'job', app: 'core', module: 'core.users', action, scope: {}, status: 'RUNNING', total: 1, processed: 0,
    counts: { succeeded: 0, unchanged: 0, skipped: 0, failed: 0, cancelled: 0 }, chunkCount: 1, chunksDone: 0,
    paramsSummary: {}, createdAt: new Date().toISOString(), revision: 1 };
}
function item(entityId: string): BulkJobItem { return { entityId, label: entityId, ordinal: 1, status: 'PENDING' }; }
function assignment(params: unknown): BulkJobSubmit {
  return { module: 'core.users', action: 'ASSIGN_ROLE', scope: {}, selection: { kind: 'IDS', ids: ['u-omar'] }, params };
}
const invitation = { email: 'bulk@example.invalid', firstName: 'Bulk', lastName: 'Import', companyId: 'co-eg',
  branchId: 'br-cai', departmentId: 'dp-sales-cai' };

describe('core.users descriptor and fake module', () => {
  beforeEach(() => { resetStaffFake(); resetUsersBulkFake(); setFakeActor('owner'); });

  it('uses exactly core.users and its two uppercase actions', () => {
    expect(CORE_USERS_BULK_MODULE.app).toBe('core');
    expect(CORE_USERS_BULK_MODULE.module).toBe('core.users');
    expect(CORE_USERS_BULK_MODULE.i18nScopes).toEqual(['staff-users']);
    expect(Object.keys(CORE_USERS_BULK_MODULE.actions).sort()).toEqual(['ASSIGN_ROLE', 'IMPORT']);
    expect(module.module).toBe('core.users');
  });

  it('links assignment users by entityId and imported users only by refId', () => {
    expect(CORE_USERS_BULK_MODULE.itemLink!(item('user'), job('ASSIGN_ROLE'))).toEqual({ commands: ['/workspace/staff/users', 'user'] });
    expect(CORE_USERS_BULK_MODULE.itemLink!(item('row'), job('IMPORT'))).toBeNull();
    expect(CORE_USERS_BULK_MODULE.itemLink!({ ...item('row'), refId: 'created' }, job('IMPORT')))
      .toEqual({ commands: ['/workspace/staff/users', 'created'] });
  });

  it('rejects an assignment carrying both branchId and scope', () => {
    expect(() => module.validate!(assignment({ roleId: 'role-hr-viewer', branchId: 'br-cai', scope: { target: 'TENANT' }, confirmAddonCascade: false })))
      .toThrowError(new ApiError(400, 'BULK_JOB_PARAMS_INVALID'));
  });

  it.each([
    { roleId: 'role-hr-viewer', confirmAddonCascade: false, extra: true, branchId: 'br-cai' },
    { roleId: 'role-hr-viewer', confirmAddonCascade: false, scope: { target: 'TENANT', companyId: 'co-eg' } },
    { roleId: 'role-hr-viewer', confirmAddonCascade: false, scope: { target: 'COMPANY', companyId: 'co-eg', branchId: 'br-cai' } },
    { roleId: 'role-hr-viewer', scope: { target: 'TENANT' } },
  ])('rejects non-closed or incomplete assignment params', (params) => {
    expect(() => module.validate!(assignment(params))).toThrowError('BULK_JOB_PARAMS_INVALID');
  });

  it.each([
    { branchId: 'br-cai' }, { scope: { target: 'TENANT' } }, { scope: { target: 'COMPANY', companyId: 'co-eg' } },
  ])('adds a grant to the staff store and returns UNCHANGED on redelivery: %j', async (scope) => {
    const params = { roleId: 'role-hr-viewer', confirmAddonCascade: false, ...scope };
    module.validate!(assignment(params));
    expect(await module.executeChunk(job('ASSIGN_ROLE'), params, [item('u-omar')])).toEqual([{ ordinal: 1, status: 'SUCCEEDED' }]);
    expect(await module.executeChunk(job('ASSIGN_ROLE'), params, [item('u-omar')])).toEqual([{ ordinal: 1, status: 'UNCHANGED' }]);
  });

  it('returns backend missing-user and protected-user codes', async () => {
    const params = { roleId: 'role-hr-viewer', branchId: 'br-cai', confirmAddonCascade: false };
    expect(await module.executeChunk(job('ASSIGN_ROLE'), params, [item('missing'), { ...item('u-owner'), ordinal: 2 }]))
      .toEqual([{ ordinal: 1, status: 'FAILED', code: 'TENANT_USER_NOT_FOUND' }, { ordinal: 2, status: 'FAILED', code: 'USER_SELF_FORBIDDEN' }]);
  });

  it('imports staging row ids, persists placement and marks IMPORTED; redelivery is UNCHANGED', async () => {
    const batch = await fakeCreateImportBatch({ rows: [invitation], mode: 'STRICT' }, 'stage');
    const rows = await fakeListImportBatchRows(batch.batchId, { status: 'VALID' });
    const params = { batchId: batch.batchId, confirmAddonCascade: false, skipRolesThatDontFit: false };
    const body: BulkJobSubmit = { module: 'core.users', action: 'IMPORT', scope: {}, selection: { kind: 'IDS', ids: rows.data.map((row) => row.id) }, params };
    module.validate!(body);
    await module.validateAsync!(body);
    await module.resolve(body, 'u-owner');
    const result = await module.executeChunk(job('IMPORT'), params, [item(rows.data[0].id)]);
    expect(result[0]).toMatchObject({ ordinal: 1, status: 'SUCCEEDED', refId: expect.any(String) });
    expect(await fakeGetUser(result[0].refId!)).toMatchObject(invitation);
    const imported = await fakeListImportBatchRows(batch.batchId, { status: 'IMPORTED' });
    expect(imported.data[0]).toMatchObject({ id: rows.data[0].id, status: 'IMPORTED', resultCode: null });
    expect(await module.executeChunk(job('IMPORT'), params, [item(rows.data[0].id)])).toEqual([{ ordinal: 1, status: 'UNCHANGED' }]);
    await expect(module.validateAsync!(body)).rejects.toMatchObject({ code: 'IMPORT_BATCH_ALREADY_SUBMITTED' });
  });

  it('rejects QUERY and any missing, foreign or invalid staging id', async () => {
    expect(() => module.validate!({ ...assignment({}), selection: { kind: 'QUERY', query: {} } })).toThrowError('BULK_JOB_PARAMS_INVALID');
    const batch = await fakeCreateImportBatch({ rows: [invitation, invitation], mode: 'STRICT' }, 'stage');
    expect(batch).toMatchObject({ total: 2, valid: 1, invalid: 1 });
    const rows = await fakeListImportBatchRows(batch.batchId);
    expect(rows.data[1].errors).toEqual({ email: ['IMPORT_ROW_DUPLICATE_IN_BATCH'] });
    const body: BulkJobSubmit = { module: 'core.users', action: 'IMPORT', scope: {}, selection: { kind: 'IDS', ids: rows.data.map((row) => row.id) },
      params: { batchId: batch.batchId, confirmAddonCascade: false, skipRolesThatDontFit: false } };
    await expect(module.validateAsync!(body)).rejects.toMatchObject({ code: 'BULK_JOB_PARAMS_INVALID' });
    await expect(module.validateAsync!({ ...body, selection: { kind: 'IDS', ids: [] } })).rejects.toMatchObject({ code: 'BULK_JOB_PARAMS_INVALID' });
    await expect(module.validateAsync!({ ...body, selection: { kind: 'IDS', ids: ['foreign'] } })).rejects.toMatchObject({ code: 'BULK_JOB_PARAMS_INVALID' });
  });

  it('preserves staging write idempotency and expiry status 410', async () => {
    const body = { rows: [invitation], mode: 'STRICT' as const };
    const batch = await fakeCreateImportBatch(body, 'stage');
    expect(await fakeCreateImportBatch(body, 'stage')).toEqual(batch);
    await expect(fakeCreateImportBatch({ ...body, rows: [] }, 'stage')).rejects.toMatchObject({ code: 'GW.IDEM.MISMATCH' });
    const now = vi.spyOn(Date, 'now').mockReturnValue(Date.parse(batch.expiresAt));
    try { await expect(fakeListImportBatchRows(batch.batchId)).rejects.toMatchObject({ status: 410, code: 'IMPORT_BATCH_EXPIRED' }); }
    finally { now.mockRestore(); }
  });
});

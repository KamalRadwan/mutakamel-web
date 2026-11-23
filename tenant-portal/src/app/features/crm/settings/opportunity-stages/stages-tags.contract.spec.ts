import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, fieldErrorsOf } from '../../../../core/api/api-errors';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { CRM_SETTINGS_FIXTURES } from '../../shared/testing/crm-settings-fixtures';
import { listPipelinesConfiguration } from '../pipelines/pipelines.api';
import {
  beginOpportunityStageEdit, createOpportunityStage, deleteOpportunityStage,
  listOpportunityStages, stageUsage, updateOpportunityStage,
} from './opportunity-stages.api';
import type { OpportunityStage } from './opportunity-stages.model';

const id = '018f0000-0000-7000-8000-000000000421';
const row: OpportunityStage = {
  id, nameAr: 'جديدة', nameEn: 'New', flag: 'NEW', category: 'OPEN',
  isActive: true, isSystem: true, createdAt: '2026-11-18T00:00:00Z', updatedAt: '2026-11-18T00:00:00Z',
};
const input = { nameAr: 'مراجعة', nameEn: 'Review', flag: 'DISCOVERY', category: 'IN_PROGRESS' } as const;
const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('opportunity stages transport contract', () => {
  let stub: CrmHttpStub;
  let dispose: () => void;
  beforeEach(() => {
    stub = new CrmHttpStub({ '/opportunity-stages': [row], '/pipelines/configuration': CRM_SETTINGS_FIXTURES['/pipelines/configuration'] });
    dispose = bindCrmHttpForTest(stub);
  });
  afterEach(() => { crmQueries().clear(); dispose(); vi.restoreAllMocks(); });

  it('reads the bare list through the settings query cache', async () => {
    const read = vi.spyOn(stub, 'read');
    expect(await listOpportunityStages()).toEqual([row]);
    expect(read).toHaveBeenCalledWith('/opportunity-stages');
    expect(crmQueries().getQueryData(['crm-settings', 'opportunity-stages'])).toEqual([row]);
  });

  it('groups usage from the exported pipeline configuration API', async () => {
    const pipelines = await listPipelinesConfiguration();
    const usage = await stageUsage();
    expect(pipelines.length).toBeGreaterThan(0);
    expect(Object.keys(usage).length).toBeGreaterThan(0);
    for (const pipeline of pipelines) {
      for (const membership of pipeline.stages) {
        expect(usage[membership.opportunityStageId]).toContainEqual({
          id: pipeline.id, nameAr: pipeline.nameAr, nameEn: pipeline.nameEn,
        });
      }
    }
  });

  it('preserves POST, PATCH and DELETE paths and invalidates successful writes', async () => {
    const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
    const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
    await createOpportunityStage(input);
    await updateOpportunityStage(id, { nameEn: 'Renamed' });
    await deleteOpportunityStage(id);
    const writes = stub.recordedWrites();
    expect(writes.map(({ method, path, body }) => ({ method, path, body }))).toEqual([
      { method: 'POST', path: '/opportunity-stages', body: input },
      { method: 'PATCH', path: `/opportunity-stages/${id}`, body: { nameEn: 'Renamed' } },
      { method: 'DELETE', path: `/opportunity-stages/${id}`, body: undefined },
    ]);
    for (const write of writes) {
      expect(write.options.key).toMatch(uuidV7);
      expect(write.options.scope).toBeUndefined();
    }
    expect(new Set(writes.map((write) => write.options.key)).size).toBe(3);
    expect(cancel).toHaveBeenCalledTimes(3);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-settings', 'opportunity-stages'] });
  });

  for (const method of ['POST', 'PATCH', 'DELETE'] as const) {
    for (const failure of [new ApiError(0, 'NETWORK_ERROR'), new ApiError(503, 'INTERNAL_ERROR'), new ApiError(409, 'GW.IDEM.IN_FLIGHT'), new ApiError(401, 'UNAUTHORIZED')]) {
      it(`${method} keeps the key and body after ${failure.code}, without an automatic retry`, async () => {
        const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(failure);
        const action = () => method === 'POST' ? createOpportunityStage(input)
          : method === 'PATCH' ? updateOpportunityStage(id, { nameEn: 'Renamed' }) : deleteOpportunityStage(id);
        await expect(action()).rejects.toBe(failure);
        expect(write).toHaveBeenCalledTimes(1);
        await action();
        expect(write.mock.calls[0][3].key).toMatch(uuidV7);
        expect(write.mock.calls[1]).toEqual(write.mock.calls[0]);
      });
    }
  }

  it('changes the key when the body changes or a new form opens', async () => {
    const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(503, 'INTERNAL_ERROR'));
    await expect(createOpportunityStage(input)).rejects.toBeInstanceOf(ApiError);
    await createOpportunityStage({ ...input, nameEn: 'Changed' });
    expect(write.mock.calls[1][3].key).not.toBe(write.mock.calls[0][3].key);
    write.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
    await expect(createOpportunityStage(input)).rejects.toBeInstanceOf(ApiError);
    beginOpportunityStageEdit(null);
    await createOpportunityStage(input);
    expect(write.mock.calls[3][3].key).not.toBe(write.mock.calls[2][3].key);
  });

  for (const [status, code] of [
    [400, 'CRM_VALIDATION_FAILED'], [403, 'CRM_PERMISSION_DENIED'], [404, 'OPPORTUNITY_STAGE_NOT_FOUND'],
    [409, 'OPPORTUNITY_STAGE_IN_USE'], [422, 'OPPORTUNITY_STAGE_SYSTEM_PROTECTED'],
    [422, 'OPPORTUNITY_STAGE_CATEGORY_INVALID'], [422, 'OPPORTUNITY_STAGE_LIMIT_EXCEEDED'],
    [422, 'GW.IDEM.MISMATCH'], [429, 'RATE_LIMITED'],
  ] as const) {
    it(`preserves ${code} without retrying or invalidating`, async () => {
      const error = new ApiError(status, code, code === 'CRM_VALIDATION_FAILED' ? { nameEn: ['The name must not be empty'] } : undefined);
      const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(error);
      const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
      await expect(updateOpportunityStage(id, { nameEn: '' })).rejects.toBe(error);
      expect(write).toHaveBeenCalledTimes(1);
      expect(invalidate).not.toHaveBeenCalled();
      if (code === 'CRM_VALIDATION_FAILED') expect(Object.keys(fieldErrorsOf(error))).toEqual(['nameEn']);
      await updateOpportunityStage(id, { nameEn: '' });
      expect(write.mock.calls[1][3].key).not.toBe(write.mock.calls[0][3].key);
    });
  }
});

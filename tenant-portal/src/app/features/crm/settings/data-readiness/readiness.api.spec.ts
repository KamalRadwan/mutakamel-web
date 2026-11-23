import { vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { bindCrmHttpForTest } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import { getReadiness, listReadiness } from './readiness.api';

describe('readiness API', () => {
  let stub: CrmHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    stub = new CrmHttpStub({ '/analytics/readiness': { items: [] } });
    dispose = bindCrmHttpForTest(stub);
  });

  afterEach(() => { vi.restoreAllMocks(); dispose(); });

  it('reads the bare list without a status filter', async () => {
    const read = vi.spyOn(stub, 'read');
    expect(await listReadiness()).toEqual({ items: [] });
    expect(read).toHaveBeenCalledExactlyOnceWith('/analytics/readiness');
    expect(stub.recordedWrites()).toEqual([]);
  });

  it('passes source, opaque cursor and limit without transforming the response', async () => {
    const body = { sourceKey: 'crm.leads', affected: [], pageInfo: { limit: 20, hasMore: false, nextCursor: null } };
    const read = vi.spyOn(stub, 'read').mockResolvedValue(body);
    expect(await getReadiness('crm.leads')).toEqual(body);
    expect(read).toHaveBeenLastCalledWith('/analytics/readiness/crm.leads', { cursor: null, limit: 20 });
    await getReadiness('crm.leads', { cursor: 'opaque_cursor', limit: 40 });
    expect(read).toHaveBeenLastCalledWith('/analytics/readiness/crm.leads', { cursor: 'opaque_cursor', limit: 40 });
    await getReadiness('crm.test/segment');
    expect(read).toHaveBeenLastCalledWith('/analytics/readiness/crm.test%2Fsegment', { cursor: null, limit: 20 });
  });

  it.each([0, 400, 401, 403, 404, 429, 503])('propagates status %s without automatic retries', async (status) => {
    const error = new ApiError(status, 'TEST_ERROR');
    const read = vi.spyOn(stub, 'read').mockRejectedValue(error);
    await expect(listReadiness()).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(1);
    await expect(getReadiness('crm.leads')).rejects.toBe(error);
    expect(read).toHaveBeenCalledTimes(2);
  });
});

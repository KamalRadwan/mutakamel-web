import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import { bindCrmHttpForTest, crmQueries } from '../../shared/crm-http';
import { CrmHttpStub } from '../../shared/testing/crm-http-testing';
import {
  cancelAccessRequest, cancelOwnerReview, decideAccessRequest, executeOwnerTransfer,
  getAccessRequest, getOwnerReview, listAccessRequests, listOwnerReviews, listReviewTargets,
  proposeOwner, submitAccessRequest,
} from './access.api';

const requestBody = { resourceType: 'DASHBOARD' as const, resourceId: 'dashboard-id', requestedLevel: 'VIEW' as const, purpose: 'Review results' };
const response = { status: 200, data: { id: 'request-id', revision: 4 }, etag: null, location: null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('AccessApi', () => {
  let stub: CrmHttpStub;
  let dispose: () => void;
  beforeEach(() => {
    crmQueries().clear();
    stub = new CrmHttpStub({
      '/dashboards/access-requests': { items: [], pageInfo: { limit: 25, hasMore: false, nextCursor: null } },
      '/dashboards/access-requests/request-id': response.data,
      '/dashboards/owner-reviews': { items: [], pageInfo: { limit: 25, hasMore: false, nextCursor: null } },
      '/dashboards/owner-reviews/review-id': response.data,
      '/widgets/widget-id/ownership-transfer/targets': { items: [{ id: 'owner-id', name: 'Owner' }], nextCursor: null },
    });
    dispose = bindCrmHttpForTest(stub);
  });
  afterEach(() => { dispose(); crmQueries().clear(); vi.restoreAllMocks(); });

  it('request from forbidden state', async () => {
    const key = newIdempotencyKey();
    const cancel = vi.spyOn(crmQueries(), 'cancelQueries');
    const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
    await submitAccessRequest(requestBody, key);
    expect(stub.recordedWrites()).toEqual([{
      method: 'POST', path: '/dashboards/access-requests', body: requestBody,
      options: { key, ifMatch: undefined },
    }]);
    expect(key).toMatch(uuid);
    expect(cancel).toHaveBeenCalledWith({ queryKey: ['crm-analytics'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['crm-analytics'] });
  });

  it('reads both boxes, cursor pages, details and owner reviews through analytics queries', async () => {
    const read = vi.spyOn(stub, 'read');
    const fetch = vi.spyOn(crmQueries(), 'fetchQuery');
    await listAccessRequests('mine', { status: 'ALL', cursor: 'next', limit: 10 });
    await listAccessRequests('inbox');
    await getAccessRequest('request-id');
    await listOwnerReviews({ status: 'ALL' });
    await getOwnerReview('review-id');
    expect(read.mock.calls).toEqual([
      ['/dashboards/access-requests', { box: 'mine', status: 'ALL', cursor: 'next', limit: 10 }],
      ['/dashboards/access-requests', { box: 'inbox' }],
      ['/dashboards/access-requests/request-id', undefined],
      ['/dashboards/owner-reviews', { status: undefined }],
      ['/dashboards/owner-reviews/review-id', undefined],
    ]);
    expect(fetch.mock.calls.every(([options]) => options.queryKey[0] === 'crm-analytics')).toBe(true);
  });

  it('sends an action key, revision and matching ETag on every revisioned command without scope headers', async () => {
    await cancelAccessRequest('request-id', 4);
    await decideAccessRequest('request-id', { revision: 4, decision: 'REJECTED', note: 'Not needed' });
    await proposeOwner('review-id', { revision: 4, proposedOwnerUserId: 'owner-id', reason: 'Handover' });
    await cancelOwnerReview('review-id', 4);
    await executeOwnerTransfer('review-id', { revision: 4, reason: 'Handover' }, newIdempotencyKey());
    const writes = stub.recordedWrites();
    expect(writes.map(row => row.path)).toEqual([
      '/dashboards/access-requests/request-id/cancel', '/dashboards/access-requests/request-id/decision',
      '/dashboards/owner-reviews/review-id/proposal', '/dashboards/owner-reviews/review-id/cancel',
      '/dashboards/owner-reviews/review-id/transfer',
    ]);
    for (const row of writes) {
      expect(row.options.key).toMatch(uuid);
      expect(row.options.scope).toBeUndefined();
      expect(row.body).toMatchObject({ revision: 4 });
      expect(row.options.ifMatch).toBe(row.path.includes('owner-reviews') ? '"owner-review:review-id:4"' : '"access-request:request-id:4"');
    }
  });

  it.each([0, 401, 503])('retains the exact decision key after status %s and changes it for new terms', async status => {
    const write = vi.spyOn(stub, 'write').mockRejectedValueOnce(new ApiError(status, 'NETWORK')).mockResolvedValue(response);
    const body = { revision: 4, decision: 'APPROVED' as const, grantedLevel: 'VIEW' as const };
    await expect(decideAccessRequest('retry-id', body)).rejects.toBeInstanceOf(ApiError);
    await decideAccessRequest('retry-id', body);
    expect(write.mock.calls[0][3].key).toBe(write.mock.calls[1][3].key);
    await decideAccessRequest('retry-id', { ...body, note: 'Changed' });
    expect(write.mock.calls[2][3].key).not.toBe(write.mock.calls[1][3].key);
  });

  it('does not retry errors automatically and invalidates failed writes', async () => {
    const error = new ApiError(409, 'CRM_ACCESS_REQUEST_PENDING_EXISTS');
    const write = vi.spyOn(stub, 'write').mockRejectedValue(error);
    const invalidate = vi.spyOn(crmQueries(), 'invalidateQueries');
    await expect(submitAccessRequest(requestBody, newIdempotencyKey())).rejects.toBe(error);
    expect(write).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalled();
  });

  it('loads actual eligible transfer targets, including later pages', async () => {
    const read = vi.spyOn(stub, 'read');
    read.mockResolvedValueOnce({ items: [{ id: 'first', name: 'First' }], nextCursor: 'next' });
    read.mockResolvedValueOnce({ items: [{ id: 'second', name: null }], nextCursor: null });
    expect((await listReviewTargets('widget-id')).map(row => row.id)).toEqual(['first', 'second']);
    expect(read.mock.calls[1]).toEqual(['/widgets/widget-id/ownership-transfer/targets', { cursor: 'next', limit: 50 }]);
  });
});

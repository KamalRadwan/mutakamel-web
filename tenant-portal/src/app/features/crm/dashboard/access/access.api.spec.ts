import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError, newIdempotencyKey } from '../../../../shared/widgets/dashboard/analytics-api';
import { errorDetailField } from '../shared/api-error-details';
import {
  decideAccessRequest,
  executeOwnerTransfer,
  getOwnerReview,
  listAccessRequests,
  listOwnerReviews,
  proposeOwner,
  submitAccessRequest,
} from './access.api';
import { FAKE_ACTIVE_PEOPLE } from './access.fake';
import { bindAnalyticsPermissions } from '../../../../shared/widgets/dashboard/analytics-permissions';
import { ANALYTICS_PERMISSIONS_FIXTURE } from '../../../../shared/widgets/dashboard/analytics-permissions.fixture';

beforeEach(() => bindAnalyticsPermissions(() => ANALYTICS_PERMISSIONS_FIXTURE));
afterEach(() => bindAnalyticsPermissions(() => []));

// Contract: crm-app src/crm/dashboards/access (access-request.service.ts, owner-review.service.ts).

async function rejection(work: Promise<unknown>): Promise<ApiError> {
  try {
    await work;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

const WIDGET_NONE = '01934b20-0000-7000-8000-000000000110';
const REVIEW_OPEN = '01934b70-0000-7000-8000-000000000001';

describe('access requests fake (backend contract)', () => {
  it('lists as a cursor page with pageInfo and the default limit 25', async () => {
    const page = await listAccessRequests('mine');
    expect(page.pageInfo.limit).toBe(25);
    expect(page.pageInfo).toHaveProperty('nextCursor');
    expect(page.items[0]).toHaveProperty('resourceName');
  });

  it('answers only PENDING in the inbox when no status is sent, and every status for status=ALL', async () => {
    const pending = await listAccessRequests('inbox');
    expect(pending.items.every((item) => item.status === 'PENDING')).toBe(true);
    const all = await listAccessRequests('inbox', { status: 'ALL' });
    expect(all.items.length).toBeGreaterThanOrEqual(pending.items.length);
  });

  it('enforces the gateway key: missing is 400 GW.IDEM.MISSING, not a UUIDv7 is 400 GW.IDEM.BAD_VALUE', async () => {
    const body = { resourceType: 'WIDGET' as const, resourceId: WIDGET_NONE, requestedLevel: 'VIEW' as const, purpose: 'Review' };
    expect((await rejection(submitAccessRequest(body, ''))).code).toBe('GW.IDEM.MISSING');
    const bad = await rejection(submitAccessRequest(body, 'not-a-key'));
    expect([bad.status, bad.code]).toEqual([400, 'GW.IDEM.BAD_VALUE']);
  });

  it('validates the DTO with 400 CRM_VALIDATION_FAILED and { field: [snake_case] } details', async () => {
    const error = await rejection(
      submitAccessRequest(
        { resourceType: 'WIDGET', resourceId: WIDGET_NONE, requestedLevel: 'VIEW', purpose: 'x'.repeat(251) },
        newIdempotencyKey(),
      ),
    );
    expect([error.status, error.code]).toEqual([400, 'CRM_VALIDATION_FAILED']);
    expect(error.details).toEqual({ purpose: ['max_length'] });
    expect(errorDetailField(error)).toBe('purpose');
  });

  it('replays the same key and refuses the same key with other terms (422 CRM_IDEMPOTENCY_KEY_REUSED)', async () => {
    const key = newIdempotencyKey();
    const body = { resourceType: 'WIDGET' as const, resourceId: WIDGET_NONE, requestedLevel: 'VIEW' as const, purpose: 'Quarterly review' };
    const first = await submitAccessRequest(body, key);
    const replay = await submitAccessRequest(body, key);
    expect(replay.id).toBe(first.id);
    const reused = await rejection(submitAccessRequest({ ...body, purpose: 'Other' }, key));
    expect([reused.status, reused.code]).toEqual([422, 'CRM_IDEMPOTENCY_KEY_REUSED']);
    const pending = await rejection(submitAccessRequest(body, newIdempotencyKey()));
    expect([pending.status, pending.code]).toEqual([409, 'CRM_ACCESS_REQUEST_PENDING_EXISTS']);
  });

  it('answers a missing target with the request 404', async () => {
    const error = await rejection(
      submitAccessRequest(
        { resourceType: 'DASHBOARD', resourceId: '01934b15-0000-7000-8000-0000000009ff', requestedLevel: 'VIEW', purpose: 'p' },
        newIdempotencyKey(),
      ),
    );
    expect([error.status, error.code]).toEqual([404, 'CRM_ACCESS_REQUEST_NOT_FOUND']);
  });

  it('rejects without a note as 422 CRM_ACCESS_REQUEST_NOTE_REQUIRED (no details)', async () => {
    const error = await rejection(
      decideAccessRequest('01934b50-0000-7000-8000-000000000011', { revision: 1, decision: 'REJECTED' }),
    );
    expect([error.status, error.code]).toEqual([422, 'CRM_ACCESS_REQUEST_NOTE_REQUIRED']);
    expect(error.details).toBeUndefined();
  });

  it('refuses a decision past the deadline with 409 CRM_ACCESS_REQUEST_EXPIRED', async () => {
    const error = await rejection(
      decideAccessRequest('01934b50-0000-7000-8000-000000000007', { revision: 1, decision: 'APPROVED' }),
    );
    expect([error.status, error.code]).toEqual([409, 'CRM_ACCESS_REQUEST_EXPIRED']);
  });

  it('accepts status=ALL in uppercase only (`all` is 400)', async () => {
    const inboxAll = await listAccessRequests('inbox', { status: 'ALL', limit: 100 });
    const inboxPending = await listAccessRequests('inbox', { limit: 100 });
    expect(inboxAll.items.length).toBeGreaterThanOrEqual(inboxPending.items.length);
    const mineAll = await listAccessRequests('mine', { status: 'ALL', limit: 100 });
    expect(mineAll.items.some((item) => item.status !== 'PENDING')).toBe(true);
    const lower = await rejection(listAccessRequests('inbox', { status: 'all' as unknown as 'ALL' }));
    expect([lower.status, lower.code, lower.details]).toEqual([400, 'CRM_VALIDATION_FAILED', { status: ['is_in'] }]);
  });
});

describe('owner reviews fake (backend contract)', () => {
  it('lists reviews with resourceName and reads one by GET owner-reviews/:id (404 when not visible)', async () => {
    const page = await listOwnerReviews({ status: 'OPEN' });
    expect(page.items[0]).toHaveProperty('resourceName');
    const found = await getOwnerReview(REVIEW_OPEN);
    expect(found).toEqual(page.items.find((item) => item.id === REVIEW_OPEN));
    const missing = await rejection(getOwnerReview('01934b99-0000-7000-8000-000000000999'));
    expect([missing.status, missing.code]).toEqual([404, 'CRM_OWNER_REVIEW_NOT_FOUND']);
  });

  it('refuses GET owner-reviews/:id without crm.widgets.transfer_ownership (403 before the lookup)', async () => {
    bindAnalyticsPermissions(() => ANALYTICS_PERMISSIONS_FIXTURE.filter((key) => key !== 'crm.widgets.transfer_ownership'));
    try {
      const denied = await rejection(getOwnerReview('01934b99-0000-7000-8000-000000000999'));
      expect(denied.status).toBe(403);
    } finally {
      bindAnalyticsPermissions(() => ANALYTICS_PERMISSIONS_FIXTURE);
    }
  });

  it('needs a reason to propose (422) and withdraws when no owner is sent', async () => {
    const review = await getOwnerReview(REVIEW_OPEN);
    const noReason = await rejection(
      proposeOwner(REVIEW_OPEN, { revision: review.revision, proposedOwnerUserId: '01934b10-0000-7000-8000-000000000101' }),
    );
    expect([noReason.status, noReason.code]).toEqual([422, 'CRM_OWNER_REVIEW_PROPOSED_OWNER_INVALID']);
    const withdrawn = await proposeOwner(REVIEW_OPEN, { revision: review.revision, proposedOwnerUserId: null });
    expect(withdrawn.proposedOwnerUserId).toBeNull();
    expect(withdrawn.revision).toBe(review.revision + 1);
  });

  it('refuses a transfer with no proposal (422) and a blank reason (400)', async () => {
    const review = await getOwnerReview(REVIEW_OPEN);
    const blank = await rejection(executeOwnerTransfer(REVIEW_OPEN, { revision: review.revision, reason: ' ' }, newIdempotencyKey()));
    expect([blank.status, blank.code, errorDetailField(blank)]).toEqual([400, 'CRM_VALIDATION_FAILED', 'reason']);
    const none = await rejection(executeOwnerTransfer(REVIEW_OPEN, { revision: review.revision, reason: 'Handover' }, newIdempotencyKey()));
    expect([none.status, none.code]).toEqual([422, 'CRM_OWNER_REVIEW_PROPOSED_OWNER_INVALID']);
  });

  it('returns the resource head after the transfer in the summary (revision bumped, not a constant)', async () => {
    const review = await getOwnerReview(REVIEW_OPEN);
    const candidate = FAKE_ACTIVE_PEOPLE.find((person) => person.id !== review.ownerUserId)!;
    const proposed = await proposeOwner(REVIEW_OPEN, {
      revision: review.revision,
      proposedOwnerUserId: candidate.id,
      reason: 'Owner left the team',
    });
    const result = await executeOwnerTransfer(REVIEW_OPEN, { revision: proposed.revision, reason: 'Handover' }, newIdempotencyKey());
    expect(result.transfer.revision).toBeGreaterThan(1);
    expect(result.transfer.ownerReviewId).toBe(REVIEW_OPEN);
    expect(result.review.status).toBe('TRANSFERRED');
    if (result.transfer.resourceType === 'WIDGET') expect(result.transfer.governanceRevision).toBeGreaterThan(1);
    else expect(result.transfer.governanceRevision).toBeUndefined();
  });
});

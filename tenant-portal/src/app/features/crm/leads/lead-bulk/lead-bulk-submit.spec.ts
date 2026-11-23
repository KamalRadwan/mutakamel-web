import { describe, expect, it } from 'vitest';
import { BulkJobSubmit } from '../../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError } from '../../settings/shared/settings-api';
import { LeadBulkSubmitKey, leadBulkErrorParams, selectionBranchMismatch } from './lead-bulk-submit';

const body = (ownerUserId: string): BulkJobSubmit => ({
  module: 'crm.leads',
  action: 'ASSIGN',
  scope: { branchId: 'b1' },
  selection: { kind: 'IDS', ids: ['lead-001'] },
  params: { ownerUserId },
});

describe('LeadBulkSubmitKey', () => {
  it('reuses one idempotency key when the same body is retried', () => {
    const key = new LeadBulkSubmitKey();
    expect(key.for(body('u1'))).toBe(key.for(body('u1')));
  });

  it('issues a new key when the body changes or after reset', () => {
    const key = new LeadBulkSubmitKey();
    const first = key.for(body('u1'));
    const changed = key.for(body('u2'));
    expect(changed).not.toBe(first);
    key.reset();
    expect(key.for(body('u2'))).not.toBe(changed);
  });

  it.each([new ApiError(0, 'NETWORK_ERROR'), new ApiError(503, 'UNAVAILABLE'),
    new ApiError(409, 'GW.IDEM.IN_FLIGHT'), new ApiError(401, 'UNAUTHORIZED')])('keeps the key after %s', (error) => {
    const key = new LeadBulkSubmitKey();
    const first = key.for(body('u1'));
    key.failed(error);
    expect(key.for(body('u1'))).toBe(first);
  });

  it('uses a fresh key after a definite rejection', () => {
    const key = new LeadBulkSubmitKey();
    const first = key.for(body('u1'));
    key.failed(new ApiError(422, 'CRM_REASON_REQUIRED'));
    expect(key.for(body('u1'))).not.toBe(first);
  });

  it.each(['GW.IDEM.MISMATCH', 'LEAD_IDEMPOTENCY_MISMATCH', 'CRM_SUBSCRIPTION_READ_ONLY',
    'SEAT_OVER_CAPACITY_READ_ONLY', 'CRM_LEADS_DISABLED'])('blocks another write after %s', (code) => {
    const key = new LeadBulkSubmitKey();
    key.for(body('u1'));
    key.failed(new ApiError(403, code));
    expect(key.blocked()).toBe(true);
    expect(() => key.for(body('u1'))).toThrow();
  });
});

describe('leadBulkErrorParams', () => {
  it('formats the decimal string array details.max sent by the backend', () => {
    expect(leadBulkErrorParams(new ApiError(422, 'BULK_SELECTION_TOO_LARGE', { max: ['5000'] }))).toEqual({ max: '5,000' });
  });

  it('falls back to the bulk limit when max is missing or not a string array', () => {
    expect(leadBulkErrorParams(new ApiError(422, 'BULK_SELECTION_TOO_LARGE', { max: 5000 }))).toEqual({ max: '10,000' });
    expect(leadBulkErrorParams(new ApiError(422, 'BULK_SELECTION_TOO_LARGE', { max: ['x'] }))).toEqual({ max: '10,000' });
    expect(leadBulkErrorParams(null)).toEqual({ max: '10,000' });
  });
});

describe('selectionBranchMismatch', () => {
  it('is false for id selections and for a query on the scope branch', () => {
    expect(selectionBranchMismatch({ kind: 'IDS', ids: ['a'] }, 'b1')).toBe(false);
    expect(selectionBranchMismatch({ kind: 'QUERY', query: { search: { branchId: 'b1' } } }, 'b1')).toBe(false);
  });

  it('is true when the query searches another branch or none', () => {
    expect(selectionBranchMismatch({ kind: 'QUERY', query: { search: { branchId: 'b4' } } }, 'b1')).toBe(true);
    expect(selectionBranchMismatch({ kind: 'QUERY', query: { search: {} } }, 'b1')).toBe(true);
  });
});

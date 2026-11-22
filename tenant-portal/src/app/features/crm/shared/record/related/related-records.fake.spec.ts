/**
 * Contract spec: the related-counts fake against crm-app crm/related-records
 * (RelatedRecordCountsDto, RelatedRecordsService.counts, RequireBranchAccess('body')).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../settings/shared/settings-api';
import { fakeSyncCrmModuleDefaults } from '../../crm-modules/crm-modules.fake';
import {
  ACME_CUSTOMER_RECORD_ID,
  LEAD_ONLY_VISIBILITY_RECORD_ID,
  NO_ACCESS_LEAD_ID,
  fakeRelatedCounts,
} from './related-records.fake';
import { RelatedCountsBody, RelatedRecordType } from './related-records.model';

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function settleError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the call to reject');
}

const body = (patch: Partial<RelatedCountsBody> = {}): RelatedCountsBody => ({
  branchId: 'b1',
  recordType: 'LEAD',
  recordIds: ['lead-001'],
  ...patch,
});

describe('related-records fake: contract', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    fakeSyncCrmModuleDefaults({ leadsEnabled: true });
    vi.useRealTimers();
  });

  it('returns the countsByRecordId envelope with every counter key', async () => {
    const response = await settle(fakeRelatedCounts(body()));
    expect(Object.keys(response)).toEqual(['countsByRecordId']);
    expect(Object.keys(response.countsByRecordId['lead-001']).sort()).toEqual(
      ['invoices', 'leads', 'opportunities', 'partyId', 'quotations', 'salesOrders'],
    );
  });

  it('keeps unavailable counters null rather than zero', async () => {
    const response = await settle(fakeRelatedCounts(body({ recordIds: [LEAD_ONLY_VISIBILITY_RECORD_ID] })));
    const counts = response.countsByRecordId[LEAD_ONLY_VISIBILITY_RECORD_ID];
    expect(counts.opportunities).toBeNull();
    expect(counts.quotations).toBeNull();
    expect(typeof counts.leads).toBe('number');
  });

  it('omits records outside the read scope and records it does not hold', async () => {
    const response = await settle(fakeRelatedCounts(body({ recordIds: [NO_ACCESS_LEAD_ID, 'lead-999999'] })));
    expect(response.countsByRecordId).toEqual({});
  });

  it('omits a customer outside the request branch', async () => {
    const response = await settle(
      fakeRelatedCounts(body({ branchId: 'b2', recordType: 'CUSTOMER_PROFILE', recordIds: [ACME_CUSTOMER_RECORD_ID] })),
    );
    expect(response.countsByRecordId).toEqual({});
  });

  it('counts a customer in its branch', async () => {
    const response = await settle(
      fakeRelatedCounts(body({ recordType: 'CUSTOMER_PROFILE', recordIds: [ACME_CUSTOMER_RECORD_ID] })),
    );
    expect(response.countsByRecordId[ACME_CUSTOMER_RECORD_ID]).toMatchObject({ opportunities: 1, quotations: 2 });
  });

  it('returns null leads while the Leads module is off', async () => {
    fakeSyncCrmModuleDefaults({ leadsEnabled: false });
    const response = await settle(fakeRelatedCounts(body()));
    expect(response.countsByRecordId['lead-001'].leads).toBeNull();
  });

  it('rejects a missing branch with 403 BRANCH_CONTEXT_REQUIRED', async () => {
    const error = await settleError(fakeRelatedCounts(body({ branchId: '' })));
    expect([error.status, error.code]).toEqual([403, 'BRANCH_CONTEXT_REQUIRED']);
  });

  it('rejects a malformed branch with 400 CRM_VALIDATION_FAILED and no details', async () => {
    const error = await settleError(fakeRelatedCounts(body({ branchId: 'not a branch' })));
    expect([error.status, error.code, error.details]).toEqual([400, 'CRM_VALIDATION_FAILED', undefined]);
  });

  it('rejects an unknown branch with 403 BRANCH_PERMISSION_DENIED', async () => {
    const error = await settleError(fakeRelatedCounts(body({ branchId: 'b99' })));
    expect([error.status, error.code]).toEqual([403, 'BRANCH_PERMISSION_DENIED']);
  });

  it('rejects any other recordType with 400 and a recordType message array', async () => {
    const error = await settleError(
      fakeRelatedCounts(body({ recordType: 'OPPORTUNITY' as unknown as RelatedRecordType })),
    );
    expect([error.status, error.code]).toEqual([400, 'CRM_VALIDATION_FAILED']);
    expect(error.details?.['recordType']).toEqual([expect.any(String)]);
  });

  it.each([
    ['empty', [] as string[]],
    ['over 100', Array.from({ length: 101 }, (_, n) => `lead-${n + 1}`)],
    ['case-only repeat', ['0192B7EA-7C4F-7A7D-9C9F-51C7F2B3AA01', ACME_CUSTOMER_RECORD_ID]],
  ])('rejects %s recordIds with 400 and a recordIds message array', async (_label, recordIds) => {
    const error = await settleError(fakeRelatedCounts(body({ recordIds })));
    expect([error.status, error.code]).toEqual([400, 'CRM_VALIDATION_FAILED']);
    const messages = error.details?.['recordIds'];
    expect(Array.isArray(messages) && messages.every((message) => typeof message === 'string')).toBe(true);
  });
});

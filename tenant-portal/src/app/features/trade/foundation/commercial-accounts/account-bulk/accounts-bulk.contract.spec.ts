import { fakeSubmitBulkJob } from '../../../../../shared/bulk-jobs/bulk-jobs.fake';
import type { BulkJobSubmit } from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError } from '../../../shared/trade-api';
import { TRADE_FAKE_DB } from '../../../shared/trade-foundation.fake';
import {
  TRADE_ACCOUNTS_BULK_MODULE_ID,
  type TradeAccountsBulkAction,
} from './accounts-bulk.descriptor';
import './accounts-bulk.fake-module';

/** Contract of the backend trading.commercial-accounts handler + schemas, as the strict fake mirrors it. */

let seq = 0;

async function submitError(
  body: Partial<BulkJobSubmit> & { action: TradeAccountsBulkAction },
): Promise<{ status: number; code: string } | null> {
  const full: BulkJobSubmit = {
    module: TRADE_ACCOUNTS_BULK_MODULE_ID,
    scope: { companyId: 'c1' },
    selection: { kind: 'IDS', ids: ['acc-missing'] },
    params: {},
    ...body,
  };
  const promise = fakeSubmitBulkJob('trading', full, `accounts-contract-${++seq}`).then(
    () => null,
    (error: unknown) => {
      // A running job (409) means validation passed: the contract checks run before the active check.
      if (error instanceof ApiError && error.code === 'BULK_JOB_ACTIVE') return null;
      if (error instanceof ApiError) return { status: error.status, code: error.code };
      throw error;
    },
  );
  await vi.advanceTimersByTimeAsync(400);
  return promise;
}

const PARAMS_INVALID = { status: 400, code: 'BULK_JOB_PARAMS_INVALID' };

function usableReason(kind: 'ACCOUNT_BLOCK' | 'ACCOUNT_UNBLOCK'): string {
  const reason = TRADE_FAKE_DB.reasons.find(
    (r) => r.kind === kind && r.isActive && !r.requiresNote,
  );
  expect(reason).toBeDefined();
  return reason!.id;
}

describe('trading.commercial-accounts bulk contract (strict fake)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('takes the reason note as `note` and rejects `reasonNote`', async () => {
    const reasonCodeId = usableReason('ACCOUNT_BLOCK');
    expect(
      await submitError({ action: 'BLOCK', params: { reasonCodeId, note: 'checked' } }),
    ).toBeNull();
    expect(
      await submitError({ action: 'BLOCK', params: { reasonCodeId, reasonNote: 'checked' } }),
    ).toEqual(PARAMS_INVALID);
    expect(
      await submitError({ action: 'BLOCK', params: { reasonCodeId, note: 'x'.repeat(501) } }),
    ).toEqual(PARAMS_INVALID);
    expect(await submitError({ action: 'BLOCK', params: { reasonCodeId, note: null } })).toEqual(
      PARAMS_INVALID,
    );
  });

  it('allows evidenceRef on BLOCK only, at most 200 characters', async () => {
    const block = usableReason('ACCOUNT_BLOCK');
    const unblock = usableReason('ACCOUNT_UNBLOCK');
    expect(
      await submitError({
        action: 'BLOCK',
        params: { reasonCodeId: block, evidenceRef: 'x'.repeat(200) },
      }),
    ).toBeNull();
    expect(
      await submitError({
        action: 'BLOCK',
        params: { reasonCodeId: block, evidenceRef: 'x'.repeat(201) },
      }),
    ).toEqual(PARAMS_INVALID);
    expect(
      await submitError({
        action: 'UNBLOCK',
        params: { reasonCodeId: unblock, evidenceRef: 'T-1' },
      }),
    ).toEqual(PARAMS_INVALID);
  });

  it('accepts only accountRole, status and search in a flat QUERY selection', async () => {
    const reasonCodeId = usableReason('ACCOUNT_BLOCK');
    for (const q of [
      { filter: { status: 'ACTIVE' } },
      { sort: 'createdAt' },
      { search: 'x'.repeat(81) },
      { status: 'active' },
    ]) {
      expect(
        await submitError({
          action: 'BLOCK',
          params: { reasonCodeId },
          selection: { kind: 'QUERY', query: q, excludedIds: [] },
        }),
      ).toEqual(PARAMS_INVALID);
    }
  });

  it('rejects a missing company like the scopeRule COMPANY check (400)', async () => {
    expect(
      await submitError({
        action: 'BLOCK',
        scope: {},
        params: { reasonCodeId: usableReason('ACCOUNT_BLOCK') },
      }),
    ).toEqual(PARAMS_INVALID);
  });

  it('checks the reason kind after the shape (422)', async () => {
    expect(
      await submitError({
        action: 'BLOCK',
        params: { reasonCodeId: usableReason('ACCOUNT_UNBLOCK') },
      }),
    ).toEqual({
      status: 422,
      code: 'TRADE.REASON.KIND_INVALID',
    });
  });
});

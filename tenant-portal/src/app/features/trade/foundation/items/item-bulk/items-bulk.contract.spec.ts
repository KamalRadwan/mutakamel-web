import { fakeSubmitBulkJob } from '../../../../../shared/bulk-jobs/bulk-jobs.fake';
import type {
  BulkJobSelection,
  BulkJobSubmit,
} from '../../../../../shared/bulk-jobs/bulk-jobs.model';
import { ApiError } from '../../../shared/trade-api';
import { TRADE_FAKE_DB } from '../../../shared/trade-foundation.fake';
import { type ItemBulkAction, TRADE_ITEMS_BULK_MODULE_NAME, toBulkScope } from './item-bulk.model';
import './items-bulk.fake-module';

/** Contract of the backend trading.items handler + schemas, as the strict fake mirrors it. */

let seq = 0;

async function submitError(
  body: Partial<BulkJobSubmit> & { action: ItemBulkAction },
): Promise<{ status: number; code: string } | null> {
  const full: BulkJobSubmit = {
    module: TRADE_ITEMS_BULK_MODULE_NAME,
    scope: {},
    selection: { kind: 'IDS', ids: ['item-01'] },
    params: {},
    ...body,
  };
  const promise = fakeSubmitBulkJob('trading', full, `items-contract-${++seq}`).then(
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

const query = (q: Record<string, unknown>): BulkJobSelection => ({
  kind: 'QUERY',
  query: q,
  excludedIds: [],
});
const PARAMS_INVALID = { status: 400, code: 'BULK_JOB_PARAMS_INVALID' };
const ENABLE = {
  canSell: true,
  canPurchase: true,
  canPos: false,
  trackInventory: false,
  trackingMode: 'NONE',
  salesTaxId: null,
  purchaseTaxId: null,
};

describe('trading.items bulk contract (strict fake)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends master actions in tenant scope and company actions with the company', () => {
    const ctx = { companyId: 'c1', branchId: 'b1' };
    expect(toBulkScope(ctx, 'SET_STATUS')).toEqual({});
    expect(toBulkScope(ctx, 'SET_CATEGORY')).toEqual({});
    expect(toBulkScope(ctx, 'ENABLE_FOR_COMPANY')).toEqual(ctx);
    expect(toBulkScope(ctx, 'SET_CAPABILITIES')).toEqual(ctx);
  });

  it('rejects unknown or mistyped params with 400 BULK_JOB_PARAMS_INVALID', async () => {
    expect(
      await submitError({ action: 'SET_STATUS', params: { status: 'ACTIVE', note: 'x' } }),
    ).toEqual(PARAMS_INVALID);
    expect(await submitError({ action: 'SET_STATUS', params: { status: 'GONE' } })).toEqual(
      PARAMS_INVALID,
    );
    expect(
      await submitError({
        action: 'SET_STATUS',
        params: { status: 'ACTIVE', reasonNote: 'x'.repeat(501) },
      }),
    ).toEqual(PARAMS_INVALID);
    expect(await submitError({ action: 'SET_CATEGORY', params: {} })).toEqual(PARAMS_INVALID);
    expect(
      await submitError({
        action: 'SET_CAPABILITIES',
        scope: { companyId: 'c1' },
        params: { canSell: 'yes' },
      }),
    ).toEqual(PARAMS_INVALID);
    expect(
      await submitError({
        action: 'SET_CAPABILITIES',
        scope: { companyId: 'c1' },
        params: { trackingMode: 'LOT' },
      }),
    ).toEqual(PARAMS_INVALID);
  });

  it('requires salesTaxId and purchaseTaxId to be present (null allowed)', async () => {
    const { salesTaxId: _s, ...withoutSales } = ENABLE;
    const { purchaseTaxId: _p, ...withoutPurchase } = ENABLE;
    const scope = { companyId: 'c1' };
    expect(
      await submitError({ action: 'ENABLE_FOR_COMPANY', scope, params: withoutSales }),
    ).toEqual(PARAMS_INVALID);
    expect(
      await submitError({ action: 'ENABLE_FOR_COMPANY', scope, params: withoutPurchase }),
    ).toEqual(PARAMS_INVALID);
  });

  it('accepts only the list DTO keys in a QUERY selection', async () => {
    const scope = { companyId: 'c1' };
    for (const extra of [
      { createdAfter: '2026-01-01' },
      { hasCompanyProfile: false },
      { canSell: true },
      { trackingMode: 'LOT' },
      { trackingModes: ['LOT'] },
      { filter: { search: 'a' } },
      { scope: 'catalogue' },
      { page: 1 },
    ]) {
      expect(
        await submitError({
          action: 'SET_CAPABILITIES',
          scope,
          params: { canSell: true },
          selection: query(extra),
        }),
      ).toEqual(PARAMS_INVALID);
    }
  });

  it('denies master actions under company or branch scope with 403 TRADE.AUTH.TARGET_DENIED', async () => {
    const denied = { status: 403, code: 'TRADE.AUTH.TARGET_DENIED' };
    expect(
      await submitError({
        action: 'SET_STATUS',
        scope: { companyId: 'c1' },
        params: { status: 'ACTIVE' },
      }),
    ).toEqual(denied);
    expect(
      await submitError({
        action: 'SET_CATEGORY',
        scope: { branchId: 'b1' },
        params: { categoryId: null },
      }),
    ).toEqual(denied);
  });

  it('requires a company for company actions with 422 TRADE.CONTEXT.COMPANY_REQUIRED', async () => {
    const required = { status: 422, code: 'TRADE.CONTEXT.COMPANY_REQUIRED' };
    expect(await submitError({ action: 'ENABLE_FOR_COMPANY', params: ENABLE })).toEqual(required);
    expect(await submitError({ action: 'SET_CAPABILITIES', params: { canSell: true } })).toEqual(
      required,
    );
  });

  it('checks the discontinue reason: missing id -> 422 TRADE.REASON.NOT_FOUND', async () => {
    expect(await submitError({ action: 'SET_STATUS', params: { status: 'DISCONTINUED' } })).toEqual(
      {
        status: 422,
        code: 'TRADE.REASON.NOT_FOUND',
      },
    );
    const reason = TRADE_FAKE_DB.reasons.find(
      (r) => r.kind === 'ITEM_DISCONTINUE' && r.isActive && !r.requiresNote,
    );
    expect(reason).toBeDefined();
    expect(
      await submitError({
        action: 'SET_STATUS',
        params: { status: 'DISCONTINUED', reasonCodeId: reason!.id, reasonNote: null },
      }),
    ).toBeNull();
  });
});

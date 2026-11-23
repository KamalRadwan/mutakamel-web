import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import {
  fakeApplyChange as applyChange,
  fakeCreatePaymentIntent as createPaymentIntent,
  fakeCreatePaymentQuote as createPaymentQuote,
  fakeGetReceipt as getReceipt,
  fakeGetSubscription as getSubscription,
  fakeListInvoices as listInvoices,
  fakeListPaymentCurrencies as listPaymentCurrencies,
  fakePrepareChange as prepareChange,
  fakeTopUpWallet as topUpWallet,
  setFakeBillingErrorNext,
  setFakeBillingFailNext,
} from './billing.fake';

// The fakes stand in for the backend until Phase 5, so their status codes, error
// codes, details and list shapes are checked against the backend contract here.
async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if ('error' in result) throw result.error;
  return result.value;
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the fake to fail');
}

describe('billing fakes follow the backend contract', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    setFakeBillingFailNext(false);
    setFakeBillingErrorNext(null);
    vi.useRealTimers();
  });

  it('fake raises the backend billing codes', async () => {
    for (const [code, status, request] of [
      ['PAYMENT_PROVIDER_UNCONFIGURED', 503, () => topUpWallet({ amount: '10', currencyCode: 'USD' }, crypto.randomUUID())],
      ['PAYMENT_INTENT_UNAVAILABLE', 409, () => createPaymentIntent('invoice', 'quote', crypto.randomUUID())],
      ['WALLET_NOT_ACTIVE', 409, () => topUpWallet({ amount: '10', currencyCode: 'USD' }, crypto.randomUUID())],
      ['WALLET_FROZEN', 409, () => topUpWallet({ amount: '10', currencyCode: 'USD' }, crypto.randomUUID())],
      ['TOPUP_LIMITS_INVALID', 503, () => topUpWallet({ amount: '10', currencyCode: 'USD' }, crypto.randomUUID())],
      ['ACCESS_POLICY_BLOCKED', 403, () => getSubscription()],
      ['ACCESS_POLICY_UNAVAILABLE', 503, () => getSubscription()],
      ['SEAT_MODULE_HOLDERS_EXCEED_PURCHASE', 422, () => prepareChange({ expectedSubscriptionRevision: '1', changes: [] }, crypto.randomUUID())],
    ] as const) {
      setFakeBillingErrorNext(code);
      const error = await failure(request());
      expect([error.status, error.code]).toEqual([status, code]);
      for (const value of Object.values(error.details ?? {})) {
        expect(Array.isArray(value) && value.every((item) => typeof item === 'string')).toBe(true);
      }
      if (code === 'SEAT_MODULE_HOLDERS_EXCEED_PURCHASE') {
        expect(error.details).toEqual({ moduleKey: ['crm'], holders: ['4'], seats: ['2'] });
      }
      if (status >= 500) expect(error.details).toBeUndefined();
    }
    await settle(listPaymentCurrencies());
  });

  it('echoes the requested page and reports zero pages past the end like the backend', async () => {
    const page = await settle(listInvoices({ page: 99, limit: 100 }));
    expect(page.items).toEqual([]);
    expect(page.meta.page).toBe(99);
    expect(page.meta.hasNext).toBe(false);
    expect(page.meta.hasPrev).toBe(true);
    expect(page.meta.totalPages).toBe(Math.ceil(page.meta.total / 100));
  });

  it('lists payment currencies with USD first and the rest sorted', async () => {
    const res = await settle(listPaymentCurrencies());
    expect(res.items.map((item) => item.currencyCode)).toEqual(['USD', 'AED', 'EGP', 'SAR']);
    expect(res.total).toBe(res.items.length);
  });

  it('sends no details on a 503', async () => {
    setFakeBillingFailNext(true);
    const error = await failure(listPaymentCurrencies());
    expect(error.status).toBe(503);
    expect(error.code).toBe('COMMERCIAL_COMMAND_UNAVAILABLE');
    expect(error.details).toBeUndefined();
  });

  it('rejects a malformed top-up with 400 and string-array details keyed by field', async () => {
    const error = await failure(topUpWallet({ amount: '0', currencyCode: 'USD' }, crypto.randomUUID()));
    expect(error.status).toBe(400);
    expect(error.code).toBe('CORE_VALIDATION_FAILED');
    expect(Object.keys(error.details ?? {})).toEqual(['amount']);
    expect(error.details?.['amount']).toEqual([expect.any(String)]);
  });

  it('answers a currency without a rate with 422 FX_RATE_NOT_FOUND', async () => {
    const error = await failure(topUpWallet({ amount: '10', currencyCode: 'JPY' }, crypto.randomUUID()));
    expect([error.status, error.code]).toEqual([422, 'FX_RATE_NOT_FOUND']);
  });

  it('checks the top-up range on the USD value', async () => {
    const tooSmall = await failure(topUpWallet({ amount: '2', currencyCode: 'EGP' }, crypto.randomUUID()));
    expect([tooSmall.status, tooSmall.code]).toEqual([422, 'TOPUP_AMOUNT_OUT_OF_RANGE']);
  });

  it('answers a reused payment key with a different body on the same route with 422', async () => {
    const key = crypto.randomUUID();
    await settle(topUpWallet({ amount: '10', currencyCode: 'USD' }, key));
    const error = await failure(topUpWallet({ amount: '11', currencyCode: 'USD' }, key));
    expect([error.status, error.code]).toEqual([422, 'IDEMPOTENCY_BODY_MISMATCH']);
  });

  it('answers a paid invoice quote with INVOICE_ALREADY_PAID before the currency check', async () => {
    const page = await settle(listInvoices({ page: 1, limit: 100 }));
    const paid = page.items.find((inv) => inv.status === 'PAID');
    expect(paid).toBeDefined();
    const error = await failure(createPaymentQuote(paid!.id, 'JPY'));
    expect([error.status, error.code]).toEqual([409, 'INVOICE_ALREADY_PAID']);
  });

  it('checks the quote before the active hold when creating a payment intent', async () => {
    const page = await settle(listInvoices({ page: 1, limit: 100 }));
    const open = page.items.find((inv) => inv.status === 'ISSUED');
    expect(open).toBeDefined();
    const error = await failure(createPaymentIntent(open!.id, 'missing-quote', crypto.randomUUID()));
    expect([error.status, error.code]).toEqual([404, 'FX_QUOTE_NOT_FOUND']);
  });

  it('sends SEAT_DOWNGRADE_FREE_UP_REQUIRED with decimal string-array details', async () => {
    const sub = await settle(getSubscription());
    const crm = sub.baseItems.find((item) => item.applicationKey === 'crm')!;
    const error = await failure(
      prepareChange(
        {
          expectedSubscriptionRevision: sub.subscriptionRevision,
          changes: [{ sourceKind: 'APPLICATION', operation: 'CHANGE', selectionKey: 'k1', itemId: crm.id, seats: 1 }],
        },
        crypto.randomUUID(),
      ),
    );
    expect([error.status, error.code]).toEqual([409, 'SEAT_DOWNGRADE_FREE_UP_REQUIRED']);
    expect(error.details).toEqual({ moduleKey: ['crm'], used: ['22'], target: ['1'], excess: ['21'] });
  });

  it('answers an unknown application item with 409 APPLICATION_SELECTION_NOT_ALLOWED', async () => {
    const sub = await settle(getSubscription());
    const error = await failure(
      prepareChange(
        {
          expectedSubscriptionRevision: sub.subscriptionRevision,
          changes: [{ sourceKind: 'APPLICATION', operation: 'CHANGE', selectionKey: 'k1', itemId: 'missing', seats: 30 }],
        },
        crypto.randomUUID(),
      ),
    );
    expect([error.status, error.code]).toEqual([409, 'APPLICATION_SELECTION_NOT_ALLOWED']);
  });

  it('answers a reused commercial key with SUBSCRIPTION_PLAN_CHANGE_IDEMPOTENCY_REUSED', async () => {
    const sub = await settle(getSubscription());
    const item = sub.baseItems[0];
    const key = crypto.randomUUID();
    const body = (seats: number) => ({
      expectedSubscriptionRevision: sub.subscriptionRevision,
      changes: [{ sourceKind: 'APPLICATION' as const, operation: 'CHANGE' as const, selectionKey: 'k1', itemId: item.id, seats }],
    });
    await settle(prepareChange(body(item.seats + 1), key));
    const error = await failure(prepareChange(body(item.seats + 2), key));
    expect([error.status, error.code]).toEqual([409, 'SUBSCRIPTION_PLAN_CHANGE_IDEMPOTENCY_REUSED']);
  });

  it('answers an unknown preview with 404 SUBSCRIPTION_PLAN_CHANGE_PREVIEW_NOT_FOUND', async () => {
    const apply = await failure(applyChange('missing-preview', crypto.randomUUID()));
    expect([apply.status, apply.code]).toEqual([404, 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_NOT_FOUND']);
    const receipt = await failure(getReceipt('missing-preview'));
    expect([receipt.status, receipt.code]).toEqual([404, 'SUBSCRIPTION_PLAN_CHANGE_PREVIEW_NOT_FOUND']);
  });
});

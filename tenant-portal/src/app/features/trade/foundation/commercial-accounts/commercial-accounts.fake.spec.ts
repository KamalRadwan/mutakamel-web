import { ApiError, ifMatch, newIdempotencyKey } from '../../shared/trade-api';
import { TRADE_FAKE_DB } from '../../shared/trade-foundation.fake';
import { listBranchRules } from './commercial-accounts.api';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import { fakeCountAccounts, fakeListAccounts, fakeListBranchRules, fakeUpdateAccount } from './commercial-accounts.fake';
import type { ListAccountsQuery } from './commercial-accounts.model';

/** Contract of trade-app CommercialAccountsService (commercial-accounts.service.ts + DTOs) as the fake mirrors it. */

const company = { 'x-mutakamel-company-id': 'c1' };

async function run<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(400);
  const result = await settled;
  if (!result.ok) throw result.error;
  return result.value;
}

async function failure(promise: Promise<unknown>): Promise<{ status: number; code: string; details?: Record<string, string[]> }> {
  try {
    await run(promise);
  } catch (error) {
    if (error instanceof ApiError) return { status: error.status, code: error.code, details: error.details };
    throw error;
  }
  throw new Error('expected a failure');
}

describe('commercial accounts fake contract', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('takes upper-case sort directions only and sorts DESC by default', async () => {
    const lower = { direction: 'asc' } as unknown as ListAccountsQuery;
    expect(await failure(fakeListAccounts(company, lower))).toEqual({
      status: 400,
      code: 'TRADE.VALIDATION_FAILED',
      details: { direction: ['invalid'] },
    });
    const page = await run(fakeListAccounts(company, { limit: 100 }));
    const created = page.items.map((account) => account.createdAt);
    expect([...created].sort().reverse()).toEqual(created);
  });

  it('caps search at 80 characters and returns the party with null Arabic name and code', async () => {
    expect(await failure(fakeCountAccounts(company, { search: 'x'.repeat(81) }))).toMatchObject({
      status: 400,
      details: { search: ['invalid'] },
    });
    const page = await run(fakeListAccounts(company, { limit: 1 }));
    expect(page.items[0].party).toMatchObject({ displayNameAr: null, code: null });
  });

  it('applies the role filter to byRole as well', async () => {
    const counts = await run(fakeCountAccounts(company, { accountRole: 'CUSTOMER' }));
    expect(counts.byRole.SUPPLIER).toBe(0);
    expect(counts.byRole.CUSTOMER).toBe(counts.total);
  });

  it('PATCH returns the account flat with warnings beside its fields', async () => {
    const account = TRADE_FAKE_DB.accounts.find((entry) => entry.companyId === 'c1' && entry.accountRole === 'CUSTOMER')!;
    const headers = { ...company, 'x-idempotency-key': newIdempotencyKey(), 'If-Match': ifMatch(account.version) };
    const result = await run(fakeUpdateAccount(headers, account.id, { terms: account.terms }));
    expect(result).toMatchObject({ id: account.id, warnings: expect.any(Array) });
    expect('account' in result).toBe(false);
  });

  it('a malformed key is 422 KEY_REQUIRED', async () => {
    const account = TRADE_FAKE_DB.accounts.find((entry) => entry.companyId === 'c1')!;
    const headers = { ...company, 'x-idempotency-key': 'nope', 'If-Match': ifMatch(account.version) };
    expect(await failure(fakeUpdateAccount(headers, account.id, {}))).toMatchObject({
      status: 422,
      code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED',
    });
  });

  it('lists branch rules as { items } with branch names; the api reads the items', async () => {
    const list = await run(fakeListBranchRules(company, 'acc-c1-c-01'));
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items[0]).toMatchObject({ branchName: expect.any(String), branchNameAr: null });
    const stub = new TradeHttpStub({ 'GET /commercial-accounts/acc-c1-c-01/branch-rules': list });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const rules = await listBranchRules({ companyId: 'c1' }, 'acc-c1-c-01');
      expect(rules.map((rule) => rule.id)).toEqual(list.items.map((rule) => rule.id));
    } finally {
      dispose();
    }
  });
});

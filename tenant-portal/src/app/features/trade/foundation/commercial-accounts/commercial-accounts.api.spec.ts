import { describe, expect, it } from 'vitest';
import { ApiError, newIdempotencyKey } from '../../shared/trade-api';
import type { Page } from '../../shared/trade-foundation.model';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeCoreStub, TradeHttpStub } from '../../shared/testing/trade-http-testing';
import {
  blockAccount,
  countAccounts,
  createAccount,
  createBranchRule,
  evaluateCredit,
  getAccount,
  getCreditSummary,
  listAccountLookups,
  listAccounts,
  listBranchRules,
  listCreditPolicies,
  listParties,
  listPriceBooks,
  unblockAccount,
  updateAccount,
  updateBranchRule,
} from './commercial-accounts.api';
import type {
  AccountDetail,
  AccountStatusCounts,
  AccountWithParty,
  BranchRule,
  BranchRuleListItem,
  CreditDecision,
  CreditPolicy,
  CreditSummary,
  PriceBookOption,
  UpdateAccountResult,
} from './commercial-accounts.model';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const C1 = { companyId: '01900000-0000-7000-8000-0000000000c1' };
const C1_B1 = {
  companyId: '01900000-0000-7000-8000-0000000000c1',
  branchId: '01900000-0000-7000-8000-0000000000b1',
};

function makeAccount(overrides: Partial<AccountWithParty> = {}): AccountWithParty {
  return {
    id: '01900000-0000-7000-8000-0000000000a1',
    partyId: '01900000-0000-7000-8000-0000000000p1',
    companyId: C1.companyId,
    accountRole: 'CUSTOMER',
    paymentTermsId: null,
    creditLimit: '50000.00000000',
    creditCurrencyCode: 'EGP',
    priceBookId: '01900000-0000-7000-8000-000000000pb1',
    creditPolicyVersionId: null,
    terms: { allowedCurrencies: ['EGP', 'USD'] },
    status: 'ACTIVE',
    blockReasonCode: null,
    version: 1,
    createdAt: '2026-11-23T08:00:00.000Z',
    updatedAt: '2026-11-23T08:00:00.000Z',
    party: {
      id: '01900000-0000-7000-8000-0000000000p1',
      displayName: 'Delta Trading Co.',
      displayNameAr: null,
      partyType: 'ORGANIZATION',
      code: null,
    },
    ...overrides,
  };
}

function makeBranchRule(overrides: Partial<BranchRule> = {}): BranchRule {
  return {
    id: '01900000-0000-7000-8000-0000000000r1',
    commercialAccountId: '01900000-0000-7000-8000-0000000000a1',
    companyId: C1.companyId,
    branchId: C1_B1.branchId,
    narrowingRules: { creditLimit: '25000', orderingHold: true },
    status: 'ACTIVE',
    version: 1,
    ...overrides,
  };
}

describe('commercial-accounts.api', () => {
  it('listAccounts calls GET /commercial-accounts with OPTIONAL scope, whitelisted query, and normalizes PERSON -> INDIVIDUAL', async () => {
    const wirePage = {
      items: [
        {
          ...makeAccount(),
          party: {
            id: '01900000-0000-7000-8000-0000000000p1',
            displayName: 'Ahmed Ali',
            displayNameAr: null,
            partyType: 'PERSON',
            code: null,
          },
        },
      ],
      total: 1,
      page: 2,
      limit: 24,
    };
    const stub = new TradeHttpStub({ 'GET /commercial-accounts': wirePage });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const res = await listAccounts(C1_B1, {
        page: 2,
        limit: 24,
        accountRole: 'CUSTOMER',
        status: 'ACTIVE',
        search: '  Ahmed  ',
        sort: 'partyName',
        direction: 'ASC',
        extraFilter: 'ignored',
      } as never);

      expect(res.total).toBe(1);
      expect(res.items[0].party?.partyType).toBe('INDIVIDUAL');
      expect(stub.recordedReads()).toEqual([
        {
          path: '/commercial-accounts',
          query: {
            page: 2,
            limit: 24,
            accountRole: 'CUSTOMER',
            status: 'ACTIVE',
            search: 'Ahmed',
            sort: 'partyName',
            direction: 'ASC',
          },
          scope: C1_B1,
        },
      ]);

      await listAccounts({}, {});
      expect(stub.recordedReads()[1]).toEqual({
        path: '/commercial-accounts',
        query: undefined,
        scope: {},
      });

      const valErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', { search: ['too long'] });
      stub.register('GET', '/commercial-accounts', valErr);
      await expect(listAccounts(C1)).rejects.toBe(valErr);
    } finally {
      dispose();
    }
  });

  it('countAccounts calls GET /commercial-accounts/status-counts with OPTIONAL scope and whitelisted query', async () => {
    const counts: AccountStatusCounts = {
      ACTIVE: 4,
      BLOCKED: 1,
      total: 5,
      byRole: { CUSTOMER: 3, SUPPLIER: 2 },
    };
    const stub = new TradeHttpStub({ 'GET /commercial-accounts/status-counts': counts });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const res = await countAccounts(C1, { accountRole: 'SUPPLIER', search: '  Steel  ' });
      expect(res).toEqual(counts);
      expect(stub.recordedReads()).toEqual([
        {
          path: '/commercial-accounts/status-counts',
          query: { accountRole: 'SUPPLIER', search: 'Steel' },
          scope: C1,
        },
      ]);
    } finally {
      dispose();
    }
  });

  it('getAccount calls GET /commercial-accounts/:id with OPTIONAL scope and unwraps AccountDetail', async () => {
    const detail: AccountDetail = { ...makeAccount(), branchRule: makeBranchRule() };
    const stub = new TradeHttpStub({ 'GET /commercial-accounts/:id': detail });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const res = await getAccount(C1_B1, detail.id);
      expect(res).toEqual(detail);
      expect(stub.recordedReads()).toEqual([
        { path: `/commercial-accounts/${detail.id}`, query: undefined, scope: C1_B1 },
      ]);
    } finally {
      dispose();
    }
  });

  it('createAccount sends POST /commercial-accounts with COMPANY scope, UUIDv7 key, whitelisted body (no paymentTermsId), and maps validation errors', async () => {
    const created = makeAccount();
    const stub = new TradeHttpStub({ 'POST /commercial-accounts': created });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const inputWithExtras = {
        partyId: created.partyId,
        accountRole: 'CUSTOMER' as const,
        creditLimit: '50000',
        creditCurrencyCode: 'EGP',
        priceBookId: created.priceBookId,
        creditPolicyVersionId: null,
        terms: { allowedCurrencies: ['EGP'] },
        paymentTermsId: 'should-be-stripped',
        uiOnly: 'strip-me',
      };
      const res = await createAccount(C1_B1, inputWithExtras as never, key);
      expect(res).toEqual(created);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: '/commercial-accounts',
          body: {
            partyId: created.partyId,
            accountRole: 'CUSTOMER',
            creditLimit: '50000',
            creditCurrencyCode: 'EGP',
            priceBookId: created.priceBookId,
            creditPolicyVersionId: null,
            terms: { allowedCurrencies: ['EGP'] },
          },
          key,
          ifMatch: undefined,
          scope: { companyId: C1.companyId },
          query: undefined,
        },
      ]);

      await expect(createAccount({}, inputWithExtras as never, key)).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.SCOPE.REQUIRED',
      });
      await expect(createAccount(C1, inputWithExtras as never, '')).rejects.toMatchObject({
        status: 400,
        code: 'TRADE.IDEMPOTENCY.KEY_MISSING',
      });

      const fieldErr = new ApiError(400, 'TRADE.VALIDATION_FAILED', {
        partyId: ['must match UUID v7'],
      });
      stub.register('POST', '/commercial-accounts', fieldErr);
      await expect(createAccount(C1, inputWithExtras as never, newIdempotencyKey())).rejects.toBe(fieldErr);
    } finally {
      dispose();
    }
  });

  it('updateAccount sends PATCH /commercial-accounts/:id with COMPANY scope, UUIDv7 key, If-Match, and whitelisted patch', async () => {
    const updated: UpdateAccountResult = {
      ...makeAccount({ version: 2, creditLimit: '25000' }),
      warnings: [{ branchRuleId: 'r1', branchId: C1_B1.branchId, fields: ['creditLimit'] }],
    };
    const stub = new TradeHttpStub({ 'PATCH /commercial-accounts/:id': updated });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const key = newIdempotencyKey();
      const res = await updateAccount(
        C1_B1,
        updated.id,
        1,
        {
          creditLimit: '25000',
          terms: { orderingHold: true },
          paymentTermsId: 'strip-me',
          partyId: 'strip-me',
        } as never,
        key,
      );
      expect(res).toEqual(updated);
      expect(stub.recordedWrites()).toEqual([
        {
          method: 'PATCH',
          path: `/commercial-accounts/${updated.id}`,
          body: {
            creditLimit: '25000',
            terms: { orderingHold: true },
          },
          key,
          ifMatch: '"1"',
          scope: { companyId: C1.companyId },
          query: undefined,
        },
      ]);
    } finally {
      dispose();
    }
  });

  it('listBranchRules calls GET /commercial-accounts/:id/branch-rules with OPTIONAL scope and unwraps items', async () => {
    const rules: BranchRuleListItem[] = [
      { ...makeBranchRule(), branchName: 'Cairo HQ', branchNameAr: null },
    ];
    const stub = new TradeHttpStub({
      'GET /commercial-accounts/:id/branch-rules': { items: rules },
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const res = await listBranchRules(C1_B1, 'acc-1');
      expect(res).toEqual(rules);
      expect(stub.recordedReads()).toEqual([
        { path: '/commercial-accounts/acc-1/branch-rules', query: undefined, scope: C1_B1 },
      ]);
    } finally {
      dispose();
    }
  });

  it('createBranchRule and updateBranchRule require BRANCH scope, UUIDv7 key, and If-Match on update', async () => {
    const rule = makeBranchRule();
    const stub = new TradeHttpStub({
      'POST /commercial-accounts/:id/branch-rules': rule,
      'PATCH /commercial-accounts/:id/branch-rules/:branchId': { ...rule, version: 2, status: 'RETIRED' },
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(
        createBranchRule(C1, 'acc-1', { branchId: C1_B1.branchId, narrowingRules: { orderingHold: true } }, newIdempotencyKey()),
      ).rejects.toMatchObject({ status: 400, code: 'TRADE.SCOPE.REQUIRED' });

      const createKey = newIdempotencyKey();
      const created = await createBranchRule(
        C1_B1,
        'acc-1',
        { branchId: C1_B1.branchId, narrowingRules: { creditLimit: '25000', orderingHold: true }, extra: true } as never,
        createKey,
      );
      expect(created).toEqual(rule);

      const updateKey = newIdempotencyKey();
      const updated = await updateBranchRule(
        C1_B1,
        'acc-1',
        C1_B1.branchId,
        1,
        { narrowingRules: { creditLimit: '20000' }, status: 'RETIRED', extra: true } as never,
        updateKey,
      );
      expect(updated.version).toBe(2);

      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: '/commercial-accounts/acc-1/branch-rules',
          body: { branchId: C1_B1.branchId, narrowingRules: { creditLimit: '25000', orderingHold: true } },
          key: createKey,
          ifMatch: undefined,
          scope: C1_B1,
          query: undefined,
        },
        {
          method: 'PATCH',
          path: `/commercial-accounts/acc-1/branch-rules/${C1_B1.branchId}`,
          body: { narrowingRules: { creditLimit: '20000' }, status: 'RETIRED' },
          key: updateKey,
          ifMatch: '"1"',
          scope: C1_B1,
          query: undefined,
        },
      ]);
    } finally {
      dispose();
    }
  });

  it('getCreditSummary calls GET /commercial-accounts/:id/credit-summary with OPTIONAL scope and optional currencyCode', async () => {
    const summary: CreditSummary = {
      effectiveLimit: '50000',
      exposureAmount: '10000',
      openCommitments: '5000',
      remainingAmount: '35000',
      currencyCode: 'EGP',
      orderingHold: false,
      asOf: '2026-11-23T09:59:00.000Z',
      stale: false,
    };
    const stub = new TradeHttpStub({ 'GET /commercial-accounts/:id/credit-summary': summary });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const res = await getCreditSummary(C1, 'acc-1', 'EGP');
      expect(res).toEqual(summary);
      await getCreditSummary(C1_B1, 'acc-1');
      expect(stub.recordedReads()).toEqual([
        { path: '/commercial-accounts/acc-1/credit-summary', query: { currencyCode: 'EGP' }, scope: C1 },
        { path: '/commercial-accounts/acc-1/credit-summary', query: undefined, scope: C1_B1 },
      ]);
    } finally {
      dispose();
    }
  });

  it('evaluateCredit sends POST /commercial-accounts/:id/evaluate-credit with OPTIONAL scope, fresh key per call, and Foundation-only fields', async () => {
    const decision: CreditDecision = {
      id: 'dec-1',
      explanation: 'Within limit.',
      evaluatedAt: '2026-11-23T10:00:00.000Z',
      matchedRules: ['CREDIT_WITHIN_LIMIT'],
      rejectedRules: [],
      result: {
        outcome: 'ALLOW',
        reasonCode: 'CREDIT_WITHIN_LIMIT',
        accountVersion: 1,
        branchRuleId: null,
        effectiveLimit: '50000',
        exposureAmount: '10000',
        openCommitments: '5000',
        proposedAmount: '1200',
        remainingAmount: '33800',
        currencyCode: 'EGP',
        orderingHold: false,
        asOf: '2026-11-23T09:59:00.000Z',
      },
    };
    const stub = new TradeHttpStub({ 'POST /commercial-accounts/:id/evaluate-credit': decision });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const first = await evaluateCredit(C1_B1, 'acc-1', {
        proposedAmount: '1200',
        currencyCode: 'EGP',
        sourceDocumentId: 'should-be-stripped',
      } as never);
      const second = await evaluateCredit(C1_B1, 'acc-1', {
        proposedAmount: '1200',
        currencyCode: 'EGP',
      });
      expect(first).toEqual(decision);
      expect(second).toEqual(decision);

      const writes = stub.recordedWrites();
      expect(writes).toHaveLength(2);
      expect(writes[0].body).toEqual({ proposedAmount: '1200', currencyCode: 'EGP' });
      expect(writes[0].scope).toEqual(C1_B1);
      expect(writes[0].key).toMatch(UUID_V7_REGEX);
      expect(writes[1].key).toMatch(UUID_V7_REGEX);
      expect(writes[0].key).not.toBe(writes[1].key);
    } finally {
      dispose();
    }
  });

  it('blockAccount and unblockAccount send POST with COMPANY scope, UUIDv7 key, If-Match, and reasonCodeId only', async () => {
    const blocked = makeAccount({ status: 'BLOCKED', blockReasonCode: 'OVERDUE', version: 2 });
    const active = makeAccount({ status: 'ACTIVE', blockReasonCode: null, version: 3 });
    const stub = new TradeHttpStub({
      'POST /commercial-accounts/:id/block': blocked,
      'POST /commercial-accounts/:id/unblock': active,
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const k1 = newIdempotencyKey();
      const bRes = await blockAccount(
        C1_B1,
        blocked.id,
        1,
        { reasonCodeId: 'rc-1', reasonNote: '  Overdue  ', evidenceRef: '  INV-9  ', reasonCode: 'LEGACY' } as never,
        k1,
      );
      expect(bRes.status).toBe('BLOCKED');

      const k2 = newIdempotencyKey();
      const uRes = await unblockAccount(
        C1_B1,
        active.id,
        2,
        { reasonCodeId: 'rc-2', reasonNote: '   ' },
        k2,
      );
      expect(uRes.status).toBe('ACTIVE');

      expect(stub.recordedWrites()).toEqual([
        {
          method: 'POST',
          path: `/commercial-accounts/${blocked.id}/block`,
          body: { reasonCodeId: 'rc-1', reasonNote: 'Overdue', evidenceRef: 'INV-9' },
          key: k1,
          ifMatch: '"1"',
          scope: { companyId: C1.companyId },
          query: undefined,
        },
        {
          method: 'POST',
          path: `/commercial-accounts/${active.id}/unblock`,
          body: { reasonCodeId: 'rc-2' },
          key: k2,
          ifMatch: '"2"',
          scope: { companyId: C1.companyId },
          query: undefined,
        },
      ]);
    } finally {
      dispose();
    }
  });

  it('listAccountLookups, listCreditPolicies, and listPriceBooks read GET /commercial-accounts/lookups with OPTIONAL scope', async () => {
    const policy: CreditPolicy = {
      id: 'pol-1',
      versionNumber: 1,
      code: 'credit.std',
      scopeTarget: 'COMPANY',
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      effectiveTo: null,
      status: 'PUBLISHED',
      companyId: C1.companyId,
      branchId: null,
    };
    const wireBook = {
      id: 'pb-1',
      code: 'RETAIL',
      name: 'Retail',
      purpose: 'SALES' as const,
      currencyCode: 'EGP',
      status: 'ACTIVE' as const,
    };
    const expectedBook: PriceBookOption = {
      ...wireBook,
      companyId: C1.companyId,
    };

    const stub = new TradeHttpStub({
      'GET /commercial-accounts/lookups': { creditPolicies: [policy], priceBooks: [wireBook] },
    });
    const dispose = bindTradeHttpForTest(stub);
    try {
      const lookups = await listAccountLookups(C1_B1, 'CUSTOMER', { search: ' Ret ', limit: 25 });
      expect(lookups).toEqual({ creditPolicies: [policy], priceBooks: [expectedBook] });

      const policies = await listCreditPolicies(C1);
      expect(policies).toEqual([policy]);

      const books = await listPriceBooks(C1, 'SUPPLIER');
      expect(books).toEqual([expectedBook]);

      expect(stub.recordedReads()).toEqual([
        { path: '/commercial-accounts/lookups', query: { role: 'CUSTOMER', search: 'Ret', limit: 25 }, scope: C1_B1 },
        { path: '/commercial-accounts/lookups', query: undefined, scope: C1 },
        { path: '/commercial-accounts/lookups', query: { role: 'SUPPLIER' }, scope: C1 },
      ]);
    } finally {
      dispose();
    }
  });

  it('listParties reads Core directory pages via tradeCore(), merges pages, normalizes PERSON -> INDIVIDUAL, and propagates 403', async () => {
    const stub = new TradeHttpStub();
    const core = new TradeCoreStub();
    const originalRead = core.read.bind(core);
    let pageCalls = 0;
    core.read = (async <T>(path: string, query?: Record<string, unknown>, options?: { scope?: unknown }) => {
      pageCalls += 1;
      core.register('GET', '/api/tenant/core/v1/directory/parties', {
        data:
          pageCalls === 1
            ? [
                {
                  id: 'pty-1',
                  displayName: 'Delta Trading',
                  partyType: 'ORGANIZATION',
                  status: 'ACTIVE',
                  branchId: null,
                  code: 'P-1',
                  roles: [{ roleType: 'CUSTOMER', status: 'ACTIVE' }],
                },
              ]
            : [
                {
                  id: 'pty-2',
                  displayName: 'Omar Hassan',
                  displayNameAr: 'عمر حسن',
                  partyType: 'PERSON',
                  status: 'ACTIVE',
                  branchId: 'b1',
                  roles: [
                    { roleType: 'CUSTOMER', status: 'ACTIVE' },
                    { roleType: 'SUPPLIER', status: 'INACTIVE' },
                  ],
                },
              ],
        meta: {
          page: pageCalls,
          limit: 100,
          total: 2,
          totalPages: 2,
          hasNext: pageCalls === 1,
          hasPrev: pageCalls === 2,
        },
      });
      return originalRead<T>(path, query as never, options as never);
    }) as typeof core.read;

    const dispose = bindTradeHttpForTest(stub, core);
    try {
      const parties = await listParties('CUSTOMER');
      expect(stub.recordedReads()).toHaveLength(0);
      expect(core.recordedReads()).toEqual([
        {
          path: '/api/tenant/core/v1/directory/parties',
          query: { status: 'ACTIVE', roleType: 'CUSTOMER', page: 1, limit: 100 },
          scope: undefined,
        },
        {
          path: '/api/tenant/core/v1/directory/parties',
          query: { status: 'ACTIVE', roleType: 'CUSTOMER', page: 2, limit: 100 },
          scope: undefined,
        },
      ]);
      expect(parties).toEqual([
        {
          id: 'pty-1',
          displayName: 'Delta Trading',
          displayNameAr: 'Delta Trading',
          partyType: 'ORGANIZATION',
          code: 'P-1',
          roles: ['CUSTOMER'],
          status: 'ACTIVE',
          branchId: null,
        },
        {
          id: 'pty-2',
          displayName: 'Omar Hassan',
          displayNameAr: 'عمر حسن',
          partyType: 'INDIVIDUAL',
          code: null,
          roles: ['CUSTOMER'],
          status: 'ACTIVE',
          branchId: 'b1',
        },
      ]);

      core.read = originalRead;
      core.register('GET', '/api/tenant/core/v1/directory/parties', new ApiError(403, 'AUTH_FORBIDDEN'));
      await expect(listParties('SUPPLIER')).rejects.toMatchObject({ status: 403 });
    } finally {
      dispose();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { listBranchRules } from './commercial-accounts.api';
import { bindTradeHttpForTest } from '../../shared/trade-http';
import { TradeHttpStub } from '../../shared/testing/trade-http-testing';
import type { BranchRuleList } from './commercial-accounts.model';

describe('commercial accounts API branch rules', () => {
  it('unwraps the branch rules items and preserves branch names', async () => {
    const list: BranchRuleList = {
      items: [{
        id: 'rule-1',
        commercialAccountId: 'account-1',
        companyId: 'c1',
        branchId: 'branch-1',
        narrowingRules: { orderingHold: true },
        status: 'ACTIVE',
        version: 1,
        branchName: 'Main branch',
        branchNameAr: null,
      }],
    };
    const stub = new TradeHttpStub({ 'GET /commercial-accounts/account-1/branch-rules': list });
    const dispose = bindTradeHttpForTest(stub);
    try {
      await expect(listBranchRules({ companyId: 'c1' }, 'account-1')).resolves.toEqual(list.items);
      expect(stub.recordedReads()[0]).toMatchObject({
        path: '/commercial-accounts/account-1/branch-rules',
        scope: { companyId: 'c1' },
      });
    } finally {
      dispose();
    }
  });
});

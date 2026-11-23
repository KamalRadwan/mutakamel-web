import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import {
  countDefinitions,
  createDefinition,
  createVersion,
  deleteVersion,
  getDefinition,
  getVersion,
  listDefinitions,
  runAction,
  setDefinitionStatus,
  updateVersion,
} from './policy.api';
import type {
  GovernedDefinition,
  GovernedVersionRecord,
  PolicyContent,
  WorkflowContent,
} from './policy.model';

const POLICY_CONTENT: PolicyContent = {
  rules: [
    {
      code: 'BIG_ORDER',
      priority: 10,
      all: [{ fact: 'document.total', operator: 'GT', value: '1000' }],
      outcome: 'REQUIRE_APPROVAL',
      reasonCode: 'ORDER_TOO_BIG',
    },
  ],
  defaultOutcome: 'ALLOW',
};

const WORKFLOW_CONTENT: WorkflowContent = {
  states: ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
  initialState: 'PENDING',
  terminalStates: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
  transitions: [
    { code: 'T_APPROVE', from: 'PENDING', to: 'APPROVED', action: 'APPROVE', requiresApproval: true },
  ],
};

function makeVersionRecord(status: GovernedVersionRecord['status'], version = 1): GovernedVersionRecord {
  return {
    id: 'ver-1',
    versionNumber: 1,
    version,
    status,
    contentHash: 'hash-1',
    registryVersion: '2026.11.1',
    effectiveFrom: '2026-12-01T00:00:00.000Z',
    effectiveTo: null,
    supersededAt: null,
    supersededByVersionId: null,
    createdBy: 'user-1',
    submittedBy: null,
    approvedBy: null,
    approvedAt: null,
    restoredFromVersionId: null,
    content: POLICY_CONTENT,
    testCases: [],
    updatedBy: 'user-1',
    updatedAt: '2026-11-23T00:00:00.000Z',
  };
}

describe('policy & workflow governance flow via TradeHttpStub', () => {
  let stub: TradeHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    stub = new TradeHttpStub();
    dispose = bindTradeHttpForTest(stub);
  });

  afterEach(() => {
    dispose();
  });

  it('supports definition list, counts, create, status toggle and version CRUD for both domains', async () => {
    const polDef: GovernedDefinition = {
      id: 'pol-1',
      code: 'DISC_GUARD',
      scopeTarget: 'COMPANY',
      companyId: 'comp-1',
      branchId: null,
      companyScopeKey: 'comp-1',
      branchScopeKey: 'ALL',
      status: 'ACTIVE',
      version: 1,
      createdBy: 'u-1',
      updatedBy: 'u-1',
      createdAt: '2026-11-23T00:00:00.000Z',
      updatedAt: '2026-11-23T00:00:00.000Z',
      policyKind: 'PRICING_GUARD',
      versions: [],
    };
    const wfDef: GovernedDefinition = {
      ...polDef,
      id: 'wf-1',
      code: 'PO_FLOW',
      policyKind: undefined,
      workflowKind: 'PURCHASE_ORDER',
    };

    stub
      .register('POST', '/policies', polDef)
      .register('POST', '/workflows', wfDef)
      .register('GET', '/policies', { items: [polDef], total: 1, page: 1, limit: 20 })
      .register('GET', '/policies/counts', { total: 1, byStatus: { ACTIVE: 1, INACTIVE: 0 } })
      .register('GET', '/policies/pol-1', polDef)
      .register('PATCH', '/policies/pol-1', { ...polDef, status: 'INACTIVE', version: 2 })
      .register('POST', '/policies/pol-1/versions', makeVersionRecord('DRAFT', 1))
      .register('POST', '/workflows/wf-1/versions', makeVersionRecord('DRAFT', 1))
      .register('PATCH', '/policy-versions/ver-1', makeVersionRecord('DRAFT', 2))
      .register('GET', '/policy-versions/ver-1', {
        ...makeVersionRecord('DRAFT', 2),
        definition: { id: 'pol-1', code: 'DISC_GUARD', kind: 'PRICING_GUARD', scopeTarget: 'COMPANY' },
        evidence: { validation: null, test: null },
        actions: [],
      })
      .register('DELETE', '/policy-versions/ver-1', { id: 'ver-1', deleted: true });

    await createDefinition('policy', { code: 'DISC_GUARD', policyKind: 'PRICING_GUARD', scopeTarget: 'COMPANY' });
    await createDefinition('workflow', { code: 'PO_FLOW', workflowKind: 'PURCHASE_ORDER', scopeTarget: 'COMPANY' });
    const list = await listDefinitions('policy', {});
    const counts = await countDefinitions('policy', {});
    const def = await getDefinition('policy', 'pol-1');
    const toggled = await setDefinitionStatus('policy', 'pol-1', 'INACTIVE', 1);
    await createVersion('policy', 'pol-1', {
      content: POLICY_CONTENT,
      testCases: [],
      effectiveFrom: '2026-12-01T00:00:00.000Z',
    }, 1);
    await createVersion('workflow', 'wf-1', {
      content: WORKFLOW_CONTENT,
      testCases: [],
      effectiveFrom: '2026-12-01T00:00:00.000Z',
    }, 1);
    await updateVersion('policy', 'ver-1', { content: POLICY_CONTENT }, 1);
    const ver = await getVersion('policy', 'ver-1');
    const del = await deleteVersion('policy', 'ver-1', 2);

    expect(list.total).toBe(1);
    expect(counts.total).toBe(1);
    expect(def.code).toBe('DISC_GUARD');
    expect(toggled.status).toBe('INACTIVE');
    expect(ver.version).toBe(2);
    expect(del.deleted).toBe(true);
  });

  it('forwards governance conflict & approval errors cleanly', async () => {
    stub
      .register('POST', '/policy-versions/ver-1/approve', new ApiError(409, 'TRADE.APPROVAL.REJECTED'))
      .register('POST', '/workflow-versions/ver-1/publish', new ApiError(409, 'TRADE.CONCURRENCY.STALE_VERSION'));

    await expect(runAction('policy', 'ver-1', 'approve', {}, 2)).rejects.toMatchObject({
      status: 409,
      code: 'TRADE.APPROVAL.REJECTED',
    });
    await expect(runAction('workflow', 'ver-1', 'publish', { supersedesVersionId: 'ver-0' }, 2)).rejects.toMatchObject({
      status: 409,
      code: 'TRADE.CONCURRENCY.STALE_VERSION',
    });
  });
});

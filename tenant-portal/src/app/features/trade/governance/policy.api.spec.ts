import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { bindTradeHttpForTest } from '../shared/trade-http';
import { TradeHttpStub } from '../shared/testing/trade-http-testing';
import {
  countDefinitions,
  createDefinition,
  createVersion,
  deleteVersion,
  getDecision,
  getDefinition,
  getMetadata,
  getVersion,
  listDefinitions,
  runAction,
  setDefinitionStatus,
  toDecision,
  toPolicyMetadata,
  updateVersion,
} from './policy.api';
import type {
  GovernedAction,
  GovernedCounts,
  GovernedDefinition,
  GovernedDefinitionRecord,
  GovernedDeleteResult,
  GovernedDomain,
  GovernedList,
  GovernedValidateResult,
  GovernedVersionDetail,
  GovernedVersionRecord,
  PolicyContent,
  PolicyTestResult,
  WireDecisionReceipt,
  WirePolicyMetadata,
  WorkflowContent,
  WorkflowTestResult,
} from './policy.model';

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPTIONAL_CTX = { companyId: 'comp-1', branchId: 'br-1' };

function makeDefinition(domain: GovernedDomain, overrides: Partial<GovernedDefinition> = {}): GovernedDefinition {
  return {
    id: domain === 'policy' ? 'pol-1' : 'wf-1',
    code: domain === 'policy' ? 'DEFAULT_PRICING_GUARD' : 'DEFAULT_PO_WORKFLOW',
    scopeTarget: 'COMPANY',
    companyId: 'comp-1',
    branchId: null,
    companyScopeKey: 'comp-1',
    branchScopeKey: 'ALL',
    status: 'ACTIVE',
    version: 3,
    createdBy: 'u-1',
    updatedBy: 'u-1',
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
    ...(domain === 'policy' ? { policyKind: 'PRICING_GUARD' } : { workflowKind: 'PURCHASE_ORDER' }),
    versions: [],
    ...overrides,
  };
}

function makeWireMetadata(): WirePolicyMetadata {
  return {
    registryVersion: '2026.11.1',
    facts: {
      'document.total': 'decimal',
      'document.kind': 'string',
      'actor.has_override': 'boolean',
      'pricing.discount_percent': 'number',
    },
    operatorsByType: {
      decimal: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN'],
      number: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN'],
      string: ['EQ', 'NEQ', 'IN', 'CONTAINS'],
      boolean: ['EQ', 'NEQ'],
    },
    outcomes: ['ALLOW', 'DENY', 'REQUIRE_APPROVAL', 'SELECT'],
    workflowActions: ['SUBMIT', 'APPROVE', 'REJECT', 'WITHDRAW', 'CONFIRM', 'CANCEL', 'HOLD', 'RELEASE', 'RETRY'],
    kinds: {
      policies: [{ kind: 'PRICING_GUARD', supported: true }],
      workflows: [
        { kind: 'PURCHASE_ORDER', supported: true },
        { kind: 'QUOTATION', supported: false },
        { kind: 'SALES_ORDER', supported: false },
        { kind: 'PRICE_PUBLICATION', supported: false },
        { kind: 'CONFIGURATION_PUBLICATION', supported: false },
      ],
    },
    factsByKind: {
      PRICING_GUARD: ['document.kind', 'document.total', 'actor.has_override'],
    },
    purchaseOrderWorkflowShape: {
      states: ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
      initialState: 'PENDING',
      terminalStates: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
      transitions: [
        { code: 'APPROVE_PO', from: 'PENDING', to: 'APPROVED', action: 'APPROVE', requiresApproval: true },
      ],
    },
    codePatterns: {
      definition: '^[A-Z][A-Z0-9_.-]{1,99}$',
      rule: '^[A-Z][A-Z0-9_]{1,63}$',
      state: '^[A-Z][A-Z0-9_]{1,63}$',
      reason: '^[A-Z][A-Z0-9_.-]{1,79}$',
    },
  };
}

function makePolicyContent(): PolicyContent {
  return {
    rules: [
      {
        code: 'BIG_ORDER',
        priority: 10,
        all: [{ fact: 'document.total', operator: 'GT', value: '1000' }],
        outcome: 'REQUIRE_APPROVAL',
        reasonCode: 'HIGH_TOTAL',
      },
      {
        code: 'TIER_SEL',
        priority: 20,
        all: [{ fact: 'document.kind', operator: 'EQ', value: 'QUOTATION' }],
        outcome: 'SELECT',
        selectedValue: 'VIP_TIER',
        reasonCode: 'TIER_PICKED',
      },
    ],
    defaultOutcome: 'ALLOW',
  };
}

function makeWorkflowContent(): WorkflowContent {
  return {
    states: ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'],
    initialState: 'PENDING',
    terminalStates: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
    transitions: [
      { code: 'APPROVE_PO', from: 'PENDING', to: 'APPROVED', action: 'APPROVE', requiresApproval: true },
      { code: 'REJECT_PO', from: 'PENDING', to: 'REJECTED', action: 'REJECT', requiresApproval: true },
      { code: 'WITHDRAW_PO', from: 'PENDING', to: 'WITHDRAWN', action: 'WITHDRAW', requiresApproval: false },
    ],
  };
}

describe('policy.api', () => {
  let stub: TradeHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    stub = new TradeHttpStub();
    dispose = bindTradeHttpForTest(stub);
  });

  afterEach(() => {
    dispose();
  });

  it('getMetadata maps object-map facts into ordered array with decimal type and OPTIONAL scope', async () => {
    stub.register('GET', '/policy-studio/metadata', makeWireMetadata());

    const meta = await getMetadata(OPTIONAL_CTX);

    expect(meta.facts).toEqual([
      { key: 'document.total', type: 'decimal' },
      { key: 'document.kind', type: 'string' },
      { key: 'actor.has_override', type: 'boolean' },
      { key: 'pricing.discount_percent', type: 'number' },
    ]);
    expect(stub.recordedReads()[0]).toEqual({
      path: '/policy-studio/metadata',
      query: undefined,
      scope: OPTIONAL_CTX,
    });
  });

  it('toPolicyMetadata tolerates array facts defensively', () => {
    const mapped = toPolicyMetadata({
      ...makeWireMetadata(),
      facts: [{ key: 'document.total', type: 'decimal' }],
    });
    expect(mapped.facts).toEqual([{ key: 'document.total', type: 'decimal' }]);
  });

  for (const domain of ['policy', 'workflow'] as const) {
    const base = domain === 'policy' ? '/policies' : '/workflows';
    const verBase = domain === 'policy' ? '/policy-versions' : '/workflow-versions';

    it(`listDefinitions, countDefinitions, getDefinition use ${base} and OPTIONAL scope`, async () => {
      const def = makeDefinition(domain);
      const listRes: GovernedList<GovernedDefinition> = { items: [def], total: 1, page: 1, limit: 25 };
      const countsRes: GovernedCounts = { total: 1, byStatus: { ACTIVE: 1, INACTIVE: 0 } };
      stub
        .register('GET', base, listRes)
        .register('GET', `${base}/counts`, countsRes)
        .register('GET', `${base}/${def.id}`, def);

      const list = await listDefinitions(domain, { page: 1, limit: 25, kind: 'PURCHASE_ORDER', q: '' }, OPTIONAL_CTX);
      const counts = await countDefinitions(domain, { status: 'ACTIVE' }, OPTIONAL_CTX);
      const single = await getDefinition(domain, def.id, OPTIONAL_CTX);

      expect(list.items).toHaveLength(1);
      expect(counts.total).toBe(1);
      expect(single.id).toBe(def.id);
      expect(stub.recordedReads()).toEqual([
        { path: base, query: { page: 1, limit: 25, kind: 'PURCHASE_ORDER' }, scope: OPTIONAL_CTX },
        { path: `${base}/counts`, query: { status: 'ACTIVE' }, scope: OPTIONAL_CTX },
        { path: `${base}/${def.id}`, query: undefined, scope: OPTIONAL_CTX },
      ]);
    });

    it(`createDefinition (${domain}) sends whitelisted DTO + UUIDv7 key without If-Match`, async () => {
      const rec: GovernedDefinitionRecord = makeDefinition(domain);
      stub.register('POST', base, rec);

      const input =
        domain === 'policy'
          ? { code: 'NEW_POL', policyKind: 'PRICING_GUARD', scopeTarget: 'COMPANY' as const }
          : { code: 'NEW_WF', workflowKind: 'PURCHASE_ORDER', scopeTarget: 'COMPANY' as const };
      const created = await createDefinition(domain, input, { ctx: OPTIONAL_CTX });

      expect(created.id).toBe(rec.id);
      const write = stub.recordedWrites()[0];
      expect(write.method).toBe('POST');
      expect(write.path).toBe(base);
      expect(write.body).toEqual(input);
      expect(write.key).toMatch(UUID_V7_REGEX);
      expect(write.ifMatch).toBeUndefined();
      expect(write.scope).toEqual(OPTIONAL_CTX);
    });

    it(`setDefinitionStatus (${domain}) sends PATCH { status } + key + If-Match`, async () => {
      const rec: GovernedDefinitionRecord = makeDefinition(domain, { status: 'INACTIVE', version: 4 });
      stub.register('PATCH', `${base}/${rec.id}`, rec);

      const updated = await setDefinitionStatus(domain, rec.id, 'INACTIVE', 3, undefined, OPTIONAL_CTX);

      expect(updated.status).toBe('INACTIVE');
      const write = stub.recordedWrites()[0];
      expect(write.method).toBe('PATCH');
      expect(write.path).toBe(`${base}/${rec.id}`);
      expect(write.body).toEqual({ status: 'INACTIVE' });
      expect(write.ifMatch).toBe('"3"');
      expect(write.key).toMatch(UUID_V7_REGEX);
    });

    it(`deleteVersion (${domain}) sends DELETE with no body + key + If-Match`, async () => {
      const res: GovernedDeleteResult = { id: 'ver-1', deleted: true };
      stub.register('DELETE', `${verBase}/ver-1`, res);

      const out = await deleteVersion(domain, 'ver-1', 2, undefined, OPTIONAL_CTX);

      expect(out.deleted).toBe(true);
      const write = stub.recordedWrites()[0];
      expect(write.method).toBe('DELETE');
      expect(write.path).toBe(`${verBase}/ver-1`);
      expect(write.body).toBeUndefined();
      expect(write.ifMatch).toBe('"2"');
      expect(write.key).toMatch(UUID_V7_REGEX);
    });
  }

  it('createVersion & updateVersion sanitize selectedValue (G-7), optional test fields, and dotted keys (G-4)', async () => {
    const verRec: GovernedVersionRecord = {
      id: 'pv-1',
      versionNumber: 1,
      version: 2,
      status: 'DRAFT',
      contentHash: 'h1',
      registryVersion: '2026.11.1',
      effectiveFrom: '2026-12-01T00:00:00.000Z',
      effectiveTo: null,
      supersededAt: null,
      supersededByVersionId: null,
      createdBy: 'u-1',
      submittedBy: null,
      approvedBy: null,
      approvedAt: null,
      restoredFromVersionId: null,
      content: makePolicyContent(),
      testCases: [],
      updatedBy: 'u-1',
      updatedAt: '2026-11-23T00:00:00.000Z',
    };
    stub
      .register('POST', '/policies/pol-1/versions', verRec)
      .register('PATCH', '/policy-versions/pv-1', verRec);

    const contentWithNulls = {
      rules: [
        {
          code: 'R1',
          priority: 10,
          all: [{ fact: 'document.total', operator: 'GT' as const, value: '500' }],
          outcome: 'ALLOW' as const,
          selectedValue: null as unknown as string,
          reasonCode: 'OK',
        },
        {
          code: 'R2',
          priority: 20,
          all: [{ fact: 'document.kind', operator: 'EQ' as const, value: 'QUOTATION' }],
          outcome: 'SELECT' as const,
          selectedValue: 'GOLD',
          reasonCode: 'PICK',
        },
      ],
      defaultOutcome: 'DENY' as const,
      defaultSelectedValue: null as unknown as string,
    };
    const casesWithNulls = [
      {
        code: 'CASE_1',
        facts: { 'document.total': '600' },
        expectedOutcome: 'ALLOW' as const,
        expectedRuleCode: null as unknown as string,
        expectedSelectedValue: null as unknown as string,
      },
    ];

    await createVersion(
      'policy',
      'pol-1',
      {
        content: contentWithNulls,
        testCases: casesWithNulls,
        effectiveFrom: '2026-12-01T00:00:00.000Z',
        effectiveTo: null,
      },
      3,
      undefined,
      OPTIONAL_CTX,
    );
    await updateVersion(
      'policy',
      'pv-1',
      { content: contentWithNulls },
      2,
      undefined,
      OPTIONAL_CTX,
    );

    const createWrite = stub.recordedWrites()[0];
    const sentContent = (createWrite.body as { content: PolicyContent }).content;
    expect(createWrite.ifMatch).toBe('"3"');
    expect('selectedValue' in sentContent.rules[0]).toBe(false);
    expect(sentContent.rules[1].selectedValue).toBe('GOLD');
    expect('defaultSelectedValue' in sentContent).toBe(false);
    expect(sentContent.rules[0].all[0].fact).toBe('document.total');

    const sentCase = (createWrite.body as { testCases: Record<string, unknown>[] }).testCases[0];
    expect('expectedRuleCode' in sentCase).toBe(false);
    expect('expectedSelectedValue' in sentCase).toBe(false);

    const patchWrite = stub.recordedWrites()[1];
    expect(patchWrite.method).toBe('PATCH');
    expect(patchWrite.path).toBe('/policy-versions/pv-1');
    expect(patchWrite.ifMatch).toBe('"2"');
    expect('defaultSelectedValue' in (patchWrite.body as { content: PolicyContent }).content).toBe(false);
  });

  it.each<GovernedDomain>(['policy', 'workflow'])('runAction x 8 routes %s versions with key, If-Match, scope and action-specific bodies', async (domain) => {
    const base = domain === 'policy' ? '/policy-versions' : '/workflow-versions';
    const actions: readonly GovernedAction[] = [
      'validate',
      'test',
      'submit',
      'approve',
      'reject',
      'publish',
      'retire',
      'rollback',
    ];
    for (const action of actions) {
      stub.register('POST', `${base}/pv-1/${action}`, {
        id: 'pv-1',
        evidenceId: 'ev-1',
        passed: true,
        cases: [],
        diagnostics: [],
        registryVersion: '2026.11.1',
        contentHash: 'h1',
        version: 2,
      } as unknown as GovernedValidateResult);
    }

    for (const action of actions) {
      await runAction(
        domain,
        'pv-1',
        action,
        {
          reason: 'DEPRECATED_TEXT',
          reasonCode: 'RETIRE_OLD',
          reasonNote: 'Cleanup',
          supersedesVersionId: 'pv-0',
          evidence: { checked: true },
        },
        4,
        undefined,
        OPTIONAL_CTX,
      );
    }

    const writes = stub.recordedWrites();
    expect(writes).toHaveLength(8);
    writes.forEach((w, idx) => {
      const action = actions[idx];
      expect(w.method).toBe('POST');
      expect(w.path).toBe(`${base}/pv-1/${action}`);
      expect(w.ifMatch).toBe('"4"');
      expect(w.key).toMatch(UUID_V7_REGEX);
      expect(w.scope).toEqual(OPTIONAL_CTX);
      const body = w.body as Record<string, unknown>;
      expect('reason' in body).toBe(false);
      if (action === 'publish') {
        expect(body['supersedesVersionId']).toBe('pv-0');
        expect('reasonCode' in body).toBe(false);
      } else if (action === 'reject' || action === 'retire' || action === 'rollback') {
        expect(body['reasonCode']).toBe('RETIRE_OLD');
        expect(body['reasonNote']).toBe('Cleanup');
        expect('supersedesVersionId' in body).toBe(false);
      } else {
        expect(body).toEqual({ evidence: { checked: true } });
      }
    });

    stub.register('POST', '/workflow-versions/wfv-1/test', {
      evidenceId: 'ev-wf',
      passed: false,
      contentHash: 'hwf',
      version: 2,
      cases: [
        {
          code: 'BAD_STEP',
          passed: false,
          expectedState: 'APPROVED',
          actualState: 'PENDING',
          invalidAction: 'CANCEL',
        },
      ],
    });

    const wfTest = (await runAction(
      'workflow',
      'wfv-1',
      'test',
      {},
      1,
      undefined,
      OPTIONAL_CTX,
    )) as WorkflowTestResult;
    expect(wfTest.cases[0].firstInvalidAction).toBe('CANCEL');
  });

  it('getVersion normalizes workflow evidence.test.cases invalidAction -> firstInvalidAction', async () => {
    const wfDetail: GovernedVersionDetail<WorkflowContent, []> = {
      id: 'wfv-1',
      versionNumber: 1,
      version: 2,
      status: 'TESTED',
      contentHash: 'h1',
      registryVersion: '2026.11.1',
      effectiveFrom: '2026-11-20T00:00:00.000Z',
      effectiveTo: null,
      supersededAt: null,
      supersededByVersionId: null,
      createdBy: 'u-1',
      submittedBy: null,
      approvedBy: null,
      approvedAt: null,
      restoredFromVersionId: null,
      content: makeWorkflowContent(),
      testCases: [],
      definition: { id: 'wf-1', code: 'PO_WF', kind: 'PURCHASE_ORDER', scopeTarget: 'COMPANY' },
      evidence: {
        validation: { passed: true, contentHash: 'h1', recordedAt: '2026-11-20T00:00:00.000Z' },
        test: {
          passed: false,
          contentHash: 'h1',
          recordedAt: '2026-11-20T00:00:00.000Z',
          cases: [
            {
              code: 'C1',
              passed: false,
              expectedState: 'APPROVED',
              actualState: 'PENDING',
              invalidAction: 'HOLD',
            } as unknown as WorkflowTestResult['cases'][number],
          ],
        },
      },
      actions: [],
    };
    stub.register('GET', '/workflow-versions/wfv-1', wfDetail);

    const out = await getVersion('workflow', 'wfv-1', OPTIONAL_CTX);
    const firstCase = out.evidence.test?.cases[0] as WorkflowTestResult['cases'][number];
    expect(firstCase.firstInvalidAction).toBe('HOLD');
  });

  it('getDecision & toDecision map G-1 nested result, matchedRules[], flat aggregate fields, and G-2 policyVersions[]', async () => {
    const wire: WireDecisionReceipt = {
      id: 'dec-1',
      decisionType: 'PURCHASE_APPROVAL',
      scopeTarget: 'BRANCH',
      companyId: 'comp-1',
      branchId: 'br-1',
      channelId: null,
      aggregateType: 'PURCHASE_ORDER',
      aggregateId: '0193a000-0000-7000-8000-000000000099',
      matchedRules: ['HIGH_VALUE_PO', 'DIRECTOR_SIG'],
      result: {
        outcome: 'REQUIRE_APPROVAL',
        reasonCode: 'PO_ABOVE_LIMIT',
        explanationCode: 'RULE_MATCHED',
        selectedValue: 'DIRECTOR',
      },
      explanation: 'Purchase order exceeds manager threshold.',
      policyVersions: [
        {
          type: 'POLICY',
          policyKind: 'PURCHASE_APPROVAL',
          definitionId: 'pol-1',
          definitionCode: 'PO_APPROVAL_POLICY',
          id: 'pv-7',
          version: 3,
          contentHash: 'abc123',
          registryVersion: '2026.11.1',
        },
      ],
      evaluatedAt: '2026-11-23T12:00:00.000Z',
      correlationId: 'corr-xyz',
    };
    stub.register('GET', '/decisions/dec-1', wire);

    const mapped = await getDecision('dec-1', OPTIONAL_CTX);
    expect(mapped).toEqual(toDecision(wire));
    expect(mapped.outcome).toBe('REQUIRE_APPROVAL');
    expect(mapped.reasonCode).toBe('PO_ABOVE_LIMIT');
    expect(mapped.explanationCode).toBe('RULE_MATCHED');
    expect(mapped.selectedValue).toBe('DIRECTOR');
    expect(mapped.matchedRules).toEqual(['HIGH_VALUE_PO', 'DIRECTOR_SIG']);
    expect(mapped.aggregateType).toBe('PURCHASE_ORDER');
    expect(mapped.aggregateId).toBe('0193a000-0000-7000-8000-000000000099');
    expect(mapped.policyVersions[0].id).toBe('pv-7');
    expect(mapped.policyVersions[0].version).toBe(3);
  });

  it('rejects missing/bad idempotency key and missing If-Match before sending HTTP requests', async () => {
    await expect(
      createDefinition(
        'policy',
        { code: 'P1', policyKind: 'PRICING_GUARD', scopeTarget: 'COMPANY' },
        { idempotencyKey: '' },
      ),
    ).rejects.toMatchObject({ status: 400, code: 'TRADE.IDEMPOTENCY.KEY_MISSING' });

    await expect(
      createDefinition(
        'policy',
        { code: 'P1', policyKind: 'PRICING_GUARD', scopeTarget: 'COMPANY' },
        { idempotencyKey: 'not-a-uuid' },
      ),
    ).rejects.toMatchObject({ status: 422, code: 'TRADE.IDEMPOTENCY.KEY_REQUIRED' });

    await expect(setDefinitionStatus('policy', 'pol-1', 'INACTIVE', 0)).rejects.toMatchObject({
      status: 400,
      code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED',
    });
    await expect(deleteVersion('policy', 'pv-1')).rejects.toMatchObject({
      status: 400,
      code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED',
    });
    await expect(runAction('workflow', 'wfv-1', 'validate', {})).rejects.toMatchObject({
      status: 400,
      code: 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED',
    });
    expect(stub.recordedWrites()).toHaveLength(0);
  });

  it('surfaces backend ApiError status, code, and details', async () => {
    stub.register(
      'POST',
      '/policy-versions/pv-1/test',
      new ApiError(422, 'TRADE.POLICY.TEST_FAILED', { failedCount: ['2'] }),
    );
    stub.register('GET', '/decisions/dec-busy', new ApiError(503, 'TRADE.POLICY.DECISION_UNAVAILABLE'));

    await expect(runAction('policy', 'pv-1', 'test', {}, 1)).rejects.toMatchObject({
      status: 422,
      code: 'TRADE.POLICY.TEST_FAILED',
      details: { failedCount: ['2'] },
    });
    await expect(getDecision('dec-busy')).rejects.toMatchObject({
      status: 503,
      code: 'TRADE.POLICY.DECISION_UNAVAILABLE',
    });
  });
});

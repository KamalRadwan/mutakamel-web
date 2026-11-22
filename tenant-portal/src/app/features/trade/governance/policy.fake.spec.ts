import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { FAKE_COLLEAGUE, FAKE_ME, setFakeActor } from './governance-fake-actors';
import { resetFakePolicyStore, setFakeGovernedScopeTarget } from './policy.fake';
import {
  createDefinition,
  createVersion,
  deleteVersion,
  countDefinitions,
  getDefinition,
  getVersion,
  listDefinitions,
  runAction,
  setDefinitionStatus,
  updateVersion,
} from './policy.api';
import type {
  CreateDefinitionInput,
  GovernedDomain,
  GovernedValidateResult,
  PolicyContent,
  PolicyTestCase,
  PolicyTestResult,
  WorkflowContent,
  WorkflowTestCase,
  WorkflowTestResult,
} from './policy.model';

/** Runs the fake timers to completion and returns (or rethrows) the settled result. */
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

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the call to reject');
}

const NOW = '2026-11-21T12:00:00.000Z';
const PAST = '2026-11-01T00:00:00.000Z';
const FUTURE = '2026-12-01T00:00:00.000Z';
let seq = 0;

const POLICY_CONTENT: PolicyContent = {
  rules: [
    {
      code: 'BIG_ORDER',
      priority: 10,
      all: [{ fact: 'totalAmount', operator: 'GT', value: 1000 }],
      outcome: 'REQUIRE_APPROVAL',
      reasonCode: 'ORDER_TOO_BIG',
    },
    {
      code: 'EGP_ONLY',
      priority: 20,
      all: [{ fact: 'currencyCode', operator: 'IN', value: ['EGP', 'USD'] }],
      outcome: 'ALLOW',
      reasonCode: 'CURRENCY_OK',
    },
  ],
  defaultOutcome: 'DENY',
};

const POLICY_CASES: PolicyTestCase[] = [
  { code: 'LARGE', facts: { totalAmount: 5000, currencyCode: 'EGP' }, expectedOutcome: 'REQUIRE_APPROVAL', expectedRuleCode: 'BIG_ORDER' },
];

const WORKFLOW_CONTENT: WorkflowContent = {
  states: ['OPEN', 'PENDING', 'CLOSED'],
  initialState: 'OPEN',
  terminalStates: ['CLOSED'],
  transitions: [
    { code: 'T_SUBMIT', from: 'OPEN', to: 'PENDING', action: 'SUBMIT' },
    { code: 'T_APPROVE', from: 'PENDING', to: 'CLOSED', action: 'APPROVE' },
  ],
};

const WORKFLOW_CASES: WorkflowTestCase[] = [
  { code: 'HAPPY', startState: 'OPEN', actions: ['SUBMIT', 'APPROVE'], expectedState: 'CLOSED' },
];

async function newDefinition(domain: GovernedDomain): Promise<string> {
  seq += 1;
  const def = await settle(
    createDefinition(
      domain,
      domain === 'policy'
        ? { code: `SPEC_DEF_POLICY_${seq}`, policyKind: 'PRICING_GUARD', scopeTarget: 'TENANT' }
        : { code: `SPEC_DEF_WORKFLOW_${seq}`, workflowKind: 'PURCHASE_ORDER', scopeTarget: 'TENANT' },
    ),
  );
  return def.id;
}

async function newVersion(
  domain: GovernedDomain,
  defId: string,
  effectiveFrom = FUTURE,
  extra: { content?: PolicyContent | WorkflowContent; testCases?: (PolicyTestCase | WorkflowTestCase)[]; effectiveTo?: string | null } = {},
): Promise<string> {
  const detail = await settle(
    createVersion(domain, defId, {
      content: extra.content ?? (domain === 'policy' ? POLICY_CONTENT : WORKFLOW_CONTENT),
      testCases: extra.testCases ?? (domain === 'policy' ? POLICY_CASES : WORKFLOW_CASES),
      effectiveFrom,
      effectiveTo: extra.effectiveTo ?? null,
    }),
  );
  return detail.id;
}

async function validateAndTest(domain: GovernedDomain, id: string): Promise<void> {
  await settle(runAction(domain, id, 'validate'));
  await settle(runAction(domain, id, 'test'));
}

/** Draft -> validated -> tested -> submitted (maker) -> approved + published (colleague). */
async function publishNew(
  domain: GovernedDomain,
  defId: string,
  effectiveFrom: string,
  supersedesVersionId: string | null = null,
): Promise<string> {
  setFakeActor(FAKE_ME);
  const id = await newVersion(domain, defId, effectiveFrom);
  await validateAndTest(domain, id);
  await settle(runAction(domain, id, 'submit'));
  setFakeActor(FAKE_COLLEAGUE);
  await settle(runAction(domain, id, 'approve'));
  await settle(runAction(domain, id, 'publish', supersedesVersionId ? { supersedesVersionId } : {}));
  setFakeActor(FAKE_ME);
  return id;
}

// Each test starts from the seed, in the TENANT context: the seeded live COMPANY versions never overlap.
beforeEach(() => {
  resetFakePolicyStore();
  setFakeGovernedScopeTarget('TENANT');
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  setFakeActor(FAKE_ME);
});

afterEach(() => {
  setFakeActor(FAKE_ME);
  vi.useRealTimers();
});

describe.each<GovernedDomain>(['policy', 'workflow'])('%s definitions', (domain) => {
  it('creates an ACTIVE definition entity with its kind property and scope keys', async () => {
    seq += 1;
    const created = await settle(
      createDefinition(domain, { code: `SPEC_NEW_${seq}`, scopeTarget: 'TENANT', ...(domain === 'policy' ? { policyKind: 'PRICING_GUARD' } : { workflowKind: 'PURCHASE_ORDER' }) } as CreateDefinitionInput),
    );

    expect(created.status).toBe('ACTIVE');
    expect(created.code).toBe(`SPEC_NEW_${seq}`);
    expect(created.scopeTarget).toBe('TENANT');
    expect(created.companyScopeKey).toBe('none');
    expect(domain === 'policy' ? created.policyKind : created.workflowKind).toBe(
      domain === 'policy' ? 'PRICING_GUARD' : 'PURCHASE_ORDER',
    );
  });

  it('rejects a scopeTarget other than the operating scope with 422 TRADE.AUTH.TARGET_INVALID', async () => {
    const error = await rejection(
      createDefinition(domain, { code: 'SPEC_OTHER_SCOPE', scopeTarget: 'COMPANY', ...(domain === 'policy' ? { policyKind: 'PRICING_GUARD' } : { workflowKind: 'PURCHASE_ORDER' }) } as CreateDefinitionInput),
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.AUTH.TARGET_INVALID');
  });

  it('rejects a duplicate code with 409 CODE_TAKEN', async () => {
    const id = await newDefinition(domain);
    const existing = await settle(getDefinition(domain, id));

    const error = await rejection(
      createDefinition(domain, { code: existing.code, scopeTarget: 'TENANT', ...(domain === 'policy' ? { policyKind: 'PRICING_GUARD' } : { workflowKind: 'PURCHASE_ORDER' }) } as CreateDefinitionInput),
    );

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.POLICY.CODE_TAKEN');
  });

  it('rejects a kind that is not enabled with 422', async () => {
    const input = domain === 'policy'
      ? { code: 'SPEC_BAD_KIND', policyKind: 'CREDIT', scopeTarget: 'TENANT' as const }
      : { code: 'SPEC_BAD_KIND', workflowKind: 'QUOTATION', scopeTarget: 'TENANT' as const };
    const error = await rejection(createDefinition(domain, input));

    expect(error.status).toBe(422);
    expect(error.code).toBe(domain === 'policy' ? 'TRADE.POLICY.DEFINITION_INVALID' : 'TRADE.WORKFLOW.DEFINITION_INVALID');
    expect(error.details?.['reason']).toEqual(['kind_not_supported']);
  });

  it('rejects a malformed code with 400 (DTO pattern)', async () => {
    const error = await rejection(
      createDefinition(domain, { code: 'spec_lower', scopeTarget: 'TENANT', ...(domain === 'policy' ? { policyKind: 'PRICING_GUARD' } : { workflowKind: 'PURCHASE_ORDER' }) } as CreateDefinitionInput),
    );

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('lists { items, total, page, limit } filtered by q', async () => {
    const id = await newDefinition(domain);
    const def = await settle(getDefinition(domain, id));

    const hits = await settle(listDefinitions(domain, { q: def.code.toLowerCase() }));

    expect(hits.items.map((d) => d.id)).toEqual([id]);
    expect(hits).toMatchObject({ total: 1, page: 1, limit: 25 });
  });

  it('counts definitions by status', async () => {
    await newDefinition(domain);
    const inactive = await newDefinition(domain);
    await settle(setDefinitionStatus(domain, inactive, 'INACTIVE'));

    const counts = await settle(countDefinitions(domain));

    expect(counts).toEqual({ total: 2, byStatus: { ACTIVE: 1, INACTIVE: 1 } });
  });

  it('does not return a definition from the other domain', async () => {
    const id = await newDefinition(domain);
    const other: GovernedDomain = domain === 'policy' ? 'workflow' : 'policy';

    const error = await rejection(getDefinition(other, id));

    expect(error.status).toBe(404);
    expect(error.code).toBe('TRADE.POLICY.DEFINITION_NOT_FOUND');
  });

  it('deactivates a definition that has no live version', async () => {
    const id = await newDefinition(domain);

    const updated = await settle(setDefinitionStatus(domain, id, 'INACTIVE'));

    expect(updated.status).toBe('INACTIVE');
  });

  it('refuses to deactivate a definition that has a live version', async () => {
    const id = await newDefinition(domain);
    await publishNew(domain, id, PAST);

    const error = await rejection(setDefinitionStatus(domain, id, 'INACTIVE'));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.POLICY.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['has_live_version']);
  });

  it('rejects a stale If-Match when changing status', async () => {
    const id = await newDefinition(domain);
    const def = await settle(getDefinition(domain, id));

    const error = await rejection(setDefinitionStatus(domain, id, 'INACTIVE', def.version + 4));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.CONCURRENCY.STALE_VERSION');
  });
});

describe.each<GovernedDomain>(['policy', 'workflow'])('%s version lifecycle', (domain) => {
  it('creates version 1 as DRAFT and numbers the next one 2', async () => {
    const defId = await newDefinition(domain);

    const first = await settle(getVersion(domain, await newVersion(domain, defId)));
    const second = await settle(getVersion(domain, await newVersion(domain, defId)));

    expect(first.status).toBe('DRAFT');
    expect(first.versionNumber).toBe(1);
    expect(second.versionNumber).toBe(2);
  });

  it('refuses to test a version that was not validated first', async () => {
    const id = await newVersion(domain, await newDefinition(domain));

    const error = await rejection(runAction(domain, id, 'test'));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.POLICY.TEST_CONFLICT');
  });

  it('moves a validated, passing version to TESTED', async () => {
    const id = await newVersion(domain, await newDefinition(domain));

    const validation = (await settle(runAction(domain, id, 'validate'))) as GovernedValidateResult;
    const test = (await settle(runAction(domain, id, 'test'))) as PolicyTestResult | WorkflowTestResult;
    const detail = await settle(getVersion(domain, id));

    expect(validation.passed).toBe(true);
    expect(validation.evidenceId).not.toBeNull();
    expect(test.passed).toBe(true);
    expect(detail.status).toBe('TESTED');
    expect(detail.evidence.validation?.passed).toBe(true);
    expect(detail.evidence.test?.passed).toBe(true);
    expect(detail.evidence.test?.cases).toHaveLength(1);
    expect(detail.actions.map((a) => a.action)).toEqual(['TEST', 'VALIDATE']);
  });

  it('clears the validation evidence when a validated draft is edited', async () => {
    const id = await newVersion(domain, await newDefinition(domain));
    await settle(runAction(domain, id, 'validate'));

    const saved = await settle(updateVersion(domain, id, { effectiveFrom: '2026-12-15T00:00:00.000Z' }));
    const detail = await settle(getVersion(domain, id));

    expect(saved.status).toBe('DRAFT');
    expect(saved.definitionCode).toBe(detail.definition.code);
    // Evidence is keyed by the content hash, which includes the effective range.
    expect(detail.evidence.validation).toBeNull();
    expect(detail.evidence.test).toBeNull();
  });

  it('refuses to edit a version that already passed its test with 409', async () => {
    const id = await newVersion(domain, await newDefinition(domain));
    await validateAndTest(domain, id);

    const error = await rejection(updateVersion(domain, id, { effectiveFrom: '2026-12-15T00:00:00.000Z' }));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.POLICY.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['not_editable']);
  });

  it('refuses to submit a version that is not TESTED', async () => {
    const id = await newVersion(domain, await newDefinition(domain));

    const error = await rejection(runAction(domain, id, 'submit'));

    expect(error.code).toBe('TRADE.POLICY.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['not_tested']);
  });

  it('submits a tested version for approval', async () => {
    const id = await newVersion(domain, await newDefinition(domain));
    await validateAndTest(domain, id);

    const detail = await settle(runAction(domain, id, 'submit'));

    expect((detail as { status: string }).status).toBe('APPROVAL_PENDING');
  });

  it('forbids the maker from approving their own submission', async () => {
    const id = await newVersion(domain, await newDefinition(domain));
    await validateAndTest(domain, id);
    await settle(runAction(domain, id, 'submit'));

    const error = await rejection(runAction(domain, id, 'approve'));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
  });

  it('lets a different user approve and then publish', async () => {
    const defId = await newDefinition(domain);
    const id = await publishNew(domain, defId, PAST);

    const detail = await settle(getVersion(domain, id));

    expect(detail.status).toBe('PUBLISHED');
    expect(detail.approvedBy).toBe(FAKE_COLLEAGUE);
  });

  it('refuses to publish a version that is only TESTED', async () => {
    const id = await newVersion(domain, await newDefinition(domain));
    await validateAndTest(domain, id);

    const error = await rejection(runAction(domain, id, 'publish'));

    expect(error.code).toBe('TRADE.POLICY.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['not_approved']);
  });

  it('refuses to publish while the definition is INACTIVE (definition_inactive)', async () => {
    const defId = await newDefinition(domain);
    setFakeActor(FAKE_ME);
    const id = await newVersion(domain, defId, FUTURE);
    await validateAndTest(domain, id);
    await settle(runAction(domain, id, 'submit'));
    const def = await settle(getDefinition(domain, defId));
    await settle(setDefinitionStatus(domain, defId, 'INACTIVE', def.version));
    setFakeActor(FAKE_COLLEAGUE);
    await settle(runAction(domain, id, 'approve'));

    const error = await rejection(runAction(domain, id, 'publish'));

    expect(error.details?.['reason']).toEqual(['definition_inactive']);
  });

  it('schedules an approved version whose start is in the future', async () => {
    const id = await publishNew(domain, await newDefinition(domain), FUTURE);

    const detail = await settle(getVersion(domain, id));

    expect(detail.status).toBe('SCHEDULED');
    expect(detail.actions[0].action).toBe('PUBLISH');
  });

  it('activates a scheduled version once its start has passed', async () => {
    const id = await publishNew(domain, await newDefinition(domain), FUTURE);

    vi.setSystemTime(new Date('2026-12-01T00:00:01.000Z'));
    const detail = await settle(getVersion(domain, id));

    expect(detail.status).toBe('PUBLISHED');
  });

  it('rejects a publish that overlaps a live version without supersession', async () => {
    const defId = await newDefinition(domain);
    await publishNew(domain, defId, PAST);

    setFakeActor(FAKE_ME);
    const next = await newVersion(domain, defId, FUTURE);
    await validateAndTest(domain, next);
    await settle(runAction(domain, next, 'submit'));
    setFakeActor(FAKE_COLLEAGUE);
    await settle(runAction(domain, next, 'approve'));
    const error = await rejection(runAction(domain, next, 'publish'));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.POLICY.EFFECTIVE_OVERLAP');
  });

  it('deletes a never-published draft', async () => {
    const defId = await newDefinition(domain);
    const id = await newVersion(domain, defId);

    const result = await settle(deleteVersion(domain, id));
    const def = await settle(getDefinition(domain, defId));

    expect(result).toEqual({ id, deleted: true });
    expect(def.versions).toEqual([]);
  });

  it('refuses to delete a published version', async () => {
    const id = await publishNew(domain, await newDefinition(domain), PAST);

    const error = await rejection(deleteVersion(domain, id));

    expect(error.code).toBe('TRADE.POLICY.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['not_deletable']);
  });

  it('rejects a version window whose end is not after its start', async () => {
    const defId = await newDefinition(domain);

    const error = await rejection(
      createVersion(domain, defId, {
        content: domain === 'policy' ? POLICY_CONTENT : WORKFLOW_CONTENT,
        testCases: (domain === 'policy' ? POLICY_CASES : WORKFLOW_CASES) as PolicyTestCase[],
        effectiveFrom: FUTURE,
        effectiveTo: FUTURE,
      }),
    );

    expect(error.status).toBe(422);
    expect(error.code).toBe('TRADE.POLICY.DEFINITION_INVALID');
  });
});

describe.each<GovernedDomain>(['policy', 'workflow'])('%s supersession', (domain) => {
  it('links a scheduled replacement and keeps the replaced version PUBLISHED until activation', async () => {
    const defId = await newDefinition(domain);
    const oldId = await publishNew(domain, defId, PAST);

    const newId = await publishNew(domain, defId, FUTURE, oldId);
    const old = await settle(getVersion(domain, oldId));

    expect(old.status).toBe('PUBLISHED');
    expect(old.supersededAt).toBe(FUTURE);
    expect(old.supersededByVersionId).toBe(newId);
  });

  // Supersession is recorded by superseded_at only, never by editing effective_to.
  it('leaves effectiveTo of the replaced version untouched', async () => {
    const defId = await newDefinition(domain);
    const oldId = await publishNew(domain, defId, PAST);

    await publishNew(domain, defId, FUTURE, oldId);
    const old = await settle(getVersion(domain, oldId));

    expect(old.effectiveTo).toBeNull();
  });

  it('refuses to supersede a version that is not live', async () => {
    const defId = await newDefinition(domain);
    const draftId = await newVersion(domain, defId, PAST);

    setFakeActor(FAKE_ME);
    const next = await newVersion(domain, defId, FUTURE);
    await validateAndTest(domain, next);
    await settle(runAction(domain, next, 'submit'));
    setFakeActor(FAKE_COLLEAGUE);
    await settle(runAction(domain, next, 'approve'));
    const error = await rejection(runAction(domain, next, 'publish', { supersedesVersionId: draftId }));

    expect(error.code).toBe('TRADE.POLICY.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['invalid_predecessor']);
  });

  it('refuses the author publishing their own approved version', async () => {
    const defId = await newDefinition(domain);
    const id = await newVersion(domain, defId, FUTURE);
    await validateAndTest(domain, id);
    await settle(runAction(domain, id, 'submit'));
    setFakeActor(FAKE_COLLEAGUE);
    await settle(runAction(domain, id, 'approve'));
    setFakeActor(FAKE_ME);

    const error = await rejection(runAction(domain, id, 'publish'));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.POLICY.PUBLISH_NOT_ALLOWED');
  });

  it('reports the self-publish detail reason in lowercase', async () => {
    const defId = await newDefinition(domain);
    const id = await newVersion(domain, defId, FUTURE);
    await validateAndTest(domain, id);
    await settle(runAction(domain, id, 'submit'));
    setFakeActor(FAKE_COLLEAGUE);
    await settle(runAction(domain, id, 'approve'));
    setFakeActor(FAKE_ME);

    const error = await rejection(runAction(domain, id, 'publish'));

    expect(error.details?.['reason']?.[0]).toBe('self_publish');
  });
});

describe.each<GovernedDomain>(['policy', 'workflow'])('%s reason body (reject, retire, rollback)', (domain) => {
  const codes =
    domain === 'policy'
      ? { reject: 'RULES_INCORRECT', retire: 'NO_LONGER_NEEDED', rollback: 'NEW_VERSION_FAULTY' }
      : { reject: 'TESTS_INSUFFICIENT', retire: 'REPLACED', rollback: 'AUDIT_REQUEST' };

  async function pendingVersion(): Promise<string> {
    const id = await newVersion(domain, await newDefinition(domain));
    await validateAndTest(domain, id);
    await settle(runAction(domain, id, 'submit'));
    setFakeActor(FAKE_COLLEAGUE);
    return id;
  }

  it('rejects a version with a {reasonCode, reasonNote} body and audits the reason', async () => {
    const id = await pendingVersion();

    await settle(runAction(domain, id, 'reject', { reasonCode: codes.reject, reasonNote: 'needs work' }));
    const detail = await settle(getVersion(domain, id));

    expect(detail.status).toBe('REJECTED');
    expect(detail.actions[0]).toMatchObject({ action: 'REJECT', reasonNote: 'needs work', reasonCode: codes.reject });
  });

  it('refuses a reject without a reason code with 400 VALIDATION_FAILED (DTO rule)', async () => {
    const id = await pendingVersion();

    const error = await rejection(runAction(domain, id, 'reject', {}));

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('refuses a reason code that belongs to another reason kind', async () => {
    const id = await pendingVersion();

    const error = await rejection(runAction(domain, id, 'reject', { reasonCode: codes.retire }));

    expect(error.status).toBe(422);
  });

  it('retires a published version with a valid retire reason code', async () => {
    const id = await publishNew(domain, await newDefinition(domain), PAST);

    await settle(runAction(domain, id, 'retire', { reasonCode: codes.retire, reasonNote: 'obsolete' }));
    const detail = await settle(getVersion(domain, id));

    expect(detail.status).toBe('RETIRED');
    expect(detail.actions[0]).toMatchObject({ action: 'RETIRE', reasonCode: codes.retire, reasonNote: 'obsolete' });
  });

  it('rolls back into a new DRAFT version restored from the source', async () => {
    const defId = await newDefinition(domain);
    const id = await publishNew(domain, defId, PAST);

    const rolled = (await settle(runAction(domain, id, 'rollback', { reasonCode: codes.rollback }))) as {
      status: string;
      versionNumber: number;
      restoredFromVersionId: string;
    };

    const source = await settle(getVersion(domain, id));

    expect(rolled.status).toBe('DRAFT');
    expect(rolled.versionNumber).toBe(2);
    expect(rolled.restoredFromVersionId).toBe(id);
    // The ROLLBACK action row is kept on the source version.
    expect(source.actions[0]).toMatchObject({ action: 'ROLLBACK', reasonCode: codes.rollback });
  });

  it('accepts a reason note of exactly 500 characters', async () => {
    const id = await publishNew(domain, await newDefinition(domain), PAST);

    await settle(runAction(domain, id, 'retire', { reasonCode: codes.retire, reasonNote: 'x'.repeat(500) }));
    const detail = await settle(getVersion(domain, id));

    expect(detail.status).toBe('RETIRED');
  });

  it('rejects a reason note longer than 500 characters with 400 VALIDATION_FAILED', async () => {
    const id = await publishNew(domain, await newDefinition(domain), PAST);

    const error = await rejection(
      runAction(domain, id, 'retire', { reasonCode: codes.retire, reasonNote: 'x'.repeat(501) }),
    );

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });
});

describe('policy test cases', () => {
  async function versionWith(content: PolicyContent, cases: PolicyTestCase[]): Promise<string> {
    const defId = await newDefinition('policy');
    const id = await newVersion('policy', defId, FUTURE, { content, testCases: cases });
    await settle(runAction('policy', id, 'validate'));
    return id;
  }

  it('passes when every case matches the expected outcome and rule', async () => {
    const id = await versionWith(POLICY_CONTENT, POLICY_CASES);

    const result = (await settle(runAction('policy', id, 'test'))) as PolicyTestResult;

    expect(result.passed).toBe(true);
    expect(result.cases[0]).toMatchObject({ code: 'LARGE', passed: true, actualOutcome: 'REQUIRE_APPROVAL', actualRuleCode: 'BIG_ORDER' });
  });

  it('fails a case whose expected outcome differs and leaves the version in DRAFT', async () => {
    const id = await versionWith(POLICY_CONTENT, [
      { code: 'WRONG', facts: { totalAmount: 5000, currencyCode: 'EGP' }, expectedOutcome: 'ALLOW' },
    ]);

    const result = (await settle(runAction('policy', id, 'test'))) as PolicyTestResult;
    const detail = await settle(getVersion('policy', id));

    expect(result.passed).toBe(false);
    expect(result.cases[0].actualOutcome).toBe('REQUIRE_APPROVAL');
    expect(detail.status).toBe('DRAFT');
    expect(detail.evidence.test?.passed).toBe(false);
  });

  it('fails a case whose expected rule code differs even if the outcome matches', async () => {
    const id = await versionWith(POLICY_CONTENT, [
      { code: 'RULE', facts: { totalAmount: 5000, currencyCode: 'EGP' }, expectedOutcome: 'REQUIRE_APPROVAL', expectedRuleCode: 'EGP_ONLY' },
    ]);

    const result = (await settle(runAction('policy', id, 'test'))) as PolicyTestResult;

    expect(result.cases[0].passed).toBe(false);
    expect(result.cases[0].actualRuleCode).toBe('BIG_ORDER');
  });

  it('applies the lowest priority number first when several rules match', async () => {
    const id = await versionWith(POLICY_CONTENT, [
      { code: 'BOTH', facts: { totalAmount: 5000, currencyCode: 'EGP' }, expectedOutcome: 'REQUIRE_APPROVAL' },
    ]);

    const result = (await settle(runAction('policy', id, 'test'))) as PolicyTestResult;

    expect(result.cases[0].actualRuleCode).toBe('BIG_ORDER');
  });

  it('falls back to the default outcome when no rule matches', async () => {
    const id = await versionWith(POLICY_CONTENT, [
      { code: 'NONE', facts: { totalAmount: 10, currencyCode: 'JPY' }, expectedOutcome: 'DENY' },
    ]);

    const result = (await settle(runAction('policy', id, 'test'))) as PolicyTestResult;

    expect(result.passed).toBe(true);
    expect(result.cases[0].actualRuleCode).toBeNull();
  });

  it('returns the selected value of a SELECT rule', async () => {
    const content: PolicyContent = {
      rules: [
        {
          code: 'PICK',
          priority: 1,
          all: [{ fact: 'channelType', operator: 'EQ', value: 'POS' }],
          outcome: 'SELECT',
          selectedValue: 'WH_A',
          reasonCode: 'POS_PICK',
        },
      ],
      defaultOutcome: 'DENY',
    };
    const id = await versionWith(content, [
      { code: 'POS', facts: { channelType: 'POS' }, expectedOutcome: 'SELECT', expectedSelectedValue: 'WH_A' },
    ]);

    const result = (await settle(runAction('policy', id, 'test'))) as PolicyTestResult;

    expect(result.passed).toBe(true);
    expect(result.cases[0].actualSelectedValue).toBe('WH_A');
  });

  it('treats a condition on a fact missing from the case as not matching', async () => {
    const id = await versionWith(POLICY_CONTENT, [
      { code: 'NOFACT', facts: { currencyCode: 'JPY' }, expectedOutcome: 'DENY' },
    ]);

    const result = (await settle(runAction('policy', id, 'test'))) as PolicyTestResult;

    expect(result.passed).toBe(true);
  });

  it('rejects creating a version with no test cases with 400 (DTO ArrayMinSize)', async () => {
    const defId = await newDefinition('policy');

    const error = await rejection(
      createVersion('policy', defId, { content: POLICY_CONTENT, testCases: [], effectiveFrom: FUTURE }),
    );

    expect(error.status).toBe(400);
    expect(error.code).toBe('TRADE.VALIDATION_FAILED');
  });

  it('rejects creating a version with more than 100 test cases with 400 (DTO ArrayMaxSize)', async () => {
    const many = Array.from({ length: 101 }, (_, i) => ({
      code: `C${i}`,
      facts: { totalAmount: 1 },
      expectedOutcome: 'DENY' as const,
    }));
    const defId = await newDefinition('policy');

    const error = await rejection(
      createVersion('policy', defId, { content: POLICY_CONTENT, testCases: many, effectiveFrom: FUTURE }),
    );

    expect(error.status).toBe(400);
  });

  it('replaces the test cases wholesale when a draft is updated', async () => {
    const id = await versionWith(POLICY_CONTENT, POLICY_CASES);

    const detail = await settle(
      updateVersion('policy', id, {
        testCases: [{ code: 'ONLY', facts: { totalAmount: 1 }, expectedOutcome: 'DENY' }],
      }),
    );

    expect(detail.testCases).toHaveLength(1);
    expect((detail.testCases[0] as PolicyTestCase).code).toBe('ONLY');
  });
});

describe('policy validation diagnostics', () => {
  async function diagnose(content: PolicyContent) {
    const id = await newVersion('policy', await newDefinition('policy'), FUTURE, { content });
    return (await settle(runAction('policy', id, 'validate'))) as GovernedValidateResult;
  }

  it('flags two rules sharing a priority as ambiguous precedence', async () => {
    const result = await diagnose({
      rules: [
        { code: 'RULE_A', priority: 5, all: [{ fact: 'totalAmount', operator: 'GT', value: 1 }], outcome: 'ALLOW', reasonCode: 'OK_A' },
        { code: 'RULE_B', priority: 5, all: [{ fact: 'totalAmount', operator: 'GT', value: 2 }], outcome: 'DENY', reasonCode: 'NO_B' },
      ],
      defaultOutcome: 'DENY',
    });

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ path: 'rules[1].priority', reason: 'AMBIGUOUS_PRECEDENCE' }),
    );
  });

  it('flags an operator that is not valid for the fact type', async () => {
    const result = await diagnose({
      rules: [{ code: 'RULE_A', priority: 1, all: [{ fact: 'customerEligible', operator: 'GT', value: true }], outcome: 'ALLOW', reasonCode: 'OK_A' }],
      defaultOutcome: 'DENY',
    });

    expect(result.diagnostics.map((d) => d.path)).toContain('rules[0].all[0].operator');
  });

  it('flags an unknown fact', async () => {
    const result = await diagnose({
      rules: [{ code: 'RULE_A', priority: 1, all: [{ fact: 'noSuchFact', operator: 'EQ', value: 'x' }], outcome: 'ALLOW', reasonCode: 'OK_A' }],
      defaultOutcome: 'DENY',
    });

    expect(result.diagnostics.map((d) => d.path)).toContain('rules[0].all[0].fact');
  });

  it('flags a SELECT outcome without a selected value', async () => {
    const result = await diagnose({
      rules: [{ code: 'RULE_A', priority: 1, all: [{ fact: 'totalAmount', operator: 'GT', value: 1 }], outcome: 'SELECT', reasonCode: 'OK_A' }],
      defaultOutcome: 'DENY',
    });

    expect(result.diagnostics.map((d) => d.path)).toContain('rules[0].selectedValue');
  });

  it('does not stamp the validation evidence when diagnostics exist', async () => {
    const content: PolicyContent = { rules: [], defaultOutcome: 'SELECT' };
    const id = await newVersion('policy', await newDefinition('policy'), FUTURE, { content });

    await settle(runAction('policy', id, 'validate'));
    const detail = await settle(getVersion('policy', id));

    expect(detail.evidence.validation).toBeNull();
  });
});

describe('workflow test cases', () => {
  async function versionWith(content: WorkflowContent, cases: WorkflowTestCase[]): Promise<string> {
    const defId = await newDefinition('workflow');
    const id = await newVersion('workflow', defId, FUTURE, { content, testCases: cases });
    await settle(runAction('workflow', id, 'validate'));
    return id;
  }

  it('passes when the action path ends in the expected state', async () => {
    const id = await versionWith(WORKFLOW_CONTENT, WORKFLOW_CASES);

    const result = (await settle(runAction('workflow', id, 'test'))) as WorkflowTestResult;

    expect(result.passed).toBe(true);
    expect(result.cases[0]).toMatchObject({ actualState: 'CLOSED', firstInvalidAction: null });
  });

  it('reports the first action that has no transition and stops there', async () => {
    const id = await versionWith(WORKFLOW_CONTENT, [
      { code: 'BAD', startState: 'OPEN', actions: ['SUBMIT', 'CANCEL', 'APPROVE'], expectedState: 'CLOSED' },
    ]);

    const result = (await settle(runAction('workflow', id, 'test'))) as WorkflowTestResult;
    const detail = await settle(getVersion('workflow', id));

    expect(result.passed).toBe(false);
    expect(result.cases[0]).toMatchObject({ actualState: 'PENDING', firstInvalidAction: 'CANCEL' });
    expect(detail.status).toBe('DRAFT');
  });

  it('fails a case that ends in a different state than expected', async () => {
    const id = await versionWith(WORKFLOW_CONTENT, [
      { code: 'SHORT', startState: 'OPEN', actions: ['SUBMIT'], expectedState: 'CLOSED' },
    ]);

    const result = (await settle(runAction('workflow', id, 'test'))) as WorkflowTestResult;

    expect(result.cases[0]).toMatchObject({ passed: false, actualState: 'PENDING', firstInvalidAction: null });
  });

  it('flags an unreachable state during validation', async () => {
    const id = await newVersion('workflow', await newDefinition('workflow'), FUTURE, {
      content: { ...WORKFLOW_CONTENT, states: ['OPEN', 'PENDING', 'CLOSED', 'ORPHAN'] },
    });

    const result = (await settle(runAction('workflow', id, 'validate'))) as GovernedValidateResult;

    expect(result.passed).toBe(false);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ reason: 'UNREACHABLE_STATE' }));
  });

  it('flags two transitions with the same source state and action', async () => {
    const id = await newVersion('workflow', await newDefinition('workflow'), FUTURE, {
      content: {
        ...WORKFLOW_CONTENT,
        transitions: [
          ...WORKFLOW_CONTENT.transitions,
          { code: 'T_DUP', from: 'OPEN', to: 'CLOSED', action: 'SUBMIT' },
        ],
      },
    });

    const result = (await settle(runAction('workflow', id, 'validate'))) as GovernedValidateResult;

    expect(result.diagnostics).toContainEqual(expect.objectContaining({ reason: 'AMBIGUOUS_PRECEDENCE' }));
  });
});

describe('governed idempotency and concurrency', () => {
  it('replays the same idempotency key on submit without a second state change', async () => {
    const id = await newVersion('policy', await newDefinition('policy'));
    await validateAndTest('policy', id);
    const first = await settle(runAction('policy', id, 'submit', {}, { idempotencyKey: 'idem-submit-1' }));
    const second = await settle(runAction('policy', id, 'submit', {}, { idempotencyKey: 'idem-submit-1' }));

    expect(second).toEqual(first);
  });

  it('rejects a stale If-Match on an action with 409', async () => {
    const id = await newVersion('policy', await newDefinition('policy'));
    const detail = await settle(getVersion('policy', id));

    const error = await rejection(runAction('policy', id, 'validate', {}, detail.version + 9));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.CONCURRENCY.STALE_VERSION');
  });

  it('returns 404 for an unknown version', async () => {
    const error = await rejection(getVersion('policy', 'missing'));

    expect(error.status).toBe(404);
    expect(error.code).toBe('TRADE.POLICY.DEFINITION_NOT_FOUND');
  });
});

describe('money thresholds are decimal strings (S2)', () => {
  const rule = (value: string | number) => ({
    rules: [{ code: 'RULE_A', priority: 1, all: [{ fact: 'totalAmount', operator: 'GT' as const, value }], outcome: 'REQUIRE_APPROVAL' as const, reasonCode: 'OK_A' }],
    defaultOutcome: 'ALLOW' as const,
  });

  async function diagnose(content: PolicyContent) {
    const id = await newVersion('policy', await newDefinition('policy'), FUTURE, { content });
    return (await settle(runAction('policy', id, 'validate'))) as GovernedValidateResult;
  }

  it('accepts a decimal-string threshold and a legacy numeric one', async () => {
    expect((await diagnose(rule('1000.50'))).passed).toBe(true);
    expect((await diagnose(rule(1000))).passed).toBe(true);
  });

  it.each(['abc', '', '1.123456789', '1e3'])('rejects threshold %j with EXPRESSION_INVALID', async (bad) => {
    const result = await diagnose(rule(bad));
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ path: 'rules[0].all[0].value', code: 'TRADE.POLICY.EXPRESSION_INVALID' }),
    );
  });

  it('compares money exactly beyond double precision', async () => {
    const defId = await newDefinition('policy');
    const id = await newVersion('policy', defId, FUTURE, {
      content: rule('9007199254740993.00000001'),
      testCases: [
        { code: 'ABOVE', facts: { totalAmount: '9007199254740993.00000002' }, expectedOutcome: 'REQUIRE_APPROVAL', expectedRuleCode: 'RULE_A' },
        { code: 'EQUAL', facts: { totalAmount: '9007199254740993.00000001' }, expectedOutcome: 'ALLOW' },
      ],
    });
    await settle(runAction('policy', id, 'validate'));
    const result = (await settle(runAction('policy', id, 'test'))) as PolicyTestResult;
    expect(result.passed).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../shared/trade-api';
import { FAKE_COLLEAGUE, FAKE_ME, setFakeActor } from './governance-fake-actors';
import { createDefinition, createVersion, deleteVersion, getDefinition, getVersion, runAction } from './policy.api';
import { resetFakePolicyStore, setFakeGovernedScopeTarget } from './policy.fake';
import type {
  GovernedDomain,
  GovernedVersionRecord,
  PolicyContent,
  PolicyTestCase,
  WorkflowContent,
  WorkflowTestCase,
} from './policy.model';

/**
 * Supersession for POLICY and WORKFLOW as policy-governance.ts supersedeGovernedVersion does it:
 * an immediate publish cuts the predecessor at now and marks it SUPERSEDED; a scheduled publish only
 * reserves the cut (supersededAt = the successor start) and activation marks it SUPERSEDED later.
 * A replaced version applies until COALESCE(supersededAt, effectiveTo).
 */

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
const DEC_1 = '2026-12-01T00:00:00.000Z';
const DEC_10 = '2026-12-10T00:00:00.000Z';
const JAN_1 = '2027-01-01T00:00:00.000Z';
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
  ],
  defaultOutcome: 'ALLOW',
};
const POLICY_CASES: PolicyTestCase[] = [
  { code: 'LARGE', facts: { totalAmount: 5000 }, expectedOutcome: 'REQUIRE_APPROVAL', expectedRuleCode: 'BIG_ORDER' },
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

// Each test starts from the seed, in the TENANT context, so no seeded live version overlaps.
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

describe.each<GovernedDomain>(['policy', 'workflow'])('%s supersession rules', (domain) => {
  const retireCode = domain === 'policy' ? 'NO_LONGER_NEEDED' : 'REPLACED';

  async function newDefinition(): Promise<string> {
    seq += 1;
    const def = await settle(
      createDefinition(
        domain,
        domain === 'policy'
          ? { code: `SUP_POLICY_${seq}`, policyKind: 'PRICING_GUARD', scopeTarget: 'TENANT' }
          : { code: `SUP_WORKFLOW_${seq}`, workflowKind: 'PURCHASE_ORDER', scopeTarget: 'TENANT' },
      ),
    );
    return def.id;
  }

  async function newVersion(defId: string, from: string, to: string | null = null): Promise<string> {
    setFakeActor(FAKE_ME);
    const record = await settle(
      createVersion<PolicyContent | WorkflowContent, PolicyTestCase | WorkflowTestCase>(domain, defId, {
        content: domain === 'policy' ? POLICY_CONTENT : WORKFLOW_CONTENT,
        testCases: domain === 'policy' ? POLICY_CASES : WORKFLOW_CASES,
        effectiveFrom: from,
        effectiveTo: to,
      }),
    );
    return record.id;
  }

  /** Draft -> validated -> tested -> submitted (maker) -> approved (colleague). Leaves the colleague acting. */
  async function approvedVersion(defId: string, from: string, to: string | null = null): Promise<string> {
    const id = await newVersion(defId, from, to);
    await settle(runAction(domain, id, 'validate'));
    await settle(runAction(domain, id, 'test'));
    await settle(runAction(domain, id, 'submit'));
    setFakeActor(FAKE_COLLEAGUE);
    await settle(runAction(domain, id, 'approve'));
    return id;
  }

  async function publishNew(defId: string, from: string, to: string | null = null, supersedes: string | null = null) {
    const id = await approvedVersion(defId, from, to);
    await settle(runAction(domain, id, 'publish', supersedes ? { supersedesVersionId: supersedes } : {}));
    setFakeActor(FAKE_ME);
    return id;
  }

  describe('immediate publish (the successor has started)', () => {
    const ENDED = '2026-11-15T00:00:00.000Z';

    it('cuts the predecessor at now, marks it SUPERSEDED and keeps effectiveTo', async () => {
      const defId = await newDefinition();
      const oldId = await publishNew(defId, PAST, JAN_1);

      const newId = await publishNew(defId, '2026-11-10T00:00:00.000Z', null, oldId);
      const old = await settle(getVersion(domain, oldId));
      const successor = await settle(getVersion(domain, newId));

      expect(successor.status).toBe('PUBLISHED');
      expect(old.status).toBe('SUPERSEDED');
      // Cut at the publish moment (now, after the fake delays), not at the successor start.
      expect(Date.parse(old.supersededAt!)).toBeGreaterThanOrEqual(Date.parse(NOW));
      expect(Date.parse(old.supersededAt!)).toBeLessThanOrEqual(Date.now());
      expect(old.supersededByVersionId).toBe(newId);
      expect(old.effectiveTo).toBe(JAN_1);
    });

    it('adjacent end: the authored effectiveTo becomes supersededAt and links the successor', async () => {
      const defId = await newDefinition();
      const oldId = await publishNew(defId, PAST, ENDED);

      const newId = await publishNew(defId, ENDED, null, oldId);
      const old = await settle(getVersion(domain, oldId));

      expect(old.status).toBe('SUPERSEDED');
      expect(old.supersededAt).toBe(ENDED);
      expect(old.supersededByVersionId).toBe(newId);
      expect(old.effectiveTo).toBe(ENDED);
    });

    it('gap: leaves supersededAt and supersededByVersionId null and keeps effectiveTo', async () => {
      const defId = await newDefinition();
      const oldId = await publishNew(defId, PAST, ENDED);

      await publishNew(defId, '2026-11-18T00:00:00.000Z', null, oldId);
      const old = await settle(getVersion(domain, oldId));

      expect(old.status).toBe('SUPERSEDED');
      expect(old.supersededAt).toBeNull();
      expect(old.supersededByVersionId).toBeNull();
      expect(old.effectiveTo).toBe(ENDED);
    });
  });

  describe('scheduled publish (the successor starts later)', () => {
    it('reserves the cut at the successor start and keeps the predecessor PUBLISHED', async () => {
      const defId = await newDefinition();
      const oldId = await publishNew(defId, PAST, JAN_1);

      const newId = await publishNew(defId, DEC_1, DEC_10, oldId);
      const def = await settle(getDefinition(domain, defId));
      const old = def.versions.find((v) => v.id === oldId);

      expect(def.versions.find((v) => v.id === newId)?.status).toBe('SCHEDULED');
      expect(old?.status).toBe('PUBLISHED');
      expect(old?.supersededAt).toBe(DEC_1);
      expect(old?.supersededByVersionId).toBe(newId);
      expect(old?.effectiveTo).toBe(JAN_1);
    });

    it('marks the predecessor SUPERSEDED when activation publishes the successor', async () => {
      const defId = await newDefinition();
      const oldId = await publishNew(defId, PAST);
      const newId = await publishNew(defId, DEC_1, null, oldId);

      vi.setSystemTime(new Date('2026-12-02T00:00:00.000Z'));
      const def = await settle(getDefinition(domain, defId));

      expect(def.versions.find((v) => v.id === newId)?.status).toBe('PUBLISHED');
      expect(def.versions.find((v) => v.id === oldId)?.status).toBe('SUPERSEDED');
      expect(def.versions.find((v) => v.id === oldId)?.supersededAt).toBe(DEC_1);
    });

    it('refuses a predecessor whose authored end is before the successor start (invalid_predecessor)', async () => {
      const defId = await newDefinition();
      const oldId = await publishNew(defId, PAST, DEC_1);

      const id = await approvedVersion(defId, DEC_10);
      const error = await rejection(runAction(domain, id, 'publish', { supersedesVersionId: oldId }));

      expect(error.status).toBe(409);
      expect(error.code).toBe('TRADE.POLICY.PUBLISH_NOT_ALLOWED');
      expect(error.details?.['reason']).toEqual(['invalid_predecessor']);
    });
  });

  it('rejects a window inside the replaced version before supersededAt (EFFECTIVE_OVERLAP)', async () => {
    const defId = await newDefinition();
    const oldId = await publishNew(defId, PAST);
    await publishNew(defId, DEC_1, DEC_10, oldId);

    const id = await approvedVersion(defId, '2026-11-25T00:00:00.000Z', '2026-11-28T00:00:00.000Z');
    const error = await rejection(runAction(domain, id, 'publish'));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.POLICY.EFFECTIVE_OVERLAP');
  });

  it('accepts a window after supersededAt even though the old effectiveTo is later', async () => {
    const defId = await newDefinition();
    const oldId = await publishNew(defId, PAST, JAN_1);
    await publishNew(defId, DEC_1, DEC_10, oldId);

    const id = await approvedVersion(defId, '2026-12-15T00:00:00.000Z', '2026-12-20T00:00:00.000Z');
    const record = (await settle(runAction(domain, id, 'publish'))) as GovernedVersionRecord;

    expect(record.status).toBe('SCHEDULED');
  });

  it('rejects an overlap with a live version that was not named as replaced', async () => {
    const defId = await newDefinition();
    await publishNew(defId, PAST);

    const id = await approvedVersion(defId, DEC_1);
    const error = await rejection(runAction(domain, id, 'publish'));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.POLICY.EFFECTIVE_OVERLAP');
  });

  it('refuses to supersede an already replaced target (invalid_predecessor)', async () => {
    const defId = await newDefinition();
    const oldId = await publishNew(defId, PAST);
    await publishNew(defId, DEC_1, null, oldId);

    const id = await approvedVersion(defId, JAN_1);
    const error = await rejection(runAction(domain, id, 'publish', { supersedesVersionId: oldId }));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.POLICY.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['invalid_predecessor']);
  });

  it.each([
    ['the same moment as', PAST],
    ['earlier than', '2026-10-15T00:00:00.000Z'],
  ])('refuses a successor starting %s the target (invalid_predecessor)', async (_label, from) => {
    const defId = await newDefinition();
    const oldId = await publishNew(defId, PAST);

    const id = await approvedVersion(defId, from);
    const error = await rejection(runAction(domain, id, 'publish', { supersedesVersionId: oldId }));
    const old = await settle(getVersion(domain, oldId));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.POLICY.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['invalid_predecessor']);
    expect(old.status).toBe('PUBLISHED');
    expect(old.supersededAt).toBeNull();
  });

  it('refuses to retire a successor a predecessor is linked to (linked_successor)', async () => {
    const defId = await newDefinition();
    const oldId = await publishNew(defId, PAST);
    const newId = await publishNew(defId, DEC_1, null, oldId);
    const successor = await settle(getVersion(domain, newId));

    const error = await rejection(runAction(domain, newId, 'retire', { reasonCode: retireCode }, successor.version));

    expect(error.status).toBe(409);
    expect(error.details?.['reason']).toEqual(['linked_successor']);
  });

  it('deletes the latest version when it is a never-published draft', async () => {
    const defId = await newDefinition();
    await publishNew(defId, PAST);
    const draft = await newVersion(defId, DEC_1);

    const result = await settle(deleteVersion(domain, draft));
    const def = await settle(getDefinition(domain, defId));

    expect(result).toEqual({ id: draft, deleted: true });
    expect(def.versions.some((v) => v.id === draft)).toBe(false);
  });

  // Backend rule: any never-published DRAFT/REJECTED may be deleted. Offering Delete only on the
  // latest version (brief g1) is a UI choice, not an API rule.
  it('deletes a draft that is not the latest version (backend allows it)', async () => {
    const defId = await newDefinition();
    const older = await newVersion(defId, DEC_1);
    const newer = await newVersion(defId, JAN_1);

    await settle(deleteVersion(domain, older));
    const def = await settle(getDefinition(domain, defId));

    expect(def.versions.map((v) => v.id)).toEqual([newer]);
  });

  it('refuses to delete a published version (not_deletable)', async () => {
    const defId = await newDefinition();
    const live = await publishNew(defId, PAST);
    const detail = await settle(getVersion(domain, live));

    const error = await rejection(deleteVersion(domain, live, detail.version));

    expect(error.status).toBe(409);
    expect(error.code).toBe('TRADE.POLICY.PUBLISH_NOT_ALLOWED');
    expect(error.details?.['reason']).toEqual(['not_deletable']);
  });

  it('accepts a 500-character reasonNote and rejects 501 with 400', async () => {
    const defId = await newDefinition();
    const a = await publishNew(defId, PAST);
    setFakeActor(FAKE_COLLEAGUE);

    const tooLong = await rejection(runAction(domain, a, 'retire', { reasonCode: retireCode, reasonNote: 'x'.repeat(501) }));
    const ok = (await settle(
      runAction(domain, a, 'retire', { reasonCode: retireCode, reasonNote: 'x'.repeat(500) }),
    )) as GovernedVersionRecord;

    expect(tooLong.status).toBe(400);
    expect(tooLong.code).toBe('TRADE.VALIDATION_FAILED');
    expect(ok.status).toBe('RETIRED');
  });
});

import { ApiError, fakeDelay, fakeId } from '../shared/trade-api';
import { clone, nowIso } from '../shared/trade-foundation.fake';
import {
  FAKE_COLLEAGUE,
  FAKE_ME,
  actorDisplayName,
  checkIfMatch,
  computeHash,
  fakeIdem,
  getFakeActor,
  normalizeWriteOpts,
  setFakeActor,
  type WriteOptions,
} from './governance-fake-actors';
import type {
  CreateDefinitionInput,
  CreateGovernedVersionInput,
  DecisionReceipt,
  DefinitionCountsQuery,
  DefinitionStatus,
  GovernedAction,
  GovernedActionBody,
  GovernedActionEntry,
  GovernedCounts,
  GovernedDefinition,
  GovernedDefinitionRecord,
  GovernedDeleteResult,
  GovernedDomain,
  GovernedList,
  GovernedStatus,
  GovernedValidateResult,
  GovernedVersion,
  GovernedVersionDetail,
  GovernedVersionRecord,
  ListDefinitionsQuery,
  PolicyCondition,
  PolicyContent,
  PolicyMetadata,
  PolicyRule,
  PolicyTestCase,
  PolicyTestCaseResult,
  PolicyTestResult,
  ScopeTarget,
  UpdateGovernedVersionInput,
  ValidateDiagnostic,
  WorkflowContent,
  WorkflowTestCase,
  WorkflowTestCaseResult,
  WorkflowTestResult,
} from './policy.model';
import {
  ACTIVE_POLICY_KINDS,
  ACTIVE_WORKFLOW_KINDS,
  CODE_PATTERN,
  FACTS,
  FACTS_BY_KIND,
  OUTCOMES,
  POLICY_KINDS,
  PURCHASE_ORDER_WORKFLOW_SHAPE,
  REASON_CODE,
  REGISTRY_VERSION,
  RULE_CODE,
  WORKFLOW_ACTIONS,
  WORKFLOW_KINDS,
  compareDecimal,
  isDecimalString,
  isMoneyFact,
  operatorsFor,
  type PolicyKind,
  type WorkflowAction,
  type WorkflowKind,
} from './policy.registry';
import type { GovernanceAuditEntry } from './pricing.model';
import { type GovernanceReasonKind, validateGovernanceReason } from './governance-reasons.seed';

export { getFakeActor, setFakeActor };

const idem = fakeIdem();

// The fake operating context (the backend reads it from the request). Tests may switch it.
const FAKE_COMPANY_ID = '0193a000-0000-7000-8000-00000000c001';
const FAKE_BRANCH_ID = '0193a000-0000-7000-8000-00000000b001';
let fakeScopeTarget: ScopeTarget = 'COMPANY';

export function setFakeGovernedScopeTarget(target: ScopeTarget): void {
  fakeScopeTarget = target;
}

// Every not-found in policy-studio is TRADE.POLICY.DEFINITION_NOT_FOUND, workflows included.
const NOT_FOUND = 'TRADE.POLICY.DEFINITION_NOT_FOUND';
const PUBLISH_NOT_ALLOWED = 'TRADE.POLICY.PUBLISH_NOT_ALLOWED';

function publishNotAllowed(reason: string): ApiError {
  return new ApiError(409, PUBLISH_NOT_ALLOWED, { reason: [reason] });
}

// ---------------------------------------------------------------------------
// Seed shapes (authoring convenience) and the stored shapes the fake works on
// ---------------------------------------------------------------------------

interface SeedEvidence {
  validatedAt: string | null;
  validatedContentHash: string | null;
  testedAt: string | null;
  testPassed: boolean | null;
}

interface SeedVersion {
  id: string;
  domain: GovernedDomain;
  definitionId: string;
  versionNumber: number;
  version: number;
  status: GovernedStatus;
  contentHash: string;
  registryVersion: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  publishedAt: string | null;
  retiredAt: string | null;
  supersededByVersionId: string | null;
  supersededAt?: string | null;
  restoredFromVersionId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  everPublished: boolean;
  content: PolicyContent | WorkflowContent;
  testCases: (PolicyTestCase | WorkflowTestCase)[];
  evidence: SeedEvidence;
  actions: GovernanceAuditEntry[];
}

interface SeedDefinition {
  id: string;
  domain: GovernedDomain;
  code: string;
  kind: string;
  scopeTarget: ScopeTarget;
  status: DefinitionStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface StoredEvidence {
  type: 'VALIDATION' | 'TEST';
  passed: boolean;
  contentHash: string;
  recordedAt: string;
  cases?: (PolicyTestCaseResult | WorkflowTestCaseResult)[];
}

interface StoredAction extends GovernedActionEntry {
  evidence?: Record<string, unknown>;
}

interface StoredVersionRecord {
  id: string;
  domain: GovernedDomain;
  definitionId: string;
  versionNumber: number;
  version: number;
  status: GovernedStatus;
  contentHash: string;
  registryVersion: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  supersededAt: string | null;
  supersededByVersionId: string | null;
  createdBy: string | null;
  submittedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  restoredFromVersionId: string | null;
  updatedBy: string | null;
  updatedAt: string;
  content: PolicyContent | WorkflowContent;
  testCases: (PolicyTestCase | WorkflowTestCase)[];
  evidence: StoredEvidence[];
  actions: StoredAction[];
}

interface StoredDefinitionRecord extends SeedDefinition {
  createdBy: string | null;
  updatedBy: string | null;
}

/** Backend hashGovernedContent: content, tests and the authored range. */
function hashGoverned(content: unknown, tests: unknown, from: string, to: string | null): string {
  return computeHash({ content, tests, from: new Date(from).toISOString(), to: to ? new Date(to).toISOString() : null });
}

function makePolicyHash(content: PolicyContent): string {
  return computeHash(content);
}

function makeWorkflowHash(content: WorkflowContent): string {
  return computeHash(content);
}

function fromSeedVersion(seed: SeedVersion): StoredVersionRecord {
  const contentHash = hashGoverned(seed.content, seed.testCases, seed.effectiveFrom, seed.effectiveTo);
  const evidence: StoredEvidence[] = [];
  if (seed.evidence.validatedAt && seed.evidence.validatedContentHash === seed.contentHash) {
    evidence.push({ type: 'VALIDATION', passed: true, contentHash, recordedAt: seed.evidence.validatedAt });
  }
  if (seed.evidence.testedAt && seed.evidence.testPassed !== null) {
    evidence.push({ type: 'TEST', passed: seed.evidence.testPassed, contentHash, recordedAt: seed.evidence.testedAt, cases: [] });
  }
  return {
    id: seed.id,
    domain: seed.domain,
    definitionId: seed.definitionId,
    versionNumber: seed.versionNumber,
    version: seed.version,
    status: seed.status,
    contentHash,
    registryVersion: seed.registryVersion,
    effectiveFrom: seed.effectiveFrom,
    effectiveTo: seed.effectiveTo,
    supersededAt: seed.supersededAt ?? null,
    supersededByVersionId: seed.supersededByVersionId,
    createdBy: seed.createdBy,
    submittedBy: seed.submittedBy,
    approvedBy: seed.approvedBy,
    approvedAt: seed.approvedAt,
    restoredFromVersionId: seed.restoredFromVersionId,
    updatedBy: seed.createdBy,
    updatedAt: seed.updatedAt,
    content: seed.content,
    testCases: seed.testCases,
    evidence,
    // The backend audits governance actions only; drafting is not an action.
    actions: seed.actions
      .filter((entry) => entry.action !== 'CREATE_VERSION')
      .map((entry) => ({
        action: entry.action,
        actorUserId: entry.actorUserId,
        actorDisplayName: entry.actorDisplayName,
        reasonCode: entry.reasonCode ?? null,
        reasonNameEn: entry.reasonNameEn ?? null,
        reasonNameAr: entry.reasonNameAr ?? null,
        reasonNote: entry.reason,
        occurredAt: entry.occurredAt,
      })),
  };
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

function buildSeedPolicyState(): {
  definitions: SeedDefinition[];
  versions: SeedVersion[];
  decisions: DecisionReceipt[];
} {
  const definitions: SeedDefinition[] = [
    {
      id: 'pol-def-pricing-guard',
      domain: 'policy',
      code: 'DEFAULT_PRICING_GUARD',
      kind: 'PRICING_GUARD',
      scopeTarget: 'COMPANY',
      status: 'ACTIVE',
      version: 2,
      createdAt: '2026-06-01T08:00:00.000Z',
      updatedAt: '2026-11-18T12:00:00.000Z',
    },
    {
      id: 'pol-def-order-confirm',
      domain: 'policy',
      code: 'DEFAULT_ORDER_CONFIRMATION',
      kind: 'ORDER_CONFIRMATION',
      scopeTarget: 'COMPANY',
      status: 'ACTIVE',
      version: 1,
      createdAt: '2026-05-15T08:00:00.000Z',
      updatedAt: '2026-06-01T08:00:00.000Z',
    },
    {
      id: 'pol-def-purchase-approval',
      domain: 'policy',
      code: 'DEFAULT_PURCHASE_APPROVAL',
      kind: 'PURCHASE_APPROVAL',
      scopeTarget: 'COMPANY',
      status: 'ACTIVE',
      version: 2,
      createdAt: '2026-04-01T08:00:00.000Z',
      updatedAt: '2026-11-19T10:00:00.000Z',
    },
    {
      id: 'wf-def-purchase-order',
      domain: 'workflow',
      code: 'DEFAULT_PURCHASE_ORDER',
      kind: 'PURCHASE_ORDER',
      scopeTarget: 'COMPANY',
      status: 'ACTIVE',
      version: 2,
      createdAt: '2026-03-01T08:00:00.000Z',
      updatedAt: '2026-11-20T09:00:00.000Z',
    },
  ];

  const pricingGuardContentV2: PolicyContent = {
    rules: [
      {
        code: 'DISCOUNT_OVER_15',
        priority: 10,
        all: [{ fact: 'discountPercent', operator: 'GT', value: 15 }],
        outcome: 'REQUIRE_APPROVAL',
        reasonCode: 'DISCOUNT_APPROVAL',
      },
      {
        code: 'BLOCKED_ACCOUNT',
        priority: 20,
        all: [{ fact: 'accountStatus', operator: 'EQ', value: 'SUSPENDED' }],
        outcome: 'DENY',
        reasonCode: 'ACCOUNT_BLOCKED',
      },
    ],
    defaultOutcome: 'ALLOW',
  };

  const pricingGuardContentV3: PolicyContent = {
    rules: [
      {
        code: 'DISCOUNT_OVER_10',
        priority: 10,
        all: [
          { fact: 'discountPercent', operator: 'GT', value: 10 },
          { fact: 'actorHasOverride', operator: 'EQ', value: false },
        ],
        outcome: 'REQUIRE_APPROVAL',
        reasonCode: 'DISCOUNT_APPROVAL',
      },
      {
        code: 'BLOCKED_ACCOUNT',
        priority: 20,
        all: [{ fact: 'accountStatus', operator: 'EQ', value: 'SUSPENDED' }],
        outcome: 'DENY',
        reasonCode: 'ACCOUNT_BLOCKED',
      },
    ],
    defaultOutcome: 'ALLOW',
  };

  const pricingGuardTests: PolicyTestCase[] = [
    {
      code: 'HIGH_DISCOUNT_NO_OVERRIDE',
      facts: { discountPercent: 12, actorHasOverride: false, accountStatus: 'ACTIVE' },
      expectedOutcome: 'REQUIRE_APPROVAL',
      expectedRuleCode: 'DISCOUNT_OVER_10',
    },
    {
      code: 'HIGH_DISCOUNT_WITH_OVERRIDE',
      facts: { discountPercent: 12, actorHasOverride: true, accountStatus: 'ACTIVE' },
      expectedOutcome: 'ALLOW',
      expectedRuleCode: null,
    },
    {
      code: 'SUSPENDED_ACCOUNT_DENIED',
      facts: { discountPercent: 0, actorHasOverride: false, accountStatus: 'SUSPENDED' },
      expectedOutcome: 'DENY',
      expectedRuleCode: 'BLOCKED_ACCOUNT',
    },
    {
      code: 'STANDARD_ORDER_ALLOWED',
      facts: { discountPercent: 5, actorHasOverride: false, accountStatus: 'ACTIVE' },
      expectedOutcome: 'ALLOW',
      expectedRuleCode: null,
    },
  ];

  const orderConfirmContent: PolicyContent = {
    rules: [
      {
        code: 'CREDIT_BLOCK_GUARD',
        priority: 10,
        all: [{ fact: 'creditBlocked', operator: 'EQ', value: true }],
        outcome: 'DENY',
        reasonCode: 'CREDIT_BLOCKED',
      },
      {
        code: 'HIGH_VALUE_ORDER',
        priority: 20,
        all: [{ fact: 'totalAmount', operator: 'GTE', value: '100000' }],
        outcome: 'REQUIRE_APPROVAL',
        reasonCode: 'HIGH_VALUE_APPROVAL',
      },
    ],
    defaultOutcome: 'ALLOW',
  };

  const purchaseApprovalContentV1: PolicyContent = {
    rules: [
      {
        code: 'PO_OVER_50K',
        priority: 10,
        all: [{ fact: 'totalAmount', operator: 'GT', value: '50000' }],
        outcome: 'REQUIRE_APPROVAL',
        reasonCode: 'PO_FINANCE_REVIEW',
      },
    ],
    defaultOutcome: 'ALLOW',
  };

  const purchaseApprovalContentV2: PolicyContent = {
    rules: [
      {
        code: 'PO_OVER_25K',
        priority: 10,
        all: [
          { fact: 'totalAmount', operator: 'GT', value: '25000' },
          { fact: 'actorHasOverride', operator: 'EQ', value: false },
        ],
        outcome: 'REQUIRE_APPROVAL',
        reasonCode: 'PO_FINANCE_REVIEW',
      },
      {
        code: 'INACTIVE_SUPPLIER',
        priority: 20,
        all: [{ fact: 'accountStatus', operator: 'EQ', value: 'BLOCKED' }],
        outcome: 'DENY',
        reasonCode: 'SUPPLIER_BLOCKED',
      },
    ],
    defaultOutcome: 'ALLOW',
  };

  const poWorkflowShape: WorkflowContent = {
    states: [...PURCHASE_ORDER_WORKFLOW_SHAPE.states],
    initialState: PURCHASE_ORDER_WORKFLOW_SHAPE.initialState,
    terminalStates: [...PURCHASE_ORDER_WORKFLOW_SHAPE.terminalStates],
    transitions: PURCHASE_ORDER_WORKFLOW_SHAPE.transitions.map((t) => ({ ...t })),
  };

  const poWorkflowTests: WorkflowTestCase[] = [
    { code: 'HAPPY_APPROVAL', startState: 'PENDING', actions: ['APPROVE'], expectedState: 'APPROVED' },
    { code: 'REJECT_PATH', startState: 'PENDING', actions: ['REJECT'], expectedState: 'REJECTED' },
    { code: 'WITHDRAW_PATH', startState: 'PENDING', actions: ['WITHDRAW'], expectedState: 'WITHDRAWN' },
  ];

  const versions: SeedVersion[] = [
    {
      id: 'pol-ver-pg-2',
      domain: 'policy',
      definitionId: 'pol-def-pricing-guard',
      versionNumber: 2,
      version: 4,
      status: 'PUBLISHED',
      contentHash: makePolicyHash(pricingGuardContentV2),
      registryVersion: REGISTRY_VERSION,
      effectiveFrom: '2026-07-01T00:00:00.000Z',
      effectiveTo: null,
      submittedBy: FAKE_COLLEAGUE,
      submittedAt: '2026-06-25T10:00:00.000Z',
      approvedBy: FAKE_ME,
      approvedAt: '2026-06-26T10:00:00.000Z',
      rejectedBy: null,
      rejectedAt: null,
      publishedAt: '2026-07-01T00:00:00.000Z',
      retiredAt: null,
      supersededByVersionId: null,
      restoredFromVersionId: null,
      createdBy: FAKE_COLLEAGUE,
      createdAt: '2026-06-20T08:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
      everPublished: true,
      content: pricingGuardContentV2,
      testCases: [pricingGuardTests[2], pricingGuardTests[3]],
      evidence: {
        validatedAt: '2026-06-24T09:00:00.000Z',
        validatedContentHash: makePolicyHash(pricingGuardContentV2),
        testedAt: '2026-06-24T10:00:00.000Z',
        testPassed: true,
      },
      actions: [
        {
          id: 'aud-pg2-1',
          resourceType: 'POLICY_VERSION',
          resourceId: 'pol-ver-pg-2',
          action: 'PUBLISH',
          actorUserId: FAKE_ME,
          actorDisplayName: actorDisplayName(FAKE_ME),
          reason: null,
          occurredAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    },
    {
      id: 'pol-ver-pg-3',
      domain: 'policy',
      definitionId: 'pol-def-pricing-guard',
      versionNumber: 3,
      version: 1,
      status: 'DRAFT',
      contentHash: makePolicyHash(pricingGuardContentV3),
      registryVersion: REGISTRY_VERSION,
      effectiveFrom: '2026-12-01T00:00:00.000Z',
      effectiveTo: null,
      submittedBy: null,
      submittedAt: null,
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      publishedAt: null,
      retiredAt: null,
      supersededByVersionId: null,
      restoredFromVersionId: null,
      createdBy: FAKE_ME,
      createdAt: '2026-11-18T12:00:00.000Z',
      updatedAt: '2026-11-18T12:00:00.000Z',
      everPublished: false,
      content: pricingGuardContentV3,
      testCases: pricingGuardTests,
      evidence: {
        validatedAt: null,
        validatedContentHash: null,
        testedAt: null,
        testPassed: null,
      },
      actions: [
        {
          id: 'aud-pg3-1',
          resourceType: 'POLICY_VERSION',
          resourceId: 'pol-ver-pg-3',
          action: 'CREATE_VERSION',
          actorUserId: FAKE_ME,
          actorDisplayName: actorDisplayName(FAKE_ME),
          reason: null,
          occurredAt: '2026-11-18T12:00:00.000Z',
        },
      ],
    },
    {
      id: 'pol-ver-oc-1',
      domain: 'policy',
      definitionId: 'pol-def-order-confirm',
      versionNumber: 1,
      version: 4,
      status: 'PUBLISHED',
      contentHash: makePolicyHash(orderConfirmContent),
      registryVersion: REGISTRY_VERSION,
      effectiveFrom: '2026-06-01T00:00:00.000Z',
      effectiveTo: null,
      submittedBy: FAKE_COLLEAGUE,
      submittedAt: '2026-05-25T10:00:00.000Z',
      approvedBy: FAKE_ME,
      approvedAt: '2026-05-26T10:00:00.000Z',
      rejectedBy: null,
      rejectedAt: null,
      publishedAt: '2026-06-01T00:00:00.000Z',
      retiredAt: null,
      supersededByVersionId: null,
      restoredFromVersionId: null,
      createdBy: FAKE_COLLEAGUE,
      createdAt: '2026-05-20T08:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
      everPublished: true,
      content: orderConfirmContent,
      testCases: [
        {
          code: 'CREDIT_BLOCKED_DENIED',
          facts: { creditBlocked: true, totalAmount: '5000' },
          expectedOutcome: 'DENY',
          expectedRuleCode: 'CREDIT_BLOCK_GUARD',
        },
      ],
      evidence: {
        validatedAt: '2026-05-24T09:00:00.000Z',
        validatedContentHash: makePolicyHash(orderConfirmContent),
        testedAt: '2026-05-24T10:00:00.000Z',
        testPassed: true,
      },
      actions: [
        {
          id: 'aud-oc1-1',
          resourceType: 'POLICY_VERSION',
          resourceId: 'pol-ver-oc-1',
          action: 'PUBLISH',
          actorUserId: FAKE_ME,
          actorDisplayName: actorDisplayName(FAKE_ME),
          reason: null,
          occurredAt: '2026-06-01T00:00:00.000Z',
        },
      ],
    },
    {
      id: 'pol-ver-pa-1',
      domain: 'policy',
      definitionId: 'pol-def-purchase-approval',
      versionNumber: 1,
      version: 4,
      status: 'PUBLISHED',
      contentHash: makePolicyHash(purchaseApprovalContentV1),
      registryVersion: REGISTRY_VERSION,
      effectiveFrom: '2026-04-15T00:00:00.000Z',
      effectiveTo: null,
      submittedBy: FAKE_COLLEAGUE,
      submittedAt: '2026-04-10T10:00:00.000Z',
      approvedBy: FAKE_ME,
      approvedAt: '2026-04-11T10:00:00.000Z',
      rejectedBy: null,
      rejectedAt: null,
      publishedAt: '2026-04-15T00:00:00.000Z',
      retiredAt: null,
      supersededByVersionId: null,
      restoredFromVersionId: null,
      createdBy: FAKE_COLLEAGUE,
      createdAt: '2026-04-01T08:00:00.000Z',
      updatedAt: '2026-04-15T00:00:00.000Z',
      everPublished: true,
      content: purchaseApprovalContentV1,
      testCases: [
        {
          code: 'PO_ABOVE_50K',
          facts: { totalAmount: '75000' },
          expectedOutcome: 'REQUIRE_APPROVAL',
          expectedRuleCode: 'PO_OVER_50K',
        },
      ],
      evidence: {
        validatedAt: '2026-04-09T09:00:00.000Z',
        validatedContentHash: makePolicyHash(purchaseApprovalContentV1),
        testedAt: '2026-04-09T10:00:00.000Z',
        testPassed: true,
      },
      actions: [],
    },
    {
      id: 'pol-ver-pa-2',
      domain: 'policy',
      definitionId: 'pol-def-purchase-approval',
      versionNumber: 2,
      version: 3,
      status: 'APPROVAL_PENDING',
      contentHash: makePolicyHash(purchaseApprovalContentV2),
      registryVersion: REGISTRY_VERSION,
      effectiveFrom: '2026-12-01T00:00:00.000Z',
      effectiveTo: null,
      submittedBy: FAKE_COLLEAGUE,
      submittedAt: '2026-11-19T10:00:00.000Z',
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      publishedAt: null,
      retiredAt: null,
      supersededByVersionId: null,
      restoredFromVersionId: null,
      createdBy: FAKE_COLLEAGUE,
      createdAt: '2026-11-17T08:00:00.000Z',
      updatedAt: '2026-11-19T10:00:00.000Z',
      everPublished: false,
      content: purchaseApprovalContentV2,
      testCases: [
        {
          code: 'PO_ABOVE_25K',
          facts: { totalAmount: '30000', actorHasOverride: false, accountStatus: 'ACTIVE' },
          expectedOutcome: 'REQUIRE_APPROVAL',
          expectedRuleCode: 'PO_OVER_25K',
        },
      ],
      evidence: {
        validatedAt: '2026-11-18T09:00:00.000Z',
        validatedContentHash: makePolicyHash(purchaseApprovalContentV2),
        testedAt: '2026-11-18T11:00:00.000Z',
        testPassed: true,
      },
      actions: [
        {
          id: 'aud-pa2-1',
          resourceType: 'POLICY_VERSION',
          resourceId: 'pol-ver-pa-2',
          action: 'SUBMIT',
          actorUserId: FAKE_COLLEAGUE,
          actorDisplayName: actorDisplayName(FAKE_COLLEAGUE),
          reason: null,
          occurredAt: '2026-11-19T10:00:00.000Z',
        },
      ],
    },
    {
      id: 'wf-ver-po-1',
      domain: 'workflow',
      definitionId: 'wf-def-purchase-order',
      versionNumber: 1,
      version: 4,
      status: 'PUBLISHED',
      contentHash: makeWorkflowHash(poWorkflowShape),
      registryVersion: REGISTRY_VERSION,
      effectiveFrom: '2026-03-15T00:00:00.000Z',
      effectiveTo: null,
      submittedBy: FAKE_COLLEAGUE,
      submittedAt: '2026-03-10T10:00:00.000Z',
      approvedBy: FAKE_ME,
      approvedAt: '2026-03-11T10:00:00.000Z',
      rejectedBy: null,
      rejectedAt: null,
      publishedAt: '2026-03-15T00:00:00.000Z',
      retiredAt: null,
      supersededByVersionId: null,
      restoredFromVersionId: null,
      createdBy: FAKE_COLLEAGUE,
      createdAt: '2026-03-01T08:00:00.000Z',
      updatedAt: '2026-03-15T00:00:00.000Z',
      everPublished: true,
      content: clone(poWorkflowShape),
      testCases: clone(poWorkflowTests),
      evidence: {
        validatedAt: '2026-03-08T09:00:00.000Z',
        validatedContentHash: makeWorkflowHash(poWorkflowShape),
        testedAt: '2026-03-09T10:00:00.000Z',
        testPassed: true,
      },
      actions: [
        {
          id: 'aud-wf1-1',
          resourceType: 'WORKFLOW_VERSION',
          resourceId: 'wf-ver-po-1',
          action: 'PUBLISH',
          actorUserId: FAKE_ME,
          actorDisplayName: actorDisplayName(FAKE_ME),
          reason: null,
          occurredAt: '2026-03-15T00:00:00.000Z',
        },
      ],
    },
    {
      id: 'wf-ver-po-2',
      domain: 'workflow',
      definitionId: 'wf-def-purchase-order',
      versionNumber: 2,
      version: 3,
      status: 'APPROVAL_PENDING',
      contentHash: makeWorkflowHash(poWorkflowShape),
      registryVersion: REGISTRY_VERSION,
      effectiveFrom: '2026-12-01T00:00:00.000Z',
      effectiveTo: null,
      submittedBy: FAKE_COLLEAGUE,
      submittedAt: '2026-11-20T09:00:00.000Z',
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      publishedAt: null,
      retiredAt: null,
      supersededByVersionId: null,
      restoredFromVersionId: null,
      createdBy: FAKE_COLLEAGUE,
      createdAt: '2026-11-18T08:00:00.000Z',
      updatedAt: '2026-11-20T09:00:00.000Z',
      everPublished: false,
      content: clone(poWorkflowShape),
      testCases: clone(poWorkflowTests),
      evidence: {
        validatedAt: '2026-11-19T09:00:00.000Z',
        validatedContentHash: makeWorkflowHash(poWorkflowShape),
        testedAt: '2026-11-19T14:00:00.000Z',
        testPassed: true,
      },
      actions: [
        {
          id: 'aud-wf2-1',
          resourceType: 'WORKFLOW_VERSION',
          resourceId: 'wf-ver-po-2',
          action: 'SUBMIT',
          actorUserId: FAKE_COLLEAGUE,
          actorDisplayName: actorDisplayName(FAKE_COLLEAGUE),
          reason: null,
          occurredAt: '2026-11-20T09:00:00.000Z',
        },
      ],
    },
  ];

  const decisions: DecisionReceipt[] = [
    {
      id: 'dec-0001',
      decisionType: 'PRICING_GUARD',
      outcome: 'REQUIRE_APPROVAL',
      reasonCode: 'DISCOUNT_APPROVAL',
      explanationCode: 'RULE_MATCHED',
      selectedValue: null,
      matchedRuleCode: 'DISCOUNT_OVER_15',
      policyVersions: [
        {
          definitionId: 'pol-def-pricing-guard',
          definitionCode: 'DEFAULT_PRICING_GUARD',
          versionId: 'pol-ver-pg-2',
          versionNumber: 2,
          kind: 'PRICING_GUARD',
        },
      ],
      document: { aggregateType: 'QUOTATION', aggregateId: 'qt-2026-0142' },
      evaluatedAt: '2026-11-20T10:15:00.000Z',
      correlationId: 'corr-9a41e02a-01',
    },
    {
      id: 'dec-0002',
      decisionType: 'ORDER_CONFIRMATION',
      outcome: 'DENY',
      reasonCode: 'CREDIT_BLOCKED',
      explanationCode: 'RULE_MATCHED',
      selectedValue: null,
      matchedRuleCode: 'CREDIT_BLOCK_GUARD',
      policyVersions: [
        {
          definitionId: 'pol-def-order-confirm',
          definitionCode: 'DEFAULT_ORDER_CONFIRMATION',
          versionId: 'pol-ver-oc-1',
          versionNumber: 1,
          kind: 'ORDER_CONFIRMATION',
        },
      ],
      document: { aggregateType: 'SALES_ORDER', aggregateId: 'so-2026-0089' },
      evaluatedAt: '2026-11-20T11:30:00.000Z',
      correlationId: 'corr-9a41e02a-02',
    },
    {
      id: 'dec-0003',
      decisionType: 'PURCHASE_APPROVAL',
      outcome: 'REQUIRE_APPROVAL',
      reasonCode: 'PO_FINANCE_REVIEW',
      explanationCode: 'RULE_MATCHED',
      selectedValue: null,
      matchedRuleCode: 'PO_OVER_50K',
      policyVersions: [
        {
          definitionId: 'pol-def-purchase-approval',
          definitionCode: 'DEFAULT_PURCHASE_APPROVAL',
          versionId: 'pol-ver-pa-1',
          versionNumber: 1,
          kind: 'PURCHASE_APPROVAL',
        },
      ],
      document: { aggregateType: 'PURCHASE_ORDER', aggregateId: 'po-2026-0311' },
      evaluatedAt: '2026-11-21T08:45:00.000Z',
      correlationId: 'corr-9a41e02a-03',
    },
    {
      id: 'dec-0004',
      decisionType: 'PRICING_GUARD',
      outcome: 'ALLOW',
      reasonCode: 'DEFAULT_OUTCOME',
      explanationCode: 'NO_RULE_MATCHED',
      selectedValue: null,
      matchedRuleCode: null,
      policyVersions: [
        {
          definitionId: 'pol-def-pricing-guard',
          definitionCode: 'DEFAULT_PRICING_GUARD',
          versionId: 'pol-ver-pg-2',
          versionNumber: 2,
          kind: 'PRICING_GUARD',
        },
      ],
      document: { aggregateType: 'QUOTATION', aggregateId: 'qt-2026-0148' },
      evaluatedAt: '2026-11-21T09:12:00.000Z',
      correlationId: 'corr-9a41e02a-04',
    },
  ];

  return { definitions, versions, decisions };
}

function buildStore(): {
  definitions: StoredDefinitionRecord[];
  versions: StoredVersionRecord[];
  decisions: DecisionReceipt[];
} {
  const seed = buildSeedPolicyState();
  return {
    definitions: seed.definitions.map((def) => ({ ...def, createdBy: FAKE_COLLEAGUE, updatedBy: FAKE_COLLEAGUE })),
    versions: seed.versions.map(fromSeedVersion),
    decisions: seed.decisions,
  };
}

let DB = buildStore();

/** Test hook: a fresh seeded store and the default COMPANY context. */
export function resetFakePolicyStore(): void {
  DB = buildStore();
  fakeScopeTarget = 'COMPANY';
}

// ---------------------------------------------------------------------------
// Projection & domain helpers
// ---------------------------------------------------------------------------

/** GovernedVersionActivationService: a due SCHEDULED version of an ACTIVE definition goes live. */
function activateDueScheduled(): void {
  const nowMs = Date.now();
  const due = DB.versions
    .filter((v) => v.status === 'SCHEDULED' && Date.parse(v.effectiveFrom) <= nowMs)
    .sort((a, b) => Date.parse(a.effectiveFrom) - Date.parse(b.effectiveFrom) || a.id.localeCompare(b.id));
  for (const v of due) {
    const def = DB.definitions.find((d) => d.id === v.definitionId && d.domain === v.domain);
    if (!def || def.status !== 'ACTIVE') continue;
    const at = nowIso();
    for (const predecessor of DB.versions) {
      if (predecessor.supersededByVersionId === v.id && predecessor.status === 'PUBLISHED') {
        predecessor.status = 'SUPERSEDED';
        predecessor.updatedBy = null;
        predecessor.updatedAt = at;
        predecessor.version += 1;
      }
    }
    v.status = 'PUBLISHED';
    v.updatedBy = null;
    v.updatedAt = at;
    v.version += 1;
  }
}

function reasonKindFor(domain: GovernedDomain, action: 'reject' | 'retire' | 'rollback'): GovernanceReasonKind {
  if (domain === 'policy') {
    if (action === 'reject') return 'POLICY_VERSION_REJECT';
    if (action === 'retire') return 'POLICY_VERSION_RETIRE';
    return 'POLICY_VERSION_ROLLBACK';
  }
  if (action === 'reject') return 'WORKFLOW_VERSION_REJECT';
  if (action === 'retire') return 'WORKFLOW_VERSION_RETIRE';
  return 'WORKFLOW_VERSION_ROLLBACK';
}

function scopeIds(target: ScopeTarget): { companyId: string | null; branchId: string | null } {
  return {
    companyId: target === 'TENANT' ? null : FAKE_COMPANY_ID,
    branchId: target === 'BRANCH' ? FAKE_BRANCH_ID : null,
  };
}

/** projectGovernedVersion. */
function toVersionDto(v: StoredVersionRecord): GovernedVersion {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    version: v.version,
    status: v.status,
    contentHash: v.contentHash,
    registryVersion: v.registryVersion,
    effectiveFrom: v.effectiveFrom,
    effectiveTo: v.effectiveTo,
    supersededAt: v.supersededAt,
    supersededByVersionId: v.supersededByVersionId,
    createdBy: v.createdBy,
    submittedBy: v.submittedBy,
    approvedBy: v.approvedBy,
    approvedAt: v.approvedAt,
    restoredFromVersionId: v.restoredFromVersionId,
  };
}

/** The saved entity a write returns. */
function toVersionRecord(v: StoredVersionRecord): GovernedVersionRecord {
  return {
    ...toVersionDto(v),
    content: clone(v.content),
    testCases: clone(v.testCases),
    updatedBy: v.updatedBy,
    updatedAt: v.updatedAt,
    ...(v.domain === 'policy' ? { policyDefinitionId: v.definitionId } : { workflowDefinitionId: v.definitionId }),
  };
}

function toDefinitionRecord(def: StoredDefinitionRecord): GovernedDefinitionRecord {
  return {
    id: def.id,
    code: def.code,
    scopeTarget: def.scopeTarget,
    ...scopeIds(def.scopeTarget),
    companyScopeKey: def.scopeTarget === 'TENANT' ? 'none' : FAKE_COMPANY_ID,
    branchScopeKey: def.scopeTarget === 'BRANCH' ? FAKE_BRANCH_ID : 'none',
    status: def.status,
    version: def.version,
    createdBy: def.createdBy,
    updatedBy: def.updatedBy,
    createdAt: def.createdAt,
    updatedAt: def.updatedAt,
    ...(def.domain === 'policy' ? { policyKind: def.kind } : { workflowKind: def.kind }),
  };
}

function toDefinitionDto(def: StoredDefinitionRecord): GovernedDefinition {
  const versions = DB.versions
    .filter((v) => v.definitionId === def.id && v.domain === def.domain)
    .sort((a, b) => b.versionNumber - a.versionNumber)
    .map(toVersionDto);
  return { ...toDefinitionRecord(def), versions };
}

function latestEvidence(v: StoredVersionRecord, type: StoredEvidence['type']): StoredEvidence | null {
  return (
    v.evidence
      .filter((e) => e.type === type && e.contentHash === v.contentHash)
      .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))[0] ?? null
  );
}

function hasPassingEvidence(v: StoredVersionRecord, type: StoredEvidence['type']): boolean {
  return v.evidence.some((e) => e.type === type && e.contentHash === v.contentHash && e.passed);
}

/** getVersion: projection + content, definition ref, current evidence and actions. */
function toVersionDetailDto(v: StoredVersionRecord, def: StoredDefinitionRecord): GovernedVersionDetail {
  const validation = latestEvidence(v, 'VALIDATION');
  const test = latestEvidence(v, 'TEST');
  return {
    ...toVersionDto(v),
    content: clone(v.content),
    testCases: clone(v.testCases),
    definition: { id: def.id, code: def.code, kind: def.kind, scopeTarget: def.scopeTarget },
    evidence: {
      validation: validation
        ? { passed: validation.passed, contentHash: validation.contentHash, recordedAt: validation.recordedAt }
        : null,
      test: test
        ? { passed: test.passed, contentHash: test.contentHash, recordedAt: test.recordedAt, cases: clone(test.cases ?? []) }
        : null,
    },
    actions: v.actions.slice(0, 100).map(({ evidence: _evidence, ...entry }) => ({ ...entry })),
  };
}

function assertScope(def: StoredDefinitionRecord): void {
  if (def.scopeTarget !== fakeScopeTarget) {
    throw new ApiError(404, NOT_FOUND);
  }
}

function requireDef(domain: GovernedDomain, id: string): StoredDefinitionRecord {
  const def = DB.definitions.find((d) => d.id === id && d.domain === domain);
  if (!def) {
    throw new ApiError(404, NOT_FOUND);
  }
  assertScope(def);
  return def;
}

function requireVer(domain: GovernedDomain, id: string): { ver: StoredVersionRecord; def: StoredDefinitionRecord } {
  const ver = DB.versions.find((v) => v.id === id && v.domain === domain);
  if (!ver) {
    throw new ApiError(404, NOT_FOUND);
  }
  const def = requireDef(domain, ver.definitionId);
  return { ver, def };
}

function touch(v: StoredVersionRecord, actor: string | null, at: string): void {
  v.version += 1;
  v.updatedBy = actor;
  v.updatedAt = at;
}

/** saveActionEvidence: one append-only governance action row. */
function recordAction(
  v: StoredVersionRecord,
  action: string,
  body: GovernedActionBody = {},
  reasonMeta?: { code: string; nameEn: string; nameAr: string },
  evidence?: Record<string, unknown>,
): void {
  const actor = getFakeActor();
  v.actions.unshift({
    action: action.toUpperCase(),
    actorUserId: actor,
    actorDisplayName: actorDisplayName(actor),
    reasonCode: reasonMeta?.code ?? body.reasonCode ?? null,
    reasonNameEn: reasonMeta?.nameEn ?? null,
    reasonNameAr: reasonMeta?.nameAr ?? null,
    reasonNote: body.reasonNote ?? body.reason ?? null,
    occurredAt: nowIso(),
    evidence: { ...(body.evidence ?? {}), ...(evidence ?? {}) },
  });
}

/** assertReason + TradeReasonsService.assertUsableCode. */
function assertReason(domain: GovernedDomain, action: 'reject' | 'retire' | 'rollback', body: GovernedActionBody) {
  if (!body.reasonCode?.trim()) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED', { reasonCode: ['required'] });
  }
  const { reason } = validateGovernanceReason(reasonKindFor(domain, action), body.reasonCode, body.reasonNote ?? body.reason);
  return {
    code: reason.code,
    nameEn: reason.localizedNames['en'] ?? reason.code,
    nameAr: reason.localizedNames['ar'] ?? reason.code,
  };
}

/** Live range of a candidate: [effectiveFrom, COALESCE(supersededAt, effectiveTo, infinity)). */
function rangeEnd(v: Pick<StoredVersionRecord, 'supersededAt' | 'effectiveTo'>): number {
  const end = v.supersededAt ?? v.effectiveTo;
  return end ? Date.parse(end) : Number.POSITIVE_INFINITY;
}

/** governedOverlap: live versions of the same kind and exact scope (this definition, or any ACTIVE one). */
function governedOverlap(def: StoredDefinitionRecord, ver: StoredVersionRecord): boolean {
  const from = Date.parse(ver.effectiveFrom);
  const to = ver.effectiveTo ? Date.parse(ver.effectiveTo) : Number.POSITIVE_INFINITY;
  return DB.versions.some((candidate) => {
    if (candidate.domain !== ver.domain || candidate.id === ver.id) return false;
    if (candidate.status !== 'PUBLISHED' && candidate.status !== 'SCHEDULED') return false;
    const owner = DB.definitions.find((d) => d.id === candidate.definitionId && d.domain === candidate.domain);
    if (!owner || owner.kind !== def.kind || owner.scopeTarget !== def.scopeTarget) return false;
    if (owner.id !== def.id && owner.status !== 'ACTIVE') return false;
    return Date.parse(candidate.effectiveFrom) < to && rangeEnd(candidate) > from;
  });
}

/**
 * Mirrors common/governed-supersession.ts. `cutoff` is when the successor takes over; effectiveTo is never rewritten.
 * - open, or authored end after the cutoff: supersededAt = cutoff, linked to the successor;
 * - authored end at/before the cutoff and the successor started by that end: supersededAt = effectiveTo, linked;
 * - authored end before the successor starts (a gap): both fields stay null (DB-4 pairs them).
 */
export function governedSupersessionFields(
  effectiveTo: string | null,
  successor: { id: string; effectiveFrom: string },
  cutoff: string,
): { supersededAt: string | null; supersededByVersionId: string | null } {
  if (effectiveTo && Date.parse(effectiveTo) <= Date.parse(cutoff)) {
    if (Date.parse(effectiveTo) < Date.parse(successor.effectiveFrom)) {
      return { supersededAt: null, supersededByVersionId: null };
    }
    return { supersededAt: effectiveTo, supersededByVersionId: successor.id };
  }
  return { supersededAt: cutoff, supersededByVersionId: successor.id };
}

/** policy-governance.ts supersedeGovernedVersion. Returns the predecessor id when it became SUPERSEDED now. */
function supersedeGovernedVersion(
  def: StoredDefinitionRecord,
  successor: StoredVersionRecord,
  predecessorId: string,
  actor: string,
  now: string,
): string | undefined {
  const predecessor = DB.versions.find(
    (v) => v.id === predecessorId && v.definitionId === def.id && v.domain === successor.domain,
  );
  const nowMs = Date.parse(now);
  const successorFrom = Date.parse(successor.effectiveFrom);
  const immediate = successorFrom <= nowMs;
  const cutoff = immediate ? now : successor.effectiveFrom;
  const cutoffMs = Date.parse(cutoff);
  if (
    !predecessor ||
    predecessor.id === successor.id ||
    !['PUBLISHED', 'SCHEDULED'].includes(predecessor.status) ||
    predecessor.supersededAt ||
    Date.parse(predecessor.effectiveFrom) >= successorFrom ||
    Date.parse(predecessor.effectiveFrom) >= cutoffMs ||
    (!immediate && predecessor.effectiveTo && Date.parse(predecessor.effectiveTo) < cutoffMs)
  ) {
    throw publishNotAllowed('invalid_predecessor');
  }
  const fields = governedSupersessionFields(predecessor.effectiveTo, successor, cutoff);
  // SCHEDULED -> SUPERSEDED is forbidden by the lifecycle trigger: promote first.
  if (immediate && predecessor.status === 'SCHEDULED') {
    predecessor.status = 'PUBLISHED';
    touch(predecessor, actor, now);
  }
  predecessor.supersededAt = fields.supersededAt;
  predecessor.supersededByVersionId = fields.supersededByVersionId;
  if (immediate) predecessor.status = 'SUPERSEDED';
  touch(predecessor, actor, now);
  return immediate ? predecessor.id : undefined;
}

// ---------------------------------------------------------------------------
// Policy & workflow validation + evaluation engines
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Policy & workflow validation + evaluation engines
// ---------------------------------------------------------------------------

const FACT_MAP = new Map(FACTS.map((f) => [f.key, f]));

function validatePolicyContent(content: PolicyContent): ValidateDiagnostic[] {
  const diagnostics: ValidateDiagnostic[] = [];
  const rules = Array.isArray(content.rules) ? content.rules : [];

  if (rules.length > 200) {
    diagnostics.push({ path: 'rules', code: 'TRADE.POLICY.DEFINITION_INVALID' });
  }

  const seenCodes = new Set<string>();
  const seenPriorities = new Set<number>();

  rules.forEach((rule, i) => {
    const code = rule.code?.trim() ?? '';
    if (!RULE_CODE.test(code) || seenCodes.has(code)) {
      diagnostics.push({ path: `rules[${i}].code`, code: 'TRADE.POLICY.DEFINITION_INVALID' });
    }
    seenCodes.add(code);

    if (!Number.isInteger(rule.priority) || rule.priority < 0 || rule.priority > 100_000) {
      diagnostics.push({ path: `rules[${i}].priority`, code: 'TRADE.POLICY.DEFINITION_INVALID' });
    } else if (seenPriorities.has(rule.priority)) {
      diagnostics.push({
        path: `rules[${i}].priority`,
        code: 'TRADE.POLICY.DEFINITION_INVALID',
        reason: 'AMBIGUOUS_PRECEDENCE',
      });
    } else {
      seenPriorities.add(rule.priority);
    }

    if (!REASON_CODE.test(rule.reasonCode?.trim() ?? '')) {
      diagnostics.push({ path: `rules[${i}].reasonCode`, code: 'TRADE.POLICY.OUTPUT_INVALID' });
    }

    if (!OUTCOMES.includes(rule.outcome)) {
      diagnostics.push({ path: `rules[${i}].outcome`, code: 'TRADE.POLICY.OUTPUT_INVALID' });
    } else if (rule.outcome === 'SELECT') {
      const sv = rule.selectedValue?.trim() ?? '';
      if (!sv || sv.length > 120) {
        diagnostics.push({ path: `rules[${i}].selectedValue`, code: 'TRADE.POLICY.OUTPUT_INVALID' });
      }
    }

    const conditions = Array.isArray(rule.all) ? rule.all : [];
    if (conditions.length < 1 || conditions.length > 20) {
      diagnostics.push({ path: `rules[${i}].all`, code: 'TRADE.POLICY.EXPRESSION_INVALID' });
    }

    conditions.forEach((cond, j) => {
      const factDef = FACT_MAP.get(cond.fact);
      if (!factDef) {
        diagnostics.push({ path: `rules[${i}].all[${j}].fact`, code: 'TRADE.POLICY.EXPRESSION_INVALID' });
        return;
      }
      const allowedOps = operatorsFor(factDef.type);
      if (!allowedOps.includes(cond.operator)) {
        diagnostics.push({
          path: `rules[${i}].all[${j}].operator`,
          code: 'TRADE.POLICY.EXPRESSION_INVALID',
        });
      }
      if (cond.operator === 'IN') {
        if (!Array.isArray(cond.value) || cond.value.length < 1 || cond.value.length > 100) {
          diagnostics.push({ path: `rules[${i}].all[${j}].value`, code: 'TRADE.POLICY.EXPRESSION_INVALID' });
        } else if (isMoneyFact(cond.fact) && !cond.value.every((v) => isDecimalString(v) || (typeof v === 'number' && compareDecimal(v, 0) !== null))) {
          diagnostics.push({ path: `rules[${i}].all[${j}].value`, code: 'TRADE.POLICY.EXPRESSION_INVALID' });
        }
      } else if (isMoneyFact(cond.fact)) {
        // Money thresholds are DecimalString (S2); legacy finite numbers still load.
        if (!isDecimalString(cond.value) && !(typeof cond.value === 'number' && compareDecimal(cond.value, 0) !== null)) {
          diagnostics.push({ path: `rules[${i}].all[${j}].value`, code: 'TRADE.POLICY.EXPRESSION_INVALID' });
        }
      } else if (factDef.type === 'number') {
        const num = typeof cond.value === 'number' ? cond.value : Number(cond.value);
        if (cond.value === '' || cond.value === null || cond.value === undefined || !Number.isFinite(num)) {
          diagnostics.push({ path: `rules[${i}].all[${j}].value`, code: 'TRADE.POLICY.EXPRESSION_INVALID' });
        }
      } else if (factDef.type === 'boolean') {
        if (typeof cond.value !== 'boolean') {
          diagnostics.push({ path: `rules[${i}].all[${j}].value`, code: 'TRADE.POLICY.EXPRESSION_INVALID' });
        }
      } else {
        if (typeof cond.value !== 'string' || !cond.value.trim()) {
          diagnostics.push({ path: `rules[${i}].all[${j}].value`, code: 'TRADE.POLICY.EXPRESSION_INVALID' });
        }
      }
    });
  });

  if (!OUTCOMES.includes(content.defaultOutcome)) {
    diagnostics.push({ path: 'defaultOutcome', code: 'TRADE.POLICY.OUTPUT_INVALID' });
  } else if (content.defaultOutcome === 'SELECT') {
    const dsv = content.defaultSelectedValue?.trim() ?? '';
    if (!dsv || dsv.length > 120) {
      diagnostics.push({ path: 'defaultSelectedValue', code: 'TRADE.POLICY.OUTPUT_INVALID' });
    }
  }

  return diagnostics;
}

function validateWorkflowContent(content: WorkflowContent): ValidateDiagnostic[] {
  const diagnostics: ValidateDiagnostic[] = [];
  const states = Array.isArray(content.states) ? content.states : [];
  const terminalStates = Array.isArray(content.terminalStates) ? content.terminalStates : [];
  const transitions = Array.isArray(content.transitions) ? content.transitions : [];

  if (states.length < 2 || states.length > 50) {
    diagnostics.push({ path: 'states', code: 'TRADE.WORKFLOW.DEFINITION_INVALID' });
  }

  const stateSet = new Set<string>();
  for (const s of states) {
    if (!RULE_CODE.test(s) || stateSet.has(s)) {
      diagnostics.push({ path: 'states', code: 'TRADE.WORKFLOW.DEFINITION_INVALID' });
    }
    stateSet.add(s);
  }

  const terminalSet = new Set(terminalStates);
  if (terminalSet.size === 0 || terminalStates.some((s) => !stateSet.has(s))) {
    diagnostics.push({ path: 'terminalStates', code: 'TRADE.WORKFLOW.DEFINITION_INVALID' });
  }

  if (!stateSet.has(content.initialState) || terminalSet.has(content.initialState)) {
    diagnostics.push({ path: 'initialState', code: 'TRADE.WORKFLOW.DEFINITION_INVALID' });
  }

  if (transitions.length < 1 || transitions.length > 200) {
    diagnostics.push({ path: 'transitions', code: 'TRADE.WORKFLOW.DEFINITION_INVALID' });
  }

  const seenTransCodes = new Set<string>();
  const seenFromAction = new Set<string>();

  transitions.forEach((tr, i) => {
    if (!RULE_CODE.test(tr.code) || seenTransCodes.has(tr.code)) {
      diagnostics.push({ path: `transitions[${i}].code`, code: 'TRADE.WORKFLOW.DEFINITION_INVALID' });
    }
    seenTransCodes.add(tr.code);

    if (!stateSet.has(tr.from) || terminalSet.has(tr.from)) {
      diagnostics.push({ path: `transitions[${i}].from`, code: 'TRADE.WORKFLOW.DEFINITION_INVALID' });
    }
    if (!stateSet.has(tr.to)) {
      diagnostics.push({ path: `transitions[${i}].to`, code: 'TRADE.WORKFLOW.DEFINITION_INVALID' });
    }
    if (!WORKFLOW_ACTIONS.includes(tr.action)) {
      diagnostics.push({ path: `transitions[${i}].action`, code: 'TRADE.WORKFLOW.DEFINITION_INVALID' });
    }

    const pairKey = `${tr.from}::${tr.action}`;
    if (seenFromAction.has(pairKey)) {
      diagnostics.push({
        path: `transitions[${i}].action`,
        code: 'TRADE.WORKFLOW.DEFINITION_INVALID',
        reason: 'AMBIGUOUS_PRECEDENCE',
      });
    }
    seenFromAction.add(pairKey);
  });

  if (stateSet.has(content.initialState)) {
    const visited = new Set<string>([content.initialState]);
    const queue: string[] = [content.initialState];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const tr of transitions) {
        if (tr.from === curr && stateSet.has(tr.to) && !visited.has(tr.to)) {
          visited.add(tr.to);
          queue.push(tr.to);
        }
      }
    }
    if (states.some((s) => !visited.has(s))) {
      diagnostics.push({
        path: 'states',
        code: 'TRADE.WORKFLOW.DEFINITION_INVALID',
        reason: 'UNREACHABLE_STATE',
      });
    }
  }

  return diagnostics;
}

function evalCondition(cond: PolicyCondition, facts: Record<string, string | number | boolean>): boolean {
  const actual = facts[cond.fact];
  if (actual === undefined) return false;
  const factDef = FACT_MAP.get(cond.fact);
  if (!factDef) return false;

  if (cond.operator === 'IN') {
    const arr = Array.isArray(cond.value) ? cond.value : [];
    if (isMoneyFact(cond.fact)) {
      return arr.some((item) => compareDecimal(item, actual as string | number) === 0);
    }
    return arr.some((item) => String(item) === String(actual));
  }

  if (isMoneyFact(cond.fact)) {
    const cmp = compareDecimal(actual as string | number, cond.value as string | number);
    if (cmp === null) return false;
    switch (cond.operator) {
      case 'EQ':
        return cmp === 0;
      case 'NEQ':
        return cmp !== 0;
      case 'GT':
        return cmp > 0;
      case 'GTE':
        return cmp >= 0;
      case 'LT':
        return cmp < 0;
      case 'LTE':
        return cmp <= 0;
      default:
        return false;
    }
  }

  if (factDef.type === 'number') {
    const a = Number(actual);
    const b = Number(cond.value);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    switch (cond.operator) {
      case 'EQ':
        return a === b;
      case 'NEQ':
        return a !== b;
      case 'GT':
        return a > b;
      case 'GTE':
        return a >= b;
      case 'LT':
        return a < b;
      case 'LTE':
        return a <= b;
      default:
        return false;
    }
  }

  if (factDef.type === 'boolean') {
    const a = Boolean(actual);
    const b = Boolean(cond.value);
    return cond.operator === 'EQ' ? a === b : cond.operator === 'NEQ' ? a !== b : false;
  }

  const sa = String(actual);
  const sb = String(cond.value);
  switch (cond.operator) {
    case 'EQ':
      return sa === sb;
    case 'NEQ':
      return sa !== sb;
    case 'CONTAINS':
      return sa.toLowerCase().includes(sb.toLowerCase());
    default:
      return false;
  }
}

function evaluatePolicyRules(
  content: PolicyContent,
  testCase: PolicyTestCase,
): PolicyTestCaseResult {
  const sortedRules = content.rules.slice().sort((a, b) => a.priority - b.priority);
  let matched: PolicyRule | null = null;
  for (const rule of sortedRules) {
    if (rule.all.every((c) => evalCondition(c, testCase.facts))) {
      matched = rule;
      break;
    }
  }

  const actualOutcome = matched ? matched.outcome : content.defaultOutcome;
  const actualRuleCode = matched ? matched.code : null;
  const actualSelectedValue = matched
    ? matched.selectedValue ?? null
    : content.defaultSelectedValue ?? null;

  const outcomeMatches = actualOutcome === testCase.expectedOutcome;
  const ruleMatches =
    testCase.expectedRuleCode === undefined ||
    testCase.expectedRuleCode === null ||
    actualRuleCode === testCase.expectedRuleCode;
  const valueMatches =
    testCase.expectedSelectedValue === undefined ||
    testCase.expectedSelectedValue === null ||
    actualSelectedValue === testCase.expectedSelectedValue;

  return {
    code: testCase.code,
    passed: outcomeMatches && ruleMatches && valueMatches,
    expectedOutcome: testCase.expectedOutcome,
    actualOutcome,
    expectedRuleCode: testCase.expectedRuleCode ?? null,
    actualRuleCode,
    expectedSelectedValue: testCase.expectedSelectedValue ?? null,
    actualSelectedValue,
  };
}

function evaluateWorkflowCase(
  content: WorkflowContent,
  testCase: WorkflowTestCase,
): WorkflowTestCaseResult {
  let state = testCase.startState;
  let firstInvalidAction: WorkflowAction | null = null;

  for (const act of testCase.actions) {
    const tr = content.transitions.find((item) => item.from === state && item.action === act);
    if (!tr) {
      firstInvalidAction = act;
      break;
    }
    state = tr.to;
  }

  return {
    code: testCase.code,
    passed: firstInvalidAction === null && state === testCase.expectedState,
    expectedState: testCase.expectedState,
    actualState: state,
    firstInvalidAction,
  };
}

// ---------------------------------------------------------------------------
// Public Fake API Functions
// ---------------------------------------------------------------------------

/** policyStudioMetadata. */
export async function fakeGetPolicyMetadata(): Promise<PolicyMetadata> {
  await fakeDelay(100);
  return clone({
    registryVersion: REGISTRY_VERSION,
    facts: FACTS,
    operatorsByType: {
      string: operatorsFor('string'),
      boolean: operatorsFor('boolean'),
      number: operatorsFor('number'),
      decimal: operatorsFor('number'),
    },
    outcomes: OUTCOMES,
    workflowActions: WORKFLOW_ACTIONS,
    kinds: {
      policies: POLICY_KINDS.map((kind) => ({ kind, supported: ACTIVE_POLICY_KINDS.includes(kind) })),
      workflows: WORKFLOW_KINDS.map((kind) => ({ kind, supported: ACTIVE_WORKFLOW_KINDS.includes(kind) })),
    },
    factsByKind: FACTS_BY_KIND,
    purchaseOrderWorkflowShape: {
      states: [...PURCHASE_ORDER_WORKFLOW_SHAPE.states],
      initialState: PURCHASE_ORDER_WORKFLOW_SHAPE.initialState,
      terminalStates: [...PURCHASE_ORDER_WORKFLOW_SHAPE.terminalStates],
      transitions: PURCHASE_ORDER_WORKFLOW_SHAPE.transitions.map((t) => ({ ...t })),
    },
    codePatterns: {
      definition: '^[A-Z][A-Z0-9_.-]{1,99}$',
      rule: '^[A-Z][A-Z0-9_]{1,63}$',
      state: '^[A-Z][A-Z0-9_]{1,63}$',
      reason: '^[A-Z][A-Z0-9_.-]{1,79}$',
    },
  } as PolicyMetadata);
}

function filterDefinitions(domain: GovernedDomain, q: DefinitionCountsQuery): StoredDefinitionRecord[] {
  const needle = q.q?.trim().toLowerCase() ?? '';
  return DB.definitions.filter((d) => {
    if (d.domain !== domain || d.scopeTarget !== fakeScopeTarget) return false;
    if (q.kind && d.kind !== q.kind) return false;
    if (q.status && d.status !== q.status) return false;
    if (needle && !d.code.toLowerCase().includes(needle)) return false;
    return true;
  });
}

export async function fakeListDefinitions(
  domain: GovernedDomain,
  q: ListDefinitionsQuery = {},
): Promise<GovernedList<GovernedDefinition>> {
  await fakeDelay();
  activateDueScheduled();
  const page = q.page ?? 1;
  const limit = q.limit ?? 25;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  const matches = filterDefinitions(domain, q).sort((a, b) =>
    q.sort === 'updatedAt'
      ? Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.id.localeCompare(b.id)
      : a.code.localeCompare(b.code) || a.id.localeCompare(b.id),
  );
  const items = matches.slice((page - 1) * limit, page * limit).map(toDefinitionDto);
  return clone({ items, total: matches.length, page, limit });
}

export async function fakeCountDefinitions(
  domain: GovernedDomain,
  q: DefinitionCountsQuery = {},
): Promise<GovernedCounts> {
  await fakeDelay(80);
  const byStatus: Record<DefinitionStatus, number> = { ACTIVE: 0, INACTIVE: 0 };
  for (const def of filterDefinitions(domain, q)) byStatus[def.status] += 1;
  return { total: byStatus.ACTIVE + byStatus.INACTIVE, byStatus };
}

export async function fakeGetDefinition(domain: GovernedDomain, id: string): Promise<GovernedDefinition> {
  await fakeDelay();
  activateDueScheduled();
  return clone(toDefinitionDto(requireDef(domain, id)));
}

export async function fakeCreateDefinition(
  domain: GovernedDomain,
  input: CreateDefinitionInput,
  opts?: WriteOptions | string,
): Promise<GovernedDefinitionRecord> {
  await fakeDelay();
  const resolved = typeof opts === 'string' ? { idempotencyKey: opts } : normalizeWriteOpts(opts);
  const kind = 'policyKind' in input ? input.policyKind : input.workflowKind;
  if (!CODE_PATTERN.test(input.code) || !input.scopeTarget) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  if (input.scopeTarget !== fakeScopeTarget) {
    throw new ApiError(422, 'TRADE.AUTH.TARGET_INVALID');
  }

  return idem.run(`governed:createDef:${domain}`, resolved.idempotencyKey, { domain, input }, () => {
    const supported: readonly string[] = domain === 'policy' ? ACTIVE_POLICY_KINDS : ACTIVE_WORKFLOW_KINDS;
    if (!supported.includes(kind)) {
      throw new ApiError(422, domain === 'policy' ? 'TRADE.POLICY.DEFINITION_INVALID' : 'TRADE.WORKFLOW.DEFINITION_INVALID', {
        reason: ['kind_not_supported'],
      });
    }
    if (DB.definitions.some((d) => d.domain === domain && d.code === input.code && d.scopeTarget === input.scopeTarget)) {
      throw new ApiError(409, 'TRADE.POLICY.CODE_TAKEN');
    }
    const now = nowIso();
    const actor = getFakeActor();
    const created: StoredDefinitionRecord = {
      id: fakeId(),
      domain,
      code: input.code,
      kind,
      scopeTarget: input.scopeTarget,
      status: 'ACTIVE',
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: actor,
      updatedBy: actor,
    };
    DB.definitions.unshift(created);
    return toDefinitionRecord(created);
  });
}

/** PATCH policies/:id { status }. */
export async function fakeSetDefinitionStatus(
  domain: GovernedDomain,
  id: string,
  status: DefinitionStatus,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<GovernedDefinitionRecord> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(
    `governed:setDefStatus:${domain}:${id}`,
    opts.idempotencyKey,
    { domain, id, status, ifMatch: opts.ifMatch },
    () => {
      const def = requireDef(domain, id);
      checkIfMatch(opts.ifMatch, def.version);
      if (
        status === 'INACTIVE' &&
        DB.versions.some(
          (v) =>
            v.definitionId === def.id &&
            v.domain === domain &&
            (v.status === 'PUBLISHED' || v.status === 'SCHEDULED'),
        )
      ) {
        throw publishNotAllowed('has_live_version');
      }
      def.status = status;
      def.version += 1;
      def.updatedBy = getFakeActor();
      def.updatedAt = nowIso();
      return toDefinitionRecord(def);
    },
  );
}

function effectiveRange(from: string, to: string | null | undefined): { from: string; to: string | null } {
  const fromMs = Date.parse(from);
  if (Number.isNaN(fromMs)) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
  if (to && Date.parse(to) <= fromMs) {
    throw new ApiError(422, 'TRADE.POLICY.DEFINITION_INVALID');
  }
  return { from, to: to ?? null };
}

function assertTestCaseCount(testCases: readonly unknown[]): void {
  if (!Array.isArray(testCases) || testCases.length < 1 || testCases.length > 100) {
    throw new ApiError(400, 'TRADE.VALIDATION_FAILED');
  }
}

export async function fakeCreateGovernedVersion<C extends PolicyContent | WorkflowContent, T extends PolicyTestCase | WorkflowTestCase>(
  domain: GovernedDomain,
  definitionId: string,
  input: CreateGovernedVersionInput<C, T>,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<GovernedVersionRecord<C, T>> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);
  assertTestCaseCount(input.testCases);
  const range = effectiveRange(input.effectiveFrom, input.effectiveTo);

  return idem.run(
    `governed:createVer:${domain}:${definitionId}`,
    opts.idempotencyKey,
    { domain, definitionId, input, ifMatch: opts.ifMatch },
    () => {
      const def = requireDef(domain, definitionId);
      checkIfMatch(opts.ifMatch, def.version);
      const maxNum = DB.versions
        .filter((v) => v.definitionId === def.id && v.domain === domain)
        .reduce((max, item) => Math.max(max, item.versionNumber), 0);
      const now = nowIso();
      const actor = getFakeActor();
      const content = clone(input.content);
      const testCases = clone(input.testCases);
      const created: StoredVersionRecord = {
        id: fakeId(),
        domain,
        definitionId: def.id,
        versionNumber: maxNum + 1,
        version: 1,
        status: 'DRAFT',
        contentHash: hashGoverned(content, testCases, range.from, range.to),
        registryVersion: REGISTRY_VERSION,
        effectiveFrom: range.from,
        effectiveTo: range.to,
        supersededAt: null,
        supersededByVersionId: null,
        createdBy: actor,
        submittedBy: null,
        approvedBy: null,
        approvedAt: null,
        restoredFromVersionId: null,
        updatedBy: actor,
        updatedAt: now,
        content,
        testCases,
        evidence: [],
        actions: [],
      };
      DB.versions.push(created);
      return toVersionRecord(created) as GovernedVersionRecord<C, T>;
    },
  );
}

export async function fakeGetGovernedVersion(domain: GovernedDomain, id: string): Promise<GovernedVersionDetail> {
  await fakeDelay();
  activateDueScheduled();
  const { ver, def } = requireVer(domain, id);
  return clone(toVersionDetailDto(ver, def));
}

export async function fakeUpdateGovernedVersion(
  domain: GovernedDomain,
  id: string,
  input: UpdateGovernedVersionInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<GovernedVersionRecord> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(
    `governed:updateVer:${domain}:${id}`,
    opts.idempotencyKey,
    { domain, id, input, ifMatch: opts.ifMatch },
    () => {
      const { ver, def } = requireVer(domain, id);
      checkIfMatch(opts.ifMatch, ver.version);
      if (ver.status !== 'DRAFT' && ver.status !== 'REJECTED') {
        throw publishNotAllowed('not_editable');
      }
      const content = input.content !== undefined ? clone(input.content) : ver.content;
      const testCases = input.testCases !== undefined ? clone(input.testCases) : ver.testCases;
      assertTestCaseCount(testCases);
      const range = effectiveRange(
        input.effectiveFrom ?? ver.effectiveFrom,
        input.effectiveTo === undefined ? ver.effectiveTo : input.effectiveTo,
      );
      ver.content = content;
      ver.testCases = testCases;
      ver.effectiveFrom = range.from;
      ver.effectiveTo = range.to;
      // Evidence is keyed by this hash, so old evidence no longer counts.
      ver.contentHash = hashGoverned(content, testCases, range.from, range.to);
      ver.status = 'DRAFT';
      ver.submittedBy = null;
      ver.approvedBy = null;
      ver.approvedAt = null;
      touch(ver, getFakeActor(), nowIso());
      return { ...toVersionRecord(ver), definitionCode: def.code };
    },
  );
}

export async function fakeDeleteGovernedVersion(
  domain: GovernedDomain,
  id: string,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<GovernedDeleteResult> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);

  return idem.run(`governed:deleteVer:${domain}:${id}`, opts.idempotencyKey, { domain, id, ifMatch: opts.ifMatch }, () => {
    const { ver } = requireVer(domain, id);
    checkIfMatch(opts.ifMatch, ver.version);
    if (ver.status !== 'DRAFT' && ver.status !== 'REJECTED') {
      throw publishNotAllowed('not_deletable');
    }
    if (ver.actions.some((entry) => entry.action === 'PUBLISH')) {
      throw publishNotAllowed('not_deletable');
    }
    const idx = DB.versions.findIndex((item) => item.id === id);
    if (idx >= 0) DB.versions.splice(idx, 1);
    return { id, deleted: true as const };
  });
}

function runValidate(ver: StoredVersionRecord, body: GovernedActionBody): GovernedValidateResult {
  if (ver.status !== 'DRAFT' && ver.status !== 'REJECTED') {
    throw publishNotAllowed('not_editable');
  }
  const diagnostics =
    ver.domain === 'policy'
      ? validatePolicyContent(ver.content as PolicyContent)
      : validateWorkflowContent(ver.content as WorkflowContent);
  const passed = diagnostics.length === 0;
  const report = { passed, registryVersion: ver.registryVersion, diagnostics };
  // A failed report stores no evidence and no action.
  if (!passed) return { evidenceId: null, ...report, contentHash: ver.contentHash };
  const evidenceId = fakeId();
  ver.evidence.push({ type: 'VALIDATION', passed: true, contentHash: ver.contentHash, recordedAt: nowIso() });
  recordAction(ver, 'validate', body);
  return { evidenceId, ...report, contentHash: ver.contentHash };
}

function runTest(ver: StoredVersionRecord, body: GovernedActionBody): PolicyTestResult | WorkflowTestResult {
  if (ver.status !== 'DRAFT' && ver.status !== 'REJECTED' && ver.status !== 'TESTED') {
    throw publishNotAllowed('not_editable');
  }
  if (!hasPassingEvidence(ver, 'VALIDATION')) {
    throw new ApiError(409, 'TRADE.POLICY.TEST_CONFLICT');
  }
  const cases =
    ver.domain === 'policy'
      ? (ver.testCases as PolicyTestCase[]).map((tc) => evaluatePolicyRules(ver.content as PolicyContent, tc))
      : (ver.testCases as WorkflowTestCase[]).map((tc) => evaluateWorkflowCase(ver.content as WorkflowContent, tc));
  const passed = cases.every((r) => r.passed);
  const evidenceId = fakeId();
  ver.evidence.push({ type: 'TEST', passed, contentHash: ver.contentHash, recordedAt: nowIso(), cases: clone(cases) });
  if (passed) {
    ver.status = 'TESTED';
    touch(ver, getFakeActor(), nowIso());
  }
  recordAction(ver, 'test', body);
  return { evidenceId, passed, cases, contentHash: ver.contentHash, version: ver.version } as
    | PolicyTestResult
    | WorkflowTestResult;
}

function assertMakerChecker(ver: StoredVersionRecord, actor: string): void {
  if (ver.status !== 'APPROVAL_PENDING' || ver.createdBy === actor || ver.submittedBy === actor) {
    throw new ApiError(409, 'TRADE.APPROVAL.MAKER_CHECKER_REQUIRED');
  }
}

/** validateActionEvidence: at most 8 KiB, depth 4, 50 entries, no secret-like keys. */
function validateActionEvidence(body: GovernedActionBody): void {
  if (!body.evidence) return;
  if (JSON.stringify(body.evidence).length > 8_192) throw new ApiError(422, 'TRADE.POLICY.OUTPUT_INVALID');
  const forbidden = /(?:secret|password|token|rawpayload|authorization)/i;
  const visit = (value: unknown, depth: number): void => {
    if (depth > 4) throw new ApiError(422, 'TRADE.POLICY.OUTPUT_INVALID');
    if (Array.isArray(value)) {
      if (value.length > 50) throw new ApiError(422, 'TRADE.POLICY.OUTPUT_INVALID');
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length > 50 || entries.some(([key]) => forbidden.test(key))) {
        throw new ApiError(422, 'TRADE.POLICY.OUTPUT_INVALID');
      }
      entries.forEach(([, item]) => visit(item, depth + 1));
    }
  };
  visit(body.evidence, 0);
}

export async function fakeRunGovernedAction(
  domain: GovernedDomain,
  id: string,
  action: GovernedAction,
  body: GovernedActionBody = {},
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<GovernedValidateResult | PolicyTestResult | WorkflowTestResult | GovernedVersionRecord> {
  await fakeDelay();
  const opts = normalizeWriteOpts(ifMatchOrOpts, idempotencyKey);
  validateActionEvidence(body);

  return idem.run(
    `governed:action:${domain}:${id}:${action}`,
    opts.idempotencyKey,
    { domain, id, action, body, ifMatch: opts.ifMatch },
    () => {
      const { ver, def } = requireVer(domain, id);
      checkIfMatch(opts.ifMatch, ver.version);
      const actor = getFakeActor();
      const now = nowIso();

      if (action === 'validate') return runValidate(ver, body);
      if (action === 'test') return runTest(ver, body);

      let reasonMeta: { code: string; nameEn: string; nameAr: string } | undefined;
      if (action === 'submit') {
        if (ver.status !== 'TESTED') throw publishNotAllowed('not_tested');
        ver.status = 'APPROVAL_PENDING';
        ver.submittedBy = actor;
      } else if (action === 'approve') {
        assertMakerChecker(ver, actor);
        ver.status = 'APPROVED';
        ver.approvedBy = actor;
        ver.approvedAt = now;
      } else if (action === 'reject') {
        assertMakerChecker(ver, actor);
        reasonMeta = assertReason(domain, 'reject', body);
        ver.status = 'REJECTED';
      } else if (action === 'publish') {
        if (ver.status !== 'APPROVED') throw publishNotAllowed('not_approved');
        if (ver.createdBy === actor) throw publishNotAllowed('self_publish');
        if (def.status !== 'ACTIVE') throw publishNotAllowed('definition_inactive');
        if (domain === 'workflow' && def.kind === 'PURCHASE_ORDER') {
          const diagnostics = validateWorkflowContent(ver.content as WorkflowContent);
          if (diagnostics.length) throw new ApiError(422, 'TRADE.WORKFLOW.DEFINITION_INVALID');
        }
        if (!hasPassingEvidence(ver, 'VALIDATION') || !hasPassingEvidence(ver, 'TEST')) {
          throw new ApiError(409, 'TRADE.POLICY.TEST_CONFLICT');
        }
        if (body.supersedesVersionId) {
          supersedeGovernedVersion(def, ver, body.supersedesVersionId, actor, now);
        }
        if (governedOverlap(def, ver)) {
          throw new ApiError(409, 'TRADE.POLICY.EFFECTIVE_OVERLAP');
        }
        ver.status = Date.parse(ver.effectiveFrom) > Date.parse(now) ? 'SCHEDULED' : 'PUBLISHED';
      } else if (action === 'retire') {
        if (ver.status !== 'PUBLISHED' && ver.status !== 'SCHEDULED') throw publishNotAllowed('not_live');
        reasonMeta = assertReason(domain, 'retire', body);
        // A promised successor is immutable and must remain live (db-4).
        if (DB.versions.some((other) => other.domain === domain && other.supersededByVersionId === ver.id)) {
          throw publishNotAllowed('linked_successor');
        }
        ver.status = 'RETIRED';
      } else if (action === 'rollback') {
        if (ver.status !== 'PUBLISHED' && ver.status !== 'RETIRED' && ver.status !== 'SUPERSEDED') {
          throw publishNotAllowed('not_live');
        }
        reasonMeta = assertReason(domain, 'rollback', body);
        const maxNum = DB.versions
          .filter((item) => item.definitionId === def.id && item.domain === domain)
          .reduce((max, item) => Math.max(max, item.versionNumber), 0);
        const clonedVersion: StoredVersionRecord = {
          id: fakeId(),
          domain,
          definitionId: def.id,
          versionNumber: maxNum + 1,
          version: 1,
          status: 'DRAFT',
          contentHash: hashGoverned(ver.content, ver.testCases, now, null),
          registryVersion: ver.registryVersion,
          effectiveFrom: now,
          effectiveTo: null,
          supersededAt: null,
          supersededByVersionId: null,
          createdBy: actor,
          submittedBy: null,
          approvedBy: null,
          approvedAt: null,
          restoredFromVersionId: ver.id,
          updatedBy: actor,
          updatedAt: now,
          content: clone(ver.content),
          testCases: clone(ver.testCases),
          evidence: [],
          actions: [],
        };
        DB.versions.push(clonedVersion);
        // The action row stays on the source version and names the created draft.
        recordAction(ver, 'rollback', body, reasonMeta, { createdVersionId: clonedVersion.id });
        return toVersionRecord(clonedVersion);
      }

      touch(ver, actor, now);
      recordAction(ver, action, body, reasonMeta);
      return toVersionRecord(ver);
    },
  );
}

export async function fakeGetDecision(id: string): Promise<DecisionReceipt> {
  await fakeDelay(120);
  const found = DB.decisions.find((d) => d.id === id);
  if (!found) {
    throw new ApiError(404, NOT_FOUND);
  }
  return clone(found);
}

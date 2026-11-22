import type {
  PolicyFactDefinition,
  PolicyKind,
  PolicyOperator,
  PolicyOutcome,
  WorkflowAction,
  WorkflowKind,
} from './policy.registry';

// Shapes follow trade-app policy-studio (policy-studio.service.ts, policy-governance.ts, dto/policy-studio.dto.ts).

export type GovernedDomain = 'policy' | 'workflow';

export type GovernedStatus =
  | 'DRAFT'
  | 'TESTED'
  | 'APPROVAL_PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'RETIRED'
  | 'SUPERSEDED';

export type DefinitionStatus = 'ACTIVE' | 'INACTIVE';
export type ScopeTarget = 'TENANT' | 'COMPANY' | 'BRANCH';

/** projectGovernedVersion: the version row in lists and definition reads. */
export interface GovernedVersion {
  id: string;
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
}

/** The definition entity (create and PATCH responses). */
export interface GovernedDefinitionRecord {
  id: string;
  code: string;
  scopeTarget: ScopeTarget;
  companyId: string | null;
  branchId: string | null;
  companyScopeKey: string;
  branchScopeKey: string;
  status: DefinitionStatus;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  policyKind?: string;
  workflowKind?: string;
}

/** GET policies/:id, and each list item: the entity plus its versions. */
export interface GovernedDefinition extends GovernedDefinitionRecord {
  versions: GovernedVersion[];
}

export function definitionKind(def: Pick<GovernedDefinitionRecord, 'policyKind' | 'workflowKind'>): string {
  return def.policyKind ?? def.workflowKind ?? '';
}

export interface GovernedList<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface GovernedCounts {
  total: number;
  byStatus: Record<DefinitionStatus, number>;
}

/** Latest evidence row of the current content hash. */
export interface GovernedEvidenceRef {
  passed: boolean;
  contentHash: string;
  recordedAt: string;
}

export interface GovernedVersionEvidence {
  validation: GovernedEvidenceRef | null;
  test: (GovernedEvidenceRef & { cases: (PolicyTestCaseResult | WorkflowTestCaseResult)[] }) | null;
}

/** loadGovernedActions projection (newest first, at most 100). */
export interface GovernedActionEntry {
  action: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  reasonCode: string | null;
  reasonNameEn: string | null;
  reasonNameAr: string | null;
  reasonNote: string | null;
  occurredAt: string;
}

export interface GovernedVersionDefinitionRef {
  id: string;
  code: string;
  kind: string;
  scopeTarget: ScopeTarget;
}

/** GET policy-versions/:id (or workflow-versions/:id). */
export interface GovernedVersionDetail<C = PolicyContent | WorkflowContent, T = PolicyTestCase | WorkflowTestCase>
  extends GovernedVersion {
  content: C;
  testCases: T[];
  definition: GovernedVersionDefinitionRef;
  evidence: GovernedVersionEvidence;
  actions: GovernedActionEntry[];
}

/** The saved version entity, returned by create, update, submit/approve/reject/publish/retire and rollback. */
export interface GovernedVersionRecord<C = PolicyContent | WorkflowContent, T = PolicyTestCase | WorkflowTestCase>
  extends GovernedVersion {
  content: C;
  testCases: T[];
  updatedBy: string | null;
  updatedAt: string;
  policyDefinitionId?: string;
  workflowDefinitionId?: string;
  /** Only on the PATCH response. */
  definitionCode?: string;
}

export function isPolicyVersionDetail(
  detail: GovernedVersionDetail,
): detail is GovernedVersionDetail<PolicyContent, PolicyTestCase> {
  return 'rules' in detail.content;
}

export interface PolicyCondition {
  fact: string;
  operator: PolicyOperator;
  value: string | number | boolean | (string | number)[];
}

export interface PolicyRule {
  code: string;
  priority: number;
  all: PolicyCondition[];
  outcome: PolicyOutcome;
  selectedValue?: string | null;
  reasonCode: string;
}

export interface PolicyContent {
  rules: PolicyRule[];
  defaultOutcome: PolicyOutcome;
  defaultSelectedValue?: string | null;
}

export interface PolicyTestCase {
  code: string;
  facts: Record<string, string | number | boolean>;
  expectedOutcome: PolicyOutcome;
  expectedRuleCode?: string | null;
  expectedSelectedValue?: string | null;
}

export interface PolicyTestCaseResult {
  code: string;
  passed: boolean;
  expectedOutcome: PolicyOutcome;
  actualOutcome: PolicyOutcome;
  expectedRuleCode?: string | null;
  actualRuleCode: string | null;
  expectedSelectedValue?: string | null;
  actualSelectedValue?: string | null;
}

export interface PolicyTestResult {
  evidenceId: string;
  passed: boolean;
  cases: PolicyTestCaseResult[];
  contentHash: string;
  version: number;
}

export interface WorkflowTransition {
  code: string;
  from: string;
  to: string;
  action: WorkflowAction;
  requiresApproval?: boolean;
}

export interface WorkflowContent {
  states: string[];
  initialState: string;
  terminalStates: string[];
  transitions: WorkflowTransition[];
}

export interface WorkflowTestCase {
  code: string;
  startState: string;
  actions: WorkflowAction[];
  expectedState: string;
}

export interface WorkflowTestCaseResult {
  code: string;
  passed: boolean;
  expectedState: string;
  actualState: string;
  firstInvalidAction: WorkflowAction | null;
}

export interface WorkflowTestResult {
  evidenceId: string;
  passed: boolean;
  cases: WorkflowTestCaseResult[];
  contentHash: string;
  version: number;
}

export interface ValidateDiagnostic {
  path: string;
  code: string;
  reason?: string;
}

/** validate: evidenceId is null when the report failed (no evidence row is stored). The row version does not change. */
export interface GovernedValidateResult {
  evidenceId: string | null;
  passed: boolean;
  registryVersion: string;
  diagnostics: ValidateDiagnostic[];
  contentHash: string;
}

export type GovernedAction =
  | 'validate'
  | 'test'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'publish'
  | 'retire'
  | 'rollback';

/** GovernanceActionDto + ReasonedGovernanceActionDto + PublishGovernedVersionDto. */
export interface GovernedActionBody {
  /** Deprecated legacy note; use reasonNote. */
  reason?: string;
  evidence?: Record<string, unknown>;
  reasonCode?: string;
  reasonNote?: string;
  supersedesVersionId?: string;
}

export interface GovernedDeleteResult {
  id: string;
  deleted: true;
}

export interface DecisionPolicyVersionRef {
  definitionId: string;
  definitionCode: string;
  versionId: string;
  versionNumber: number;
  kind: string;
}

export interface DecisionReceipt {
  id: string;
  decisionType: string;
  outcome: PolicyOutcome;
  reasonCode: string;
  explanationCode: string;
  selectedValue: string | null;
  matchedRuleCode: string | null;
  policyVersions: DecisionPolicyVersionRef[];
  document: {
    aggregateType: string;
    aggregateId: string;
  };
  evaluatedAt: string;
  correlationId: string;
}

export interface GovernedKindSupport<K extends string> {
  kind: K;
  supported: boolean;
}

/** GET policy-studio/metadata (policyStudioMetadata). */
export interface PolicyMetadata {
  registryVersion: string;
  facts: readonly PolicyFactDefinition[];
  operatorsByType: Readonly<Record<string, readonly PolicyOperator[]>>;
  outcomes: readonly PolicyOutcome[];
  workflowActions: readonly WorkflowAction[];
  kinds: {
    policies: readonly GovernedKindSupport<PolicyKind>[];
    workflows: readonly GovernedKindSupport<WorkflowKind>[];
  };
  factsByKind: Readonly<Record<string, readonly string[]>>;
  purchaseOrderWorkflowShape: WorkflowContent;
  codePatterns: { definition: string; rule: string; state: string; reason: string };
}

export function supportedKinds<K extends string>(kinds: readonly GovernedKindSupport<K>[] | undefined): K[] {
  return (kinds ?? []).filter((item) => item.supported).map((item) => item.kind);
}

/** GovernanceListQueryDto. */
export interface ListDefinitionsQuery {
  page?: number;
  limit?: number;
  kind?: string;
  status?: DefinitionStatus;
  q?: string;
  sort?: 'code' | 'updatedAt';
}

export type DefinitionCountsQuery = Omit<ListDefinitionsQuery, 'page' | 'limit' | 'sort'>;

/** CreatePolicyDefinitionDto / CreateWorkflowDefinitionDto. */
export type CreateDefinitionInput =
  | { code: string; policyKind: string; scopeTarget: ScopeTarget }
  | { code: string; workflowKind: string; scopeTarget: ScopeTarget };

export interface CreateGovernedVersionInput<C = PolicyContent | WorkflowContent, T = PolicyTestCase | WorkflowTestCase> {
  content: C;
  testCases: T[];
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface UpdateGovernedVersionInput<C = PolicyContent | WorkflowContent, T = PolicyTestCase | WorkflowTestCase> {
  content?: C;
  testCases?: T[];
  effectiveFrom?: string;
  effectiveTo?: string | null;
}

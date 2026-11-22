import {
  fakeCreateDefinition,
  fakeCreateGovernedVersion,
  fakeDeleteGovernedVersion,
  fakeGetDecision,
  fakeGetDefinition,
  fakeGetGovernedVersion,
  fakeGetPolicyMetadata,
  fakeCountDefinitions,
  fakeListDefinitions,
  fakeRunGovernedAction,
  fakeSetDefinitionStatus,
  fakeUpdateGovernedVersion,
  getFakeActor,
  setFakeActor,
} from './policy.fake';
import type { WriteOptions } from './governance-fake-actors';
import type {
  CreateDefinitionInput,
  CreateGovernedVersionInput,
  DecisionReceipt,
  DefinitionCountsQuery,
  DefinitionStatus,
  GovernedAction,
  GovernedActionBody,
  GovernedCounts,
  GovernedDefinition,
  GovernedDefinitionRecord,
  GovernedDeleteResult,
  GovernedDomain,
  GovernedList,
  GovernedValidateResult,
  GovernedVersionDetail,
  GovernedVersionRecord,
  ListDefinitionsQuery,
  PolicyContent,
  PolicyMetadata,
  PolicyTestCase,
  PolicyTestResult,
  UpdateGovernedVersionInput,
  WorkflowContent,
  WorkflowTestCase,
  WorkflowTestResult,
} from './policy.model';

export { getFakeActor, setFakeActor };

export const POLICY_QUERY_KEYS = {
  metadata: () => ['trade', 'policy', 'metadata'] as const,
  list: (domain: GovernedDomain, q?: ListDefinitionsQuery) =>
    ['trade', 'policy', domain, 'list', q ?? {}] as const,
  counts: (domain: GovernedDomain, q?: DefinitionCountsQuery) =>
    ['trade', 'policy', domain, 'counts', q ?? {}] as const,
  definition: (domain: GovernedDomain, id: string) =>
    ['trade', 'policy', domain, 'definition', id] as const,
  version: (domain: GovernedDomain, id: string) =>
    ['trade', 'policy', domain, 'version', id] as const,
  decision: (id: string) => ['trade', 'policy', 'decision', id] as const,
};

// Writes send x-idempotency-key; version writes and PATCH send If-Match.

// GET /api/tenant/trade/v1/policy-studio/metadata
export function getMetadata(): Promise<PolicyMetadata> {
  return fakeGetPolicyMetadata();
}

// GET /api/tenant/trade/v1/policies?page&limit&kind&status&q&sort (or /workflows)
export function listDefinitions(
  domain: GovernedDomain,
  q: ListDefinitionsQuery = {},
): Promise<GovernedList<GovernedDefinition>> {
  return fakeListDefinitions(domain, q);
}

// GET /api/tenant/trade/v1/policies/counts?kind&status&q (or /workflows/counts)
export function countDefinitions(domain: GovernedDomain, q: DefinitionCountsQuery = {}): Promise<GovernedCounts> {
  return fakeCountDefinitions(domain, q);
}

// GET /api/tenant/trade/v1/policies/:id (or /workflows/:id)
export function getDefinition(domain: GovernedDomain, id: string): Promise<GovernedDefinition> {
  return fakeGetDefinition(domain, id);
}

// POST /api/tenant/trade/v1/policies { code, policyKind, scopeTarget } (or /workflows { code, workflowKind, scopeTarget })
export function createDefinition(
  domain: GovernedDomain,
  input: CreateDefinitionInput,
  opts?: WriteOptions | string,
): Promise<GovernedDefinitionRecord> {
  return fakeCreateDefinition(domain, input, opts);
}

// PATCH /api/tenant/trade/v1/policies/:id { status } (or /workflows/:id)
export function setDefinitionStatus(
  domain: GovernedDomain,
  id: string,
  status: DefinitionStatus,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<GovernedDefinitionRecord> {
  return fakeSetDefinitionStatus(domain, id, status, ifMatchOrOpts, idempotencyKey);
}

// POST /api/tenant/trade/v1/policies/:id/versions (or /workflows/:id/versions); If-Match = definition version
export function createVersion<
  C extends PolicyContent | WorkflowContent = PolicyContent | WorkflowContent,
  T extends PolicyTestCase | WorkflowTestCase = PolicyTestCase | WorkflowTestCase,
>(
  domain: GovernedDomain,
  defId: string,
  input: CreateGovernedVersionInput<C, T>,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<GovernedVersionRecord<C, T>> {
  return fakeCreateGovernedVersion(domain, defId, input, ifMatchOrOpts, idempotencyKey);
}

// GET /api/tenant/trade/v1/policy-versions/:id (or /workflow-versions/:id)
export function getVersion(domain: GovernedDomain, id: string): Promise<GovernedVersionDetail> {
  return fakeGetGovernedVersion(domain, id);
}

// PATCH /api/tenant/trade/v1/policy-versions/:id (or /workflow-versions/:id)
export function updateVersion(
  domain: GovernedDomain,
  id: string,
  input: UpdateGovernedVersionInput,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<GovernedVersionRecord> {
  return fakeUpdateGovernedVersion(domain, id, input, ifMatchOrOpts, idempotencyKey);
}

// DELETE /api/tenant/trade/v1/policy-versions/:id (or /workflow-versions/:id)
export function deleteVersion(
  domain: GovernedDomain,
  id: string,
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<GovernedDeleteResult> {
  return fakeDeleteGovernedVersion(domain, id, ifMatchOrOpts, idempotencyKey);
}

// POST /api/tenant/trade/v1/policy-versions/:id/:action (or /workflow-versions/:id/:action)
export function runAction(
  domain: GovernedDomain,
  id: string,
  action: GovernedAction,
  body: GovernedActionBody = {},
  ifMatchOrOpts?: number | WriteOptions,
  idempotencyKey?: string,
): Promise<GovernedValidateResult | PolicyTestResult | WorkflowTestResult | GovernedVersionRecord> {
  return fakeRunGovernedAction(domain, id, action, body, ifMatchOrOpts, idempotencyKey);
}

// GET /api/tenant/trade/v1/decisions/:id
export function getDecision(id: string): Promise<DecisionReceipt> {
  return fakeGetDecision(id);
}

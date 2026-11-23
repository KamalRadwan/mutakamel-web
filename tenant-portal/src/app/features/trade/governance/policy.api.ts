import type { CoreQuery } from '../../../core/api/core-http';
import {
  ApiError,
  type TradeContext,
  assertBodyBooleans,
  assertIdempotencyKey,
  ifMatch,
  newIdempotencyKey,
  scopeFor,
} from '../shared/trade-api';
import { tradeHttp } from '../shared/trade-http';
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
  PolicyRule,
  PolicyTestCase,
  PolicyTestResult,
  PolicyWriteOptions,
  UpdateGovernedVersionInput,
  WireDecisionReceipt,
  WirePolicyMetadata,
  WorkflowContent,
  WorkflowTestCase,
  WorkflowTestCaseResult,
  WorkflowTestResult,
} from './policy.model';

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

function encodeSeg(value: string): string {
  return encodeURIComponent(value);
}

function domainBase(domain: GovernedDomain): string {
  return domain === 'policy' ? '/policies' : '/workflows';
}

function versionBase(domain: GovernedDomain): string {
  return domain === 'policy' ? '/policy-versions' : '/workflow-versions';
}

function compactQuery(
  entries: Record<string, string | number | boolean | undefined>,
): CoreQuery | undefined {
  const result: Record<string, string | number | boolean> = {};
  let count = 0;
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined || v === '') continue;
    result[k] = v;
    count += 1;
  }
  return count > 0 ? result : undefined;
}

interface ResolvedWriteMeta {
  key: string;
  ifMatchHeader?: string;
  scope: TradeContext | undefined;
}

function resolveWriteMeta(
  ifMatchOrOpts: number | PolicyWriteOptions | undefined,
  idempotencyKey: string | undefined,
  ctx: TradeContext | undefined,
  requireIfMatch: boolean,
): ResolvedWriteMeta {
  const opts =
    typeof ifMatchOrOpts === 'object' && ifMatchOrOpts !== null ? ifMatchOrOpts : undefined;
  const expected =
    typeof ifMatchOrOpts === 'number' ? ifMatchOrOpts : opts?.ifMatch;
  const explicitKey =
    idempotencyKey !== undefined ? idempotencyKey : opts?.idempotencyKey;
  const resolvedCtx = ctx ?? opts?.ctx ?? {};

  const key = assertIdempotencyKey(
    explicitKey === undefined ? newIdempotencyKey() : explicitKey,
  );

  let ifMatchHeader: string | undefined;
  if (requireIfMatch) {
    if (typeof expected !== 'number' || !Number.isSafeInteger(expected) || expected < 1) {
      throw new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED');
    }
    ifMatchHeader = ifMatch(expected);
  }

  return {
    key,
    ifMatchHeader,
    scope: scopeFor(resolvedCtx, 'OPTIONAL'),
  };
}

/** G-3: convert metadata `facts` object map into an ordered array while preserving key order. */
export function toPolicyMetadata(wire: WirePolicyMetadata): PolicyMetadata {
  const facts = Array.isArray(wire.facts)
    ? [...wire.facts]
    : Object.entries(wire.facts ?? {}).map(([key, type]) => ({ key, type }));
  return {
    ...wire,
    facts,
  };
}

/** G-1 & G-2: adapt backend decision receipt (`result.*`, `matchedRules[]`, flat aggregate fields, and `policyVersions[]`). */
export function toDecision(wire: WireDecisionReceipt): DecisionReceipt {
  const result = wire.result ?? {};
  return {
    id: wire.id,
    decisionType: wire.decisionType,
    scopeTarget: wire.scopeTarget ?? null,
    companyId: wire.companyId ?? null,
    branchId: wire.branchId ?? null,
    channelId: wire.channelId ?? null,
    aggregateType: wire.aggregateType ?? null,
    aggregateId: wire.aggregateId ?? null,
    outcome: result.outcome ?? '',
    reasonCode: result.reasonCode ?? '',
    explanationCode: result.explanationCode ?? '',
    selectedValue: result.selectedValue ?? null,
    matchedRules: Array.isArray(wire.matchedRules) ? [...wire.matchedRules] : [],
    explanation: wire.explanation ?? null,
    policyVersions: Array.isArray(wire.policyVersions)
      ? wire.policyVersions.map((ref) => ({ ...ref }))
      : [],
    evaluatedAt: wire.evaluatedAt,
    correlationId: wire.correlationId,
  };
}

function sanitizePolicyRule(rule: PolicyRule): PolicyRule {
  return {
    code: rule.code,
    priority: rule.priority,
    all: rule.all.map((cond) => ({
      fact: cond.fact,
      operator: cond.operator,
      value: cond.value,
    })),
    outcome: rule.outcome,
    // G-7: selectedValue is omitted unless outcome is SELECT.
    ...(rule.outcome === 'SELECT' && rule.selectedValue !== undefined && rule.selectedValue !== null
      ? { selectedValue: rule.selectedValue }
      : {}),
    reasonCode: rule.reasonCode,
  };
}

function sanitizeContent(
  domain: GovernedDomain,
  content: PolicyContent | WorkflowContent,
): PolicyContent | WorkflowContent {
  if (domain === 'policy') {
    const pc = content as PolicyContent;
    return {
      rules: pc.rules.map(sanitizePolicyRule),
      defaultOutcome: pc.defaultOutcome,
      // G-7: defaultSelectedValue is omitted unless defaultOutcome is SELECT.
      ...(pc.defaultOutcome === 'SELECT' &&
      pc.defaultSelectedValue !== undefined &&
      pc.defaultSelectedValue !== null
        ? { defaultSelectedValue: pc.defaultSelectedValue }
        : {}),
    };
  }

  const wc = content as WorkflowContent;
  return {
    states: [...wc.states],
    initialState: wc.initialState,
    terminalStates: [...wc.terminalStates],
    transitions: wc.transitions.map((t) => {
      assertBodyBooleans(t, ['requiresApproval']);
      return {
        code: t.code,
        from: t.from,
        to: t.to,
        action: t.action,
        ...(t.requiresApproval !== undefined ? { requiresApproval: t.requiresApproval } : {}),
      };
    }),
  };
}

function sanitizeTestCases(
  domain: GovernedDomain,
  testCases: readonly (PolicyTestCase | WorkflowTestCase)[],
): (PolicyTestCase | WorkflowTestCase)[] {
  if (domain === 'policy') {
    return (testCases as readonly PolicyTestCase[]).map((tc) => ({
      code: tc.code,
      facts: { ...tc.facts },
      expectedOutcome: tc.expectedOutcome,
      ...(tc.expectedRuleCode ? { expectedRuleCode: tc.expectedRuleCode } : {}),
      ...(tc.expectedOutcome === 'SELECT' && tc.expectedSelectedValue
        ? { expectedSelectedValue: tc.expectedSelectedValue }
        : {}),
    }));
  }
  return (testCases as readonly WorkflowTestCase[]).map((tc) => ({
    code: tc.code,
    startState: tc.startState,
    actions: [...tc.actions],
    expectedState: tc.expectedState,
  }));
}

interface WireWorkflowTestCaseResult extends Omit<WorkflowTestCaseResult, 'firstInvalidAction'> {
  firstInvalidAction?: WorkflowTestCaseResult['firstInvalidAction'];
  invalidAction?: WorkflowTestCaseResult['firstInvalidAction'];
}

function normalizeWorkflowCase(raw: WireWorkflowTestCaseResult): WorkflowTestCaseResult {
  return {
    code: raw.code,
    passed: raw.passed,
    expectedState: raw.expectedState,
    actualState: raw.actualState,
    firstInvalidAction: raw.firstInvalidAction ?? raw.invalidAction ?? null,
  };
}

function normalizeWorkflowTestResult(
  res: Omit<WorkflowTestResult, 'cases'> & { cases: WireWorkflowTestCaseResult[] },
): WorkflowTestResult {
  return {
    ...res,
    cases: (res.cases ?? []).map(normalizeWorkflowCase),
  };
}

function serializeActionBody(action: GovernedAction, body: GovernedActionBody): GovernedActionBody {
  const evidence = body.evidence !== undefined ? { evidence: body.evidence } : {};
  if (action === 'publish') {
    // G-8: supersedesVersionId is sent only on publish.
    return {
      ...(body.supersedesVersionId ? { supersedesVersionId: body.supersedesVersionId } : {}),
      ...evidence,
    };
  }
  if (action === 'reject' || action === 'retire' || action === 'rollback') {
    return {
      ...(body.reasonCode !== undefined ? { reasonCode: body.reasonCode } : {}),
      ...(body.reasonNote !== undefined ? { reasonNote: body.reasonNote } : {}),
      ...evidence,
    };
  }
  return evidence;
}

// Writes send x-idempotency-key; version writes, PATCH and governed actions send If-Match.

// GET /api/tenant/trade/v1/policy-studio/metadata
export async function getMetadata(ctx: TradeContext = {}): Promise<PolicyMetadata> {
  const wire = await tradeHttp().read<WirePolicyMetadata>('/policy-studio/metadata', undefined, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
  return toPolicyMetadata(wire);
}

// GET /api/tenant/trade/v1/policies?page&limit&kind&status&q&sort (or /workflows)
export function listDefinitions(
  domain: GovernedDomain,
  q: ListDefinitionsQuery = {},
  ctx: TradeContext = {},
): Promise<GovernedList<GovernedDefinition>> {
  const query = compactQuery({
    page: q.page,
    limit: q.limit,
    kind: q.kind,
    status: q.status,
    q: q.q,
    sort: q.sort,
  });
  return tradeHttp().read<GovernedList<GovernedDefinition>>(domainBase(domain), query, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
}

// GET /api/tenant/trade/v1/policies/counts?kind&status&q (or /workflows/counts)
export function countDefinitions(
  domain: GovernedDomain,
  q: DefinitionCountsQuery = {},
  ctx: TradeContext = {},
): Promise<GovernedCounts> {
  const query = compactQuery({
    kind: q.kind,
    status: q.status,
    q: q.q,
  });
  return tradeHttp().read<GovernedCounts>(`${domainBase(domain)}/counts`, query, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
}

// GET /api/tenant/trade/v1/policies/:id (or /workflows/:id)
export function getDefinition(
  domain: GovernedDomain,
  id: string,
  ctx: TradeContext = {},
): Promise<GovernedDefinition> {
  return tradeHttp().read<GovernedDefinition>(`${domainBase(domain)}/${encodeSeg(id)}`, undefined, {
    scope: scopeFor(ctx, 'OPTIONAL'),
  });
}

// POST /api/tenant/trade/v1/policies { code, policyKind, scopeTarget } (or /workflows { code, workflowKind, scopeTarget })
export async function createDefinition(
  domain: GovernedDomain,
  input: CreateDefinitionInput,
  opts?: PolicyWriteOptions | string,
  ctx?: TradeContext,
): Promise<GovernedDefinitionRecord> {
  const resolvedOpts = typeof opts === 'string' ? { idempotencyKey: opts } : opts;
  const { key, scope } = resolveWriteMeta(resolvedOpts, undefined, ctx, false);
  const body =
    domain === 'policy'
      ? {
          code: input.code,
          policyKind: (input as { policyKind: string }).policyKind,
          scopeTarget: input.scopeTarget,
        }
      : {
          code: input.code,
          workflowKind: (input as { workflowKind: string }).workflowKind,
          scopeTarget: input.scopeTarget,
        };
  const res = await tradeHttp().write<GovernedDefinitionRecord>('POST', domainBase(domain), body, {
    key,
    scope,
  });
  return res.data;
}

// PATCH /api/tenant/trade/v1/policies/:id { status } (or /workflows/:id)
export async function setDefinitionStatus(
  domain: GovernedDomain,
  id: string,
  status: DefinitionStatus,
  ifMatchOrOpts?: number | PolicyWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<GovernedDefinitionRecord> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    true,
  );
  const res = await tradeHttp().write<GovernedDefinitionRecord>(
    'PATCH',
    `${domainBase(domain)}/${encodeSeg(id)}`,
    { status },
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

// POST /api/tenant/trade/v1/policies/:id/versions (or /workflows/:id/versions); If-Match = definition version
export async function createVersion<
  C extends PolicyContent | WorkflowContent = PolicyContent | WorkflowContent,
  T extends PolicyTestCase | WorkflowTestCase = PolicyTestCase | WorkflowTestCase,
>(
  domain: GovernedDomain,
  defId: string,
  input: CreateGovernedVersionInput<C, T>,
  ifMatchOrOpts?: number | PolicyWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<GovernedVersionRecord<C, T>> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    true,
  );
  const body = {
    content: sanitizeContent(domain, input.content),
    testCases: sanitizeTestCases(domain, input.testCases),
    effectiveFrom: input.effectiveFrom,
    ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
  };
  const res = await tradeHttp().write<GovernedVersionRecord<C, T>>(
    'POST',
    `${domainBase(domain)}/${encodeSeg(defId)}/versions`,
    body,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

// GET /api/tenant/trade/v1/policy-versions/:id (or /workflow-versions/:id)
export async function getVersion(
  domain: GovernedDomain,
  id: string,
  ctx: TradeContext = {},
): Promise<GovernedVersionDetail> {
  const detail = await tradeHttp().read<GovernedVersionDetail>(
    `${versionBase(domain)}/${encodeSeg(id)}`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  if (domain === 'workflow' && detail.evidence?.test?.cases) {
    return {
      ...detail,
      evidence: {
        ...detail.evidence,
        test: {
          ...detail.evidence.test,
          cases: detail.evidence.test.cases.map((c) =>
            normalizeWorkflowCase(c as unknown as WireWorkflowTestCaseResult),
          ),
        },
      },
    };
  }
  return detail;
}

// PATCH /api/tenant/trade/v1/policy-versions/:id (or /workflow-versions/:id)
export async function updateVersion(
  domain: GovernedDomain,
  id: string,
  input: UpdateGovernedVersionInput,
  ifMatchOrOpts?: number | PolicyWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<GovernedVersionRecord> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    true,
  );
  const body = {
    ...(input.content !== undefined ? { content: sanitizeContent(domain, input.content) } : {}),
    ...(input.testCases !== undefined
      ? { testCases: sanitizeTestCases(domain, input.testCases) }
      : {}),
    ...(input.effectiveFrom !== undefined ? { effectiveFrom: input.effectiveFrom } : {}),
    ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo } : {}),
  };
  const res = await tradeHttp().write<GovernedVersionRecord>(
    'PATCH',
    `${versionBase(domain)}/${encodeSeg(id)}`,
    body,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

// DELETE /api/tenant/trade/v1/policy-versions/:id (or /workflow-versions/:id)
export async function deleteVersion(
  domain: GovernedDomain,
  id: string,
  ifMatchOrOpts?: number | PolicyWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<GovernedDeleteResult> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    true,
  );
  const res = await tradeHttp().write<GovernedDeleteResult>(
    'DELETE',
    `${versionBase(domain)}/${encodeSeg(id)}`,
    undefined,
    { key, ifMatch: ifMatchHeader, scope },
  );
  return res.data;
}

// POST /api/tenant/trade/v1/policy-versions/:id/:action (or /workflow-versions/:id/:action)
export async function runAction(
  domain: GovernedDomain,
  id: string,
  action: GovernedAction,
  body: GovernedActionBody = {},
  ifMatchOrOpts?: number | PolicyWriteOptions,
  idempotencyKey?: string,
  ctx?: TradeContext,
): Promise<GovernedValidateResult | PolicyTestResult | WorkflowTestResult | GovernedVersionRecord> {
  const { key, ifMatchHeader, scope } = resolveWriteMeta(
    ifMatchOrOpts,
    idempotencyKey,
    ctx,
    true,
  );
  const payload = serializeActionBody(action, body);
  const res = await tradeHttp().write<
    GovernedValidateResult | PolicyTestResult | WorkflowTestResult | GovernedVersionRecord
  >(
    'POST',
    `${versionBase(domain)}/${encodeSeg(id)}/${encodeSeg(action)}`,
    payload,
    { key, ifMatch: ifMatchHeader, scope },
  );
  if (domain === 'workflow' && action === 'test') {
    return normalizeWorkflowTestResult(
      res.data as unknown as Omit<WorkflowTestResult, 'cases'> & {
        cases: WireWorkflowTestCaseResult[];
      },
    );
  }
  return res.data;
}

// GET /api/tenant/trade/v1/decisions/:id
export async function getDecision(id: string, ctx: TradeContext = {}): Promise<DecisionReceipt> {
  const wire = await tradeHttp().read<WireDecisionReceipt>(
    `/decisions/${encodeSeg(id)}`,
    undefined,
    { scope: scopeFor(ctx, 'OPTIONAL') },
  );
  return toDecision(wire);
}

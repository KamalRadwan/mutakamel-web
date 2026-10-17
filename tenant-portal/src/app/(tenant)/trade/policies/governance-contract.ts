import type { TradePath } from "@/lib/api/envelope";
import {
  GOVERNED_CODE_PATTERN,
  isBoundedInteger,
  isMemberOf,
  isNonEmptyString,
  isTimestamp,
  isUuidV7,
  parseTradeOffsetPage,
  record,
  type TradeOffsetPage,
} from "../trade-advanced-validation";

// The governed-version ladder, shared by policies and workflows.
//
// `PolicyStudioController` serves both families with one adapter and one set
// of permissions — **`trade.policy.*`**. There is no `trade.workflow.*`
// permission anywhere in trade-app, so the two studios cannot be authorized
// apart. `/trade/workflows` imports this vocabulary rather than restating it:
// the two screens read the same backend resource through the same controller.
//
// **A version has no GET.** The ladder exposes nine action routes and a PATCH,
// and the only way to read a version is the `versions[]` array the definition
// list embeds (`projectGovernedVersion` in policy-studio.service.ts). Recorded
// as Q91 — that is why the ladder lives on the list screen rather than behind
// `/trade/policy-versions/:id`.

export const POLICIES_PATH = "/api/tenant/trade/v1/policies";
export const WORKFLOWS_PATH = "/api/tenant/trade/v1/workflows";

// The version and decision prefixes are NOT extracted into constants.
// `/policy-versions`, `/workflow-versions` and `/decisions` are not Gateway
// routes on their own — only `.../:id` and `.../:id/<action>` exist — and a
// bare prefix constant reads as a fabricated endpoint to
// `scripts/docs/verify-called-routes.mjs`. Writing each path as one literal
// keeps the checker able to see the real route.

export const POLICY_READ_PERMISSION = "trade.policy.read";
export const POLICY_MANAGE_PERMISSION = "trade.policy.manage";
const POLICY_TEST_PERMISSION = "trade.policy.test";
export const POLICY_APPROVE_PERMISSION = "trade.policy.approve";
const POLICY_PUBLISH_PERMISSION = "trade.policy.publish";

export const GOVERNANCE_PAGE_SIZE = 25;
export const GOVERNANCE_REASON_MAX_LENGTH = 240;
const TEST_CASES_MIN = 1;
const TEST_CASES_MAX = 100;

/** Seven states, eight verbs. `SCHEDULED` and `SUPERSEDED` have no action. */
export const GOVERNED_VERSION_STATUSES = [
  "DRAFT",
  "TESTED",
  "APPROVAL_PENDING",
  "SCHEDULED",
  "PUBLISHED",
  "SUPERSEDED",
  "RETIRED",
] as const;

/** `GovernanceListQueryDto.status` filters the DEFINITION, not the version. */
export const DEFINITION_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type DefinitionStatus = (typeof DEFINITION_STATUSES)[number];

export const POLICY_KINDS = [
  "CREDIT",
  "PRICING_GUARD",
  "ORDER_CONFIRMATION",
  "PURCHASE_APPROVAL",
  "INVENTORY_NEGATIVE",
  "INVENTORY_RESERVATION",
  "INVENTORY_OVER_RECEIPT",
] as const;

export const WORKFLOW_KINDS = [
  "QUOTATION",
  "SALES_ORDER",
  "PURCHASE_ORDER",
  "PRICE_PUBLICATION",
  "CONFIGURATION_PUBLICATION",
] as const;

export const GOVERNANCE_SCOPE_TARGETS = ["TENANT", "COMPANY", "BRANCH"] as const;
export type GovernanceScopeTarget = (typeof GOVERNANCE_SCOPE_TARGETS)[number];

export const POLICY_OPERATORS = [
  "EQ",
  "NEQ",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "IN",
  "CONTAINS",
] as const;
export type PolicyOperator = (typeof POLICY_OPERATORS)[number];

export const POLICY_OUTCOMES = [
  "ALLOW",
  "DENY",
  "REQUIRE_APPROVAL",
  "HOLD",
] as const;
export type PolicyOutcome = (typeof POLICY_OUTCOMES)[number];

export const WORKFLOW_ACTIONS = [
  "SUBMIT",
  "APPROVE",
  "REJECT",
  "WITHDRAW",
  "CONFIRM",
  "CANCEL",
  "HOLD",
  "RELEASE",
  "RETRY",
] as const;
export type WorkflowActionVerb = (typeof WORKFLOW_ACTIONS)[number];

export interface PolicyFactDefinition {
  key: string;
  valueType: "string" | "number" | "boolean" | "string[]";
  operators: readonly PolicyOperator[];
  exampleValue: string;
}

export const POLICY_FACT_REGISTRY: readonly PolicyFactDefinition[] = [
  { key: "document.type", valueType: "string", operators: ["EQ", "NEQ", "IN"], exampleValue: '"SALES_ORDER"' },
  { key: "document.totalAmount", valueType: "number", operators: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE"], exampleValue: "50000" },
  { key: "document.requestedDiscountPercent", valueType: "number", operators: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE"], exampleValue: "15" },
  { key: "document.currencyCode", valueType: "string", operators: ["EQ", "NEQ", "IN"], exampleValue: '"SAR"' },
  { key: "document.hasManualPriceOverride", valueType: "boolean", operators: ["EQ", "NEQ"], exampleValue: "true" },
  { key: "document.lineCount", valueType: "number", operators: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE"], exampleValue: "25" },
  { key: "account.creditLimit", valueType: "number", operators: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE"], exampleValue: "100000" },
  { key: "account.currentExposure", valueType: "number", operators: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE"], exampleValue: "85000" },
  { key: "account.overdueBalance", valueType: "number", operators: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE"], exampleValue: "10000" },
  { key: "account.overdueDays", valueType: "number", operators: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE"], exampleValue: "30" },
  { key: "account.creditUtilizationRatio", valueType: "number", operators: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE"], exampleValue: "0.85" },
  { key: "pricing.minimumMarginPercent", valueType: "number", operators: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE"], exampleValue: "12" },
  { key: "pricing.actualMarginPercent", valueType: "number", operators: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE"], exampleValue: "8" },
  { key: "pricing.belowMinimumAllowedPrice", valueType: "boolean", operators: ["EQ", "NEQ"], exampleValue: "true" },
  { key: "inventory.availableQuantity", valueType: "number", operators: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE"], exampleValue: "0" },
  { key: "inventory.projectedOnHand", valueType: "number", operators: ["EQ", "NEQ", "GT", "GTE", "LT", "LTE"], exampleValue: "-1" },
  { key: "actor.roles", valueType: "string[]", operators: ["CONTAINS"], exampleValue: '"SALES_MANAGER"' },
] as const;

/** The nine ladder verbs. `rollback` is the only 201; the rest answer 200. */
export const GOVERNANCE_ACTIONS = [
  "validate",
  "test",
  "submit",
  "approve",
  "reject",
  "publish",
  "retire",
  "rollback",
] as const;
export type GovernanceAction = (typeof GOVERNANCE_ACTIONS)[number];

/** Which grant each verb needs — copied from the controller's decorators. */
export const GOVERNANCE_ACTION_PERMISSION: Record<GovernanceAction, string> = {
  validate: POLICY_TEST_PERMISSION,
  test: POLICY_TEST_PERMISSION,
  submit: POLICY_MANAGE_PERMISSION,
  approve: POLICY_APPROVE_PERMISSION,
  // Rejecting needs the APPROVE grant, not manage.
  reject: POLICY_APPROVE_PERMISSION,
  publish: POLICY_PUBLISH_PERMISSION,
  retire: POLICY_PUBLISH_PERMISSION,
  rollback: POLICY_PUBLISH_PERMISSION,
};

export interface GovernedVersion {
  id: string;
  versionNumber: number;
  version: number;
  status: string;
  contentHash: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  approvedAt: string | null;
  content?: Record<string, unknown> | null;
  testCases?: unknown[] | null;
  createdByUserId?: string | null;
  submittedByUserId?: string | null;
  approvedByUserId?: string | null;
  publishedByUserId?: string | null;
  restoredFromVersionId?: string | null;
  restorationReason?: string | null;
  rejectionReason?: string | null;
  retirementReason?: string | null;
}

export interface GovernedDefinition {
  id: string;
  code: string;
  kind: string;
  scopeTarget: string;
  status: string;
  version: number;
  versions: GovernedVersion[];
}

export type GovernanceFamily = "policy" | "workflow";

export function governanceListPath(
  family: GovernanceFamily,
  page: number,
  kind?: string,
  status?: DefinitionStatus,
): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(GOVERNANCE_PAGE_SIZE) });
  if (kind) query.set("kind", kind);
  if (status) query.set("status", status);
  const base = family === "policy" ? POLICIES_PATH : WORKFLOWS_PATH;
  return `${base}?${query.toString()}` as TradePath;
}

export function governanceCreatePath(family: GovernanceFamily): TradePath {
  return (family === "policy" ? POLICIES_PATH : WORKFLOWS_PATH) as TradePath;
}

export function governanceVersionsPath(family: GovernanceFamily, id: string): TradePath {
  if (!isUuidV7(id)) invalidGovernanceResponse();
  const base = family === "policy" ? POLICIES_PATH : WORKFLOWS_PATH;
  return `${base}/${encodeURIComponent(id)}/versions` as TradePath;
}

export function governanceVersionPath(family: GovernanceFamily, id: string): TradePath {
  if (!isUuidV7(id)) invalidGovernanceResponse();
  const encoded = encodeURIComponent(id);
  return family === "policy"
    ? (`/api/tenant/trade/v1/policy-versions/${encoded}` as TradePath)
    : (`/api/tenant/trade/v1/workflow-versions/${encoded}` as TradePath);
}

export function governanceActionPath(
  family: GovernanceFamily,
  id: string,
  action: GovernanceAction,
): TradePath {
  return `${governanceVersionPath(family, id)}/${action}` as TradePath;
}

export function decisionPath(id: string): TradePath {
  if (!isUuidV7(id)) invalidGovernanceResponse();
  return `/api/tenant/trade/v1/decisions/${encodeURIComponent(id)}` as TradePath;
}

export interface DefinitionFormValues {
  code: string;
  kind: string;
  scopeTarget: GovernanceScopeTarget;
}

export function emptyDefinitionForm(family: GovernanceFamily): DefinitionFormValues {
  return {
    code: "",
    kind: family === "policy" ? POLICY_KINDS[0] : WORKFLOW_KINDS[0],
    scopeTarget: "COMPANY",
  };
}

export function buildCreateDefinitionRequest(
  family: GovernanceFamily,
  values: DefinitionFormValues,
): Record<string, string> {
  const code = values.code.trim().toUpperCase();
  if (!GOVERNED_CODE_PATTERN.test(code)) throw new Error("GOVERNANCE_FORM_CODE");
  const kinds: readonly string[] = family === "policy" ? POLICY_KINDS : WORKFLOW_KINDS;
  if (!kinds.includes(values.kind)) throw new Error("GOVERNANCE_FORM_KIND");
  return family === "policy"
    ? { code, policyKind: values.kind, scopeTarget: values.scopeTarget }
    : { code, workflowKind: values.kind, scopeTarget: values.scopeTarget };
}

export interface VersionFormValues {
  content: string;
  testCases: string;
  effectiveFrom: string;
  effectiveTo: string;
}

export const EMPTY_VERSION_FORM: VersionFormValues = {
  content: "{}",
  testCases: "[]",
  effectiveFrom: "",
  effectiveTo: "",
};

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("GOVERNANCE_FORM_CONTENT");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("GOVERNANCE_FORM_CONTENT");
  }
}

/**
 * `CreateGovernedVersionDto.testCases` is **1–100 and required**.
 *
 * A version cannot be created without at least one test case, so the editor
 * collects them before the first save rather than after — an empty array is a
 * 400 from the pipe, not a draft the server will hold.
 */
function parseTestCases(raw: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOVERNANCE_FORM_TEST_CASES");
  }
  if (!Array.isArray(parsed) || parsed.length < TEST_CASES_MIN || parsed.length > TEST_CASES_MAX) {
    throw new Error("GOVERNANCE_FORM_TEST_CASES");
  }
  return parsed;
}

function isoInstant(value: string): string {
  const parsed = new Date(value);
  if (value.trim().length === 0 || Number.isNaN(parsed.getTime())) {
    throw new Error("GOVERNANCE_FORM_DATE");
  }
  return parsed.toISOString();
}

export function buildCreateVersionRequest(values: VersionFormValues): {
  content: Record<string, unknown>;
  testCases: unknown[];
  effectiveFrom: string;
  effectiveTo?: string;
} {
  const request = {
    content: parseJsonObject(values.content),
    testCases: parseTestCases(values.testCases),
    effectiveFrom: isoInstant(values.effectiveFrom),
  };
  return values.effectiveTo.trim().length > 0
    ? { ...request, effectiveTo: isoInstant(values.effectiveTo) }
    : request;
}

/**
 * `UpdateGovernedVersionDto` (`PATCH /policy-versions/:id` and `PATCH /workflow-versions/:id`).
 * Editable only while the version is in `DRAFT` or `REJECTED`.
 */
export function buildUpdateVersionRequest(values: VersionFormValues): {
  content?: Record<string, unknown>;
  testCases?: unknown[];
  effectiveFrom?: string;
  effectiveTo?: string | null;
} {
  return {
    content: parseJsonObject(values.content),
    testCases: parseTestCases(values.testCases),
    effectiveFrom: isoInstant(values.effectiveFrom),
    effectiveTo: values.effectiveTo.trim().length > 0 ? isoInstant(values.effectiveTo) : null,
  };
}

export interface PolicyVisualRuleDraft {
  code: string;
  priority: string;
  fact: string;
  operator: PolicyOperator;
  value: string;
  outcome: PolicyOutcome;
  reasonCode: string;
}

export interface PolicyVisualTestCaseDraft {
  code: string;
  factsJson: string;
  expectedOutcome: PolicyOutcome;
  expectedRuleCode: string;
}

export const EMPTY_POLICY_VISUAL_RULE: PolicyVisualRuleDraft = {
  code: "RULE_01",
  priority: "100",
  fact: "document.totalAmount",
  operator: "GT",
  value: "50000",
  outcome: "REQUIRE_APPROVAL",
  reasonCode: "HIGH_VALUE_APPROVAL",
};

export const EMPTY_POLICY_VISUAL_TEST: PolicyVisualTestCaseDraft = {
  code: "TC_01",
  factsJson: '{"document.totalAmount": 75000}',
  expectedOutcome: "REQUIRE_APPROVAL",
  expectedRuleCode: "RULE_01",
};

export function serializePolicyVisualDraft(
  defaultOutcome: PolicyOutcome,
  rules: PolicyVisualRuleDraft[],
  testCases: PolicyVisualTestCaseDraft[],
): { content: string; testCases: string } {
  const compiledRules = rules.map((r) => {
    const factMeta = POLICY_FACT_REGISTRY.find((f) => f.key === r.fact);
    let parsedVal: unknown = r.value.trim();
    if (factMeta?.valueType === "number") {
      const n = Number(r.value.trim());
      parsedVal = Number.isFinite(n) ? n : 0;
    } else if (factMeta?.valueType === "boolean") {
      parsedVal = r.value.trim().toLowerCase() === "true";
    } else if (r.operator === "IN") {
      parsedVal = r.value
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      parsedVal = r.value.trim().replace(/^["']|["']$/g, "");
    }
    return {
      code: r.code.trim().toUpperCase() || "RULE_01",
      priority: Number.isSafeInteger(Number(r.priority)) ? Number(r.priority) : 100,
      when: {
        all: [
          {
            fact: r.fact,
            operator: r.operator,
            value: parsedVal,
          },
        ],
      },
      outcome: r.outcome,
      reasonCode: r.reasonCode.trim().toUpperCase() || "POLICY_RULE_MATCHED",
    };
  });

  const compiledTests = testCases.map((tc) => {
    let factsObj: Record<string, unknown> = {};
    try {
      const parsed: unknown = JSON.parse(tc.factsJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        factsObj = parsed as Record<string, unknown>;
      }
    } catch {
      factsObj = {};
    }
    return {
      code: tc.code.trim().toUpperCase() || "TC_01",
      facts: factsObj,
      expectedOutcome: tc.expectedOutcome,
      ...(tc.expectedRuleCode.trim()
        ? { expectedRuleCode: tc.expectedRuleCode.trim().toUpperCase() }
        : {}),
    };
  });

  return {
    content: JSON.stringify({ defaultOutcome, rules: compiledRules }, null, 2),
    testCases: JSON.stringify(compiledTests, null, 2),
  };
}

export interface WorkflowVisualTransitionDraft {
  code: string;
  from: string;
  action: WorkflowActionVerb;
  to: string;
  requiresApproval: boolean;
}

export interface WorkflowVisualTestCaseDraft {
  code: string;
  startState: string;
  actionsCsv: string;
  expectedState: string;
}

export const EMPTY_WORKFLOW_VISUAL_TRANSITION: WorkflowVisualTransitionDraft = {
  code: "TR_SUBMIT",
  from: "DRAFT",
  action: "SUBMIT",
  to: "PENDING_APPROVAL",
  requiresApproval: true,
};

export const EMPTY_WORKFLOW_VISUAL_TEST: WorkflowVisualTestCaseDraft = {
  code: "TC_HAPPY_PATH",
  startState: "DRAFT",
  actionsCsv: "SUBMIT, APPROVE, CONFIRM",
  expectedState: "CONFIRMED",
};

export interface WorkflowGraphValidationReport {
  valid: boolean;
  unreachableStates: string[];
  terminalOutgoingTransitions: string[];
  duplicateTransitionKeys: string[];
}

export function validateWorkflowGraphClient(
  statesCsv: string,
  initialState: string,
  terminalStatesCsv: string,
  transitions: WorkflowVisualTransitionDraft[],
): WorkflowGraphValidationReport {
  const states = statesCsv
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const init = initialState.trim().toUpperCase();
  const terminals = new Set(
    terminalStatesCsv
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );

  const reachable = new Set<string>();
  const queue: string[] = init ? [init] : [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (reachable.has(curr)) continue;
    reachable.add(curr);
    for (const tr of transitions) {
      if (tr.from.trim().toUpperCase() === curr) {
        const next = tr.to.trim().toUpperCase();
        if (next && !reachable.has(next)) {
          queue.push(next);
        }
      }
    }
  }

  const unreachableStates = states.filter((st) => !reachable.has(st));
  const terminalOutgoingTransitions: string[] = [];
  const seenKeys = new Set<string>();
  const duplicateTransitionKeys: string[] = [];

  for (const tr of transitions) {
    const from = tr.from.trim().toUpperCase();
    const action = tr.action;
    if (terminals.has(from)) {
      terminalOutgoingTransitions.push(`${tr.code || from} (${from} -> ${tr.to.trim().toUpperCase()})`);
    }
    const key = `${from}:${action}`;
    if (seenKeys.has(key)) {
      duplicateTransitionKeys.push(key);
    }
    seenKeys.add(key);
  }

  return {
    valid:
      unreachableStates.length === 0 &&
      terminalOutgoingTransitions.length === 0 &&
      duplicateTransitionKeys.length === 0,
    unreachableStates,
    terminalOutgoingTransitions,
    duplicateTransitionKeys,
  };
}

export function serializeWorkflowVisualDraft(
  statesCsv: string,
  initialState: string,
  terminalStatesCsv: string,
  transitions: WorkflowVisualTransitionDraft[],
  testCases: WorkflowVisualTestCaseDraft[],
): { content: string; testCases: string } {
  const states = statesCsv
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const terminalStates = terminalStatesCsv
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const compiledTransitions = transitions.map((tr) => ({
    code: tr.code.trim().toUpperCase() || "TR_01",
    from: tr.from.trim().toUpperCase(),
    action: tr.action,
    to: tr.to.trim().toUpperCase(),
    requiresApproval: tr.requiresApproval,
  }));
  const compiledTests = testCases.map((tc) => ({
    code: tc.code.trim().toUpperCase() || "TC_01",
    startState: tc.startState.trim().toUpperCase() || initialState.trim().toUpperCase(),
    actions: tc.actionsCsv
      .split(",")
      .map((a) => a.trim().toUpperCase())
      .filter(Boolean),
    expectedState: tc.expectedState.trim().toUpperCase(),
  }));

  return {
    content: JSON.stringify(
      {
        states,
        initialState: initialState.trim().toUpperCase(),
        terminalStates,
        transitions: compiledTransitions,
      },
      null,
      2,
    ),
    testCases: JSON.stringify(compiledTests, null, 2),
  };
}

/** `GovernanceActionDto` — both fields optional, on all nine actions. */
export function buildGovernanceActionRequest(reason: string): { reason?: string } {
  const trimmed = reason.trim();
  if (trimmed.length === 0) return {};
  if (trimmed.length > GOVERNANCE_REASON_MAX_LENGTH) throw new Error("GOVERNANCE_FORM_REASON");
  return { reason: trimmed };
}

export function parseGovernanceListResponse(
  payload: unknown,
  family: GovernanceFamily,
): TradeOffsetPage<GovernedDefinition> {
  return parseTradeOffsetPage(
    payload,
    (entry) => parseGovernedDefinition(entry, family),
    invalidGovernanceResponse,
  );
}

function parseGovernedDefinition(
  payload: unknown,
  family: GovernanceFamily,
): GovernedDefinition {
  const row = record(payload);
  const kind = row?.[family === "policy" ? "policyKind" : "workflowKind"];
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.code, 100) ||
    !isNonEmptyString(kind, 40) ||
    !isNonEmptyString(row.scopeTarget, 16) ||
    !isNonEmptyString(row.status, 24) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER)
  ) {
    invalidGovernanceResponse();
  }
  return {
    id: row.id,
    code: row.code,
    kind,
    scopeTarget: row.scopeTarget,
    status: row.status,
    version: row.version,
    versions: Array.isArray(row.versions) ? row.versions.map(parseGovernedVersion) : [],
  };
}

function parseGovernedVersion(payload: unknown): GovernedVersion {
  const row = record(payload);
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isBoundedInteger(row.versionNumber, 1, Number.MAX_SAFE_INTEGER) ||
    !isBoundedInteger(row.version, 0, Number.MAX_SAFE_INTEGER) ||
    !isNonEmptyString(row.status, 24) ||
    !isNonEmptyString(row.contentHash, 128) ||
    !isTimestamp(row.effectiveFrom)
  ) {
    invalidGovernanceResponse();
  }
  const contentObj = record(row.content);
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    version: row.version,
    status: row.status,
    contentHash: row.contentHash,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: isTimestamp(row.effectiveTo) ? row.effectiveTo : null,
    approvedAt: isTimestamp(row.approvedAt) ? row.approvedAt : null,
    ...(contentObj ? { content: contentObj } : {}),
    ...(Array.isArray(row.testCases) ? { testCases: row.testCases } : {}),
    ...(typeof row.createdByUserId === "string" ? { createdByUserId: row.createdByUserId } : {}),
    ...(typeof row.submittedByUserId === "string" ? { submittedByUserId: row.submittedByUserId } : {}),
    ...(typeof row.approvedByUserId === "string" ? { approvedByUserId: row.approvedByUserId } : {}),
    ...(typeof row.publishedByUserId === "string" ? { publishedByUserId: row.publishedByUserId } : {}),
    ...(typeof row.restoredFromVersionId === "string"
      ? { restoredFromVersionId: row.restoredFromVersionId }
      : {}),
    ...(typeof row.restorationReason === "string" ? { restorationReason: row.restorationReason } : {}),
    ...(typeof row.rejectionReason === "string" ? { rejectionReason: row.rejectionReason } : {}),
    ...(typeof row.retirementReason === "string" ? { retirementReason: row.retirementReason } : {}),
  };
}

export interface DecisionReceipt {
  id: string;
  decisionType: string;
  aggregateType: string;
  aggregateId: string;
  scopeTarget: string;
  outcome: string | null;
  explanation: string | null;
  evaluatedAt: string;
  correlationId: string | null;
  inputFingerprint?: string | null;
  inputs?: Record<string, unknown> | null;
  matchedRules?: unknown[] | null;
  explanations?: string[] | null;
}

export function parseDecisionReceipt(payload: unknown): DecisionReceipt {
  const row = record(payload);
  const result = row ? record(row.result) : null;
  const resolvedId = row && isUuidV7(row.id) ? row.id : row && isUuidV7(row.decisionId) ? row.decisionId : null;
  const resolvedAggregateType =
    row && isNonEmptyString(row.aggregateType, 64)
      ? row.aggregateType
      : row && isNonEmptyString(row.subjectType, 64)
        ? row.subjectType
        : null;
  const resolvedScopeTarget =
    row && isNonEmptyString(row.scopeTarget, 16) ? row.scopeTarget : "COMPANY";
  const resolvedEvaluatedAt =
    row && isTimestamp(row.evaluatedAt)
      ? row.evaluatedAt
      : row && isTimestamp(row.createdAt)
        ? row.createdAt
        : null;

  if (
    !row ||
    !resolvedId ||
    !isNonEmptyString(row.decisionType, 40) ||
    !resolvedAggregateType ||
    !resolvedEvaluatedAt
  ) {
    invalidGovernanceResponse();
  }
  const resolvedAggregateId = isUuidV7(row.aggregateId)
    ? row.aggregateId
    : isUuidV7(row.subjectId)
      ? row.subjectId
      : "";
  const resolvedOutcome =
    result && typeof result.outcome === "string"
      ? result.outcome
      : typeof row.outcome === "string"
        ? row.outcome
        : null;
  const explanationsList = Array.isArray(row.explanations)
    ? row.explanations.filter((item): item is string => typeof item === "string")
    : undefined;
  const inputsObj = record(row.inputs);

  return {
    id: resolvedId,
    decisionType: row.decisionType,
    aggregateType: resolvedAggregateType,
    aggregateId: resolvedAggregateId,
    scopeTarget: resolvedScopeTarget,
    outcome: resolvedOutcome,
    explanation:
      typeof row.explanation === "string"
        ? row.explanation
        : explanationsList && explanationsList.length > 0
          ? explanationsList.join(" • ")
          : null,
    evaluatedAt: resolvedEvaluatedAt,
    correlationId: typeof row.correlationId === "string" ? row.correlationId : null,
    ...(typeof row.inputFingerprint === "string" ? { inputFingerprint: row.inputFingerprint } : {}),
    ...(inputsObj ? { inputs: inputsObj } : {}),
    ...(Array.isArray(row.matchedRules) ? { matchedRules: row.matchedRules } : {}),
    ...(explanationsList ? { explanations: explanationsList } : {}),
  };
}

export function isDefinitionStatus(value: unknown): value is DefinitionStatus {
  return isMemberOf(value, DEFINITION_STATUSES);
}

function invalidGovernanceResponse(): never {
  throw new Error("Invalid Trade governance response.");
}

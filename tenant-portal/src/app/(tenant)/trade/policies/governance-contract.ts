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
type GovernanceScopeTarget = (typeof GOVERNANCE_SCOPE_TARGETS)[number];

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
  return {
    id: row.id,
    versionNumber: row.versionNumber,
    version: row.version,
    status: row.status,
    contentHash: row.contentHash,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: isTimestamp(row.effectiveTo) ? row.effectiveTo : null,
    approvedAt: isTimestamp(row.approvedAt) ? row.approvedAt : null,
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
}

export function parseDecisionReceipt(payload: unknown): DecisionReceipt {
  const row = record(payload);
  const result = row ? record(row.result) : null;
  if (
    !row ||
    !isUuidV7(row.id) ||
    !isNonEmptyString(row.decisionType, 40) ||
    !isNonEmptyString(row.aggregateType, 64) ||
    !isNonEmptyString(row.scopeTarget, 16) ||
    !isTimestamp(row.evaluatedAt)
  ) {
    invalidGovernanceResponse();
  }
  return {
    id: row.id,
    decisionType: row.decisionType,
    aggregateType: row.aggregateType,
    aggregateId: isUuidV7(row.aggregateId) ? row.aggregateId : "",
    scopeTarget: row.scopeTarget,
    outcome: result && typeof result.outcome === "string" ? result.outcome : null,
    explanation: typeof row.explanation === "string" ? row.explanation : null,
    evaluatedAt: row.evaluatedAt,
    correlationId: typeof row.correlationId === "string" ? row.correlationId : null,
  };
}

export function isDefinitionStatus(value: unknown): value is DefinitionStatus {
  return isMemberOf(value, DEFINITION_STATUSES);
}

function invalidGovernanceResponse(): never {
  throw new Error("Invalid Trade governance response.");
}

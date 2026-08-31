import type { TradePath } from "@/lib/api/envelope";
import {
  isJsonObject,
  isNonEmptyString,
  isRowVersion,
  isTimestamp,
  isUuidV7,
  parseTradePage,
  record,
  type TradePage,
} from "../trade-validation";

// docs/api/trade-foundation.md#configuration--9-routes, verified against
// trade-app/src/modules/configuration-scope/*.ts and pricing.controller.ts.
//
// Nine routes, two modules, two features, two permission families:
//
//   /configuration/definitions*, /configuration/versions/*  trade.policy_studio
//   /configuration/resolve                                  any MVP feature
//   /configuration/company-default-price-books/*            trade.pricing
//
// `POST /versions/:id/publish` is the only route in Trade where a
// `trade.configuration.*` resource is published with a `trade.policy.publish`
// grant — full configuration-manage rights do NOT include publishing.

// Every path is written out in full rather than composed from a shared
// `/configuration` prefix: that prefix is not itself a route, and
// `pnpm docs:verify-called-routes` reads string literals, so a bare prefix
// constant reports as a fabricated endpoint.
export const DEFINITIONS_PATH = "/api/tenant/trade/v1/configuration/definitions" as TradePath;
export const RESOLVE_PATH = "/api/tenant/trade/v1/configuration/resolve" as TradePath;
export const DEFINITION_PAGE_SIZE = 25;

/** `^trade\.[a-z0-9][a-z0-9_.-]{1,110}$`. */
const DEFINITION_KEY_PATTERN = /^trade\.[a-z0-9][a-z0-9_.-]{1,110}$/u;
const CURRENCY_PATTERN = /^[A-Z]{3}$/u;

export const MERGE_STRATEGIES = [
  "OVERRIDE",
  "MIN",
  "MAX",
  "UNION",
  "DENY_WINS",
  "FIRST_MATCH",
] as const;
export type MergeStrategy = (typeof MERGE_STRATEGIES)[number];

/** `@IsIn(["LOW","MEDIUM","HIGH","CRITICAL"])` — an inline list, not an enum. */
export const RISK_CLASSES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type RiskClass = (typeof RISK_CLASSES)[number];

export const CONFIGURATION_SCOPES = ["TENANT", "COMPANY", "BRANCH"] as const;
export type ConfigurationScope = (typeof CONFIGURATION_SCOPES)[number];

/** `GovernedVersionStatus`. */
const VERSION_STATUSES = [
  "DRAFT",
  "TESTED",
  "APPROVAL_PENDING",
  "SCHEDULED",
  "PUBLISHED",
  "SUPERSEDED",
  "RETIRED",
] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export const PRICE_BOOK_PURPOSES = ["SALES", "PURCHASE"] as const;
export type PriceBookPurpose = (typeof PRICE_BOOK_PURPOSES)[number];

export const DEFINITION_NOT_FOUND_CODE = "TRADE.CONFIGURATION.DEFINITION_NOT_FOUND";
export const DEFINITION_KEY_TAKEN_CODE = "TRADE.CONFIGURATION.KEY_TAKEN";
export const DEFINITION_INVALID_CODE = "TRADE.CONFIGURATION.DEFINITION_INVALID";
export const SCOPE_FORBIDDEN_CODE = "TRADE.CONFIGURATION.SCOPE_FORBIDDEN";
export const VALUE_INVALID_CODE = "TRADE.CONFIGURATION.VALUE_INVALID";
export const EFFECTIVE_OVERLAP_CODE = "TRADE.CONFIGURATION.EFFECTIVE_OVERLAP";
/** **409**, not 422. */
export const TEST_FAILED_CODE = "TRADE.CONFIGURATION.TEST_FAILED";
export const PUBLISH_NOT_ALLOWED_CODE = "TRADE.CONFIGURATION.PUBLISH_NOT_ALLOWED";
export const MAKER_CHECKER_CODE = "TRADE.APPROVAL.MAKER_CHECKER_REQUIRED";
export const DEFAULT_PRICE_BOOK_NOT_FOUND_CODE =
  "TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_NOT_FOUND";
export const DEFAULT_PRICE_BOOK_INCOMPATIBLE_CODE =
  "TRADE.CONFIGURATION.DEFAULT_PRICE_BOOK_INCOMPATIBLE";

export interface ConfigurationVersion {
  id: string;
  versionNumber: number;
  version: number;
  scopeTarget: string;
  value: unknown;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  contentHash: string;
}

export interface ConfigurationDefinition {
  id: string;
  key: string;
  valueSchema: Record<string, unknown>;
  allowedScopes: string[];
  mergeStrategy: string;
  riskClass: string;
  version: number;
  versions: ConfigurationVersion[];
}

export interface DefinitionFormValues {
  key: string;
  valueSchema: string;
  allowedScopes: ConfigurationScope[];
  mergeStrategy: MergeStrategy;
  riskClass: RiskClass;
}

export const EMPTY_DEFINITION_FORM: DefinitionFormValues = {
  key: "trade.",
  valueSchema: "",
  allowedScopes: ["TENANT"],
  mergeStrategy: "OVERRIDE",
  riskClass: "LOW",
};

export interface VersionFormValues {
  scopeTarget: ConfigurationScope;
  value: string;
  effectiveFrom: string;
  effectiveTo: string;
}

export const EMPTY_VERSION_FORM: VersionFormValues = {
  scopeTarget: "TENANT",
  value: "",
  effectiveFrom: "",
  effectiveTo: "",
};

export function isMergeStrategy(value: string): value is MergeStrategy {
  return (MERGE_STRATEGIES as readonly string[]).includes(value);
}

export function isRiskClass(value: string): value is RiskClass {
  return (RISK_CLASSES as readonly string[]).includes(value);
}

export function isConfigurationScope(value: string): value is ConfigurationScope {
  return (CONFIGURATION_SCOPES as readonly string[]).includes(value);
}

export function isVersionStatus(value: string): value is VersionStatus {
  return (VERSION_STATUSES as readonly string[]).includes(value);
}

export function definitionsListPath(page: number): TradePath {
  const query = new URLSearchParams({ page: String(page), limit: String(DEFINITION_PAGE_SIZE) });
  return `${DEFINITIONS_PATH}?${query.toString()}` as TradePath;
}

export function definitionVersionsPath(definitionId: string): TradePath {
  if (!isUuidV7(definitionId)) invalidResponse();
  return `/api/tenant/trade/v1/configuration/definitions/${encodeURIComponent(definitionId)}/versions` as TradePath;
}

/**
 * The action is spelled out per branch rather than interpolated so each path
 * stays a literal the route verifier can match against the Gateway contract.
 */
export function versionActionPath(versionId: string, action: "test" | "publish"): TradePath {
  if (!isUuidV7(versionId)) invalidResponse();
  const id = encodeURIComponent(versionId);
  if (action === "test") {
    return `/api/tenant/trade/v1/configuration/versions/${id}/test` as TradePath;
  }
  return `/api/tenant/trade/v1/configuration/versions/${id}/publish` as TradePath;
}

export function defaultPriceBookPath(
  purpose: PriceBookPurpose,
  currencyCode: string,
): TradePath {
  if (!CURRENCY_PATTERN.test(currencyCode)) throw new Error("PRICE_BOOK_FORM_CURRENCY");
  return `/api/tenant/trade/v1/configuration/company-default-price-books/${purpose}/${currencyCode}` as TradePath;
}

export function defaultPriceBookUpsertPath(
  purpose: PriceBookPurpose,
  currencyCode: string,
): TradePath {
  return `${defaultPriceBookPath(purpose, currencyCode)}/upsert` as TradePath;
}

function parseJsonObject(raw: string, failure: string): Record<string, unknown> {
  try {
    const parsed = record(JSON.parse(raw.trim()) as unknown);
    if (!parsed) throw new Error(failure);
    return parsed;
  } catch {
    throw new Error(failure);
  }
}

export function buildCreateDefinitionRequest(values: DefinitionFormValues) {
  const key = values.key.trim().toLowerCase();
  if (!DEFINITION_KEY_PATTERN.test(key)) throw new Error("DEFINITION_FORM_KEY");
  if (values.allowedScopes.length === 0) throw new Error("DEFINITION_FORM_SCOPES");
  return {
    key,
    valueSchema: parseJsonObject(values.valueSchema, "DEFINITION_FORM_SCHEMA"),
    allowedScopes: [...new Set(values.allowedScopes)],
    mergeStrategy: values.mergeStrategy,
    riskClass: values.riskClass,
  };
}

/**
 * `CreateConfigurationVersionDto`. `value` is `@Allow()` — any JSON, entirely
 * unvalidated at the pipe — so the first thing that checks it is the
 * definition's own `valueSchema`, which answers 422
 * `TRADE.CONFIGURATION.VALUE_INVALID`.
 */
export function buildCreateVersionRequest(values: VersionFormValues) {
  const effectiveFrom = values.effectiveFrom.trim();
  if (!effectiveFrom || Number.isNaN(new Date(effectiveFrom).getTime())) {
    throw new Error("VERSION_FORM_DATE");
  }
  const effectiveTo = values.effectiveTo.trim();
  if (effectiveTo && Number.isNaN(new Date(effectiveTo).getTime())) {
    throw new Error("VERSION_FORM_DATE");
  }
  let value: unknown;
  try {
    value = JSON.parse(values.value.trim() || "null");
  } catch {
    throw new Error("VERSION_FORM_VALUE");
  }
  return {
    scopeTarget: values.scopeTarget,
    value,
    effectiveFrom: new Date(effectiveFrom).toISOString(),
    ...(effectiveTo ? { effectiveTo: new Date(effectiveTo).toISOString() } : {}),
  };
}

export function buildResolveRequest(keys: string, facts: string) {
  const list = keys
    .split(/\r?\n/u)
    .map((key) => key.trim().toLowerCase())
    .filter((key) => key.length > 0);
  if (list.length === 0 || list.length > 100 || list.some((key) => !DEFINITION_KEY_PATTERN.test(key))) {
    throw new Error("RESOLVE_FORM_KEYS");
  }
  const trimmedFacts = facts.trim();
  return {
    keys: [...new Set(list)],
    ...(trimmedFacts ? { facts: parseJsonObject(trimmedFacts, "RESOLVE_FORM_FACTS") } : {}),
  };
}

function parseConfigurationVersion(payload: unknown): ConfigurationVersion {
  const version = record(payload);
  if (
    !version ||
    !isUuidV7(version.id) ||
    typeof version.versionNumber !== "number" ||
    !isRowVersion(version.version) ||
    typeof version.scopeTarget !== "string" ||
    typeof version.status !== "string" ||
    !isTimestamp(version.effectiveFrom) ||
    !isNonEmptyString(version.contentHash, 64)
  ) {
    invalidResponse();
  }
  return {
    id: version.id,
    versionNumber: version.versionNumber,
    version: version.version,
    scopeTarget: version.scopeTarget,
    value: version.value,
    status: version.status,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: isTimestamp(version.effectiveTo) ? (version.effectiveTo as string) : null,
    contentHash: version.contentHash,
  };
}

function parseDefinitionResponse(payload: unknown): ConfigurationDefinition {
  const definition = record(payload);
  if (
    !definition ||
    !isUuidV7(definition.id) ||
    !isNonEmptyString(definition.key, 120) ||
    !isJsonObject(definition.valueSchema) ||
    !Array.isArray(definition.allowedScopes) ||
    typeof definition.mergeStrategy !== "string" ||
    typeof definition.riskClass !== "string" ||
    !isRowVersion(definition.version)
  ) {
    invalidResponse();
  }
  return {
    id: definition.id,
    key: definition.key,
    valueSchema: definition.valueSchema,
    allowedScopes: definition.allowedScopes.filter(
      (scope): scope is string => typeof scope === "string",
    ),
    mergeStrategy: definition.mergeStrategy,
    riskClass: definition.riskClass,
    version: definition.version,
    versions: Array.isArray(definition.versions)
      ? definition.versions.map(parseConfigurationVersion)
      : [],
  };
}

export function parseDefinitionsResponse(payload: unknown): TradePage<ConfigurationDefinition> {
  return parseTradePage(payload, parseDefinitionResponse, invalidResponse);
}

export interface VersionTestReport {
  evidenceId: string;
  passed: boolean;
  diagnostics: string[];
}

export function parseTestReport(payload: unknown): VersionTestReport {
  const report = record(payload);
  if (!report || !isUuidV7(report.evidenceId) || typeof report.passed !== "boolean") {
    invalidResponse();
  }
  return {
    evidenceId: report.evidenceId,
    passed: report.passed,
    diagnostics: Array.isArray(report.diagnostics)
      ? report.diagnostics.filter((line): line is string => typeof line === "string")
      : [],
  };
}

export interface ResolvedConfiguration {
  values: Record<string, unknown>;
  evaluatedAt: string;
}

export function parseResolveResponse(payload: unknown): ResolvedConfiguration {
  const resolved = record(payload);
  if (!resolved || !isJsonObject(resolved.values) || !isTimestamp(resolved.evaluatedAt)) {
    invalidResponse();
  }
  return { values: resolved.values, evaluatedAt: resolved.evaluatedAt as string };
}

export interface DefaultPriceBookMapping {
  id: string;
  purpose: string;
  currencyCode: string;
  priceBookId: string;
  version: number;
}

export function parseDefaultPriceBook(payload: unknown): DefaultPriceBookMapping {
  const mapping = record(payload);
  if (
    !mapping ||
    !isUuidV7(mapping.id) ||
    typeof mapping.purpose !== "string" ||
    typeof mapping.currencyCode !== "string" ||
    !isUuidV7(mapping.priceBookId) ||
    !isRowVersion(mapping.version)
  ) {
    invalidResponse();
  }
  return {
    id: mapping.id,
    purpose: mapping.purpose,
    currencyCode: mapping.currencyCode,
    priceBookId: mapping.priceBookId,
    version: mapping.version,
  };
}

function invalidResponse(): never {
  throw new Error("Invalid Trade configuration response.");
}

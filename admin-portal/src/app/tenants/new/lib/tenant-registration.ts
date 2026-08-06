import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type {
  TenantApplicationCandidate,
  TenantApplicationSelection,
  TenantDatabasePlacementOption,
  TenantProvisioningPlanPreview,
  TenantRegistrationLoadState,
  TenantSubscriptionLine,
  TenantSubscriptionQuote,
  TenantCreateResult,
  TenantIdentityValidationResult,
  TenantIdentityValidationEvidence,
} from "../types";

export const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getTenantRegistrationLoadState({
  permitted,
  isLoading,
  hasError,
  itemCount,
  idle = false,
}: {
  permitted: boolean;
  isLoading: boolean;
  hasError: boolean;
  itemCount: number;
  idle?: boolean;
}): TenantRegistrationLoadState {
  if (idle) return "idle";
  if (isLoading) return "loading";
  if (!permitted) return "forbidden";
  if (hasError) return "error";
  return itemCount > 0 ? "ready" : "empty";
}

export function buildTenantSubscriptionLines(
  candidates: readonly TenantApplicationCandidate[],
  selections: Readonly<Record<string, TenantApplicationSelection>>,
): TenantSubscriptionLine[] {
  return Object.entries(selections)
    .map(([applicationKey, selection]) => {
      const candidate = candidates.find((item) => item.key === applicationKey);
      const tier = candidate?.tiers.find((item) => item.id === selection.tierId);
      if (
        !candidate ||
        !candidate.selectionAllowed ||
        !tier ||
        !Number.isInteger(selection.seats) ||
        selection.seats < 1 ||
        selection.seats > 100_000
      ) {
        return null;
      }
      return {
        applicationId: candidate.applicationId,
        applicationKey: candidate.key,
        applicationName: candidate.name,
        tierId: tier.id,
        tierKey: tier.key,
        tierName: tier.name,
        seats: selection.seats,
      };
    })
    .filter((line): line is TenantSubscriptionLine => line !== null)
    .sort((left, right) =>
      left.applicationKey.localeCompare(right.applicationKey),
    );
}

const TENANT_CREATE_SELECTION_BLOCKERS = new Set([
  "APPLICATION_LIFECYCLE_NOT_ACTIVE",
  "APPLICATION_NOT_PUBLISHED",
  "APPLICATION_NOT_PUBLIC",
  "APPLICATION_NON_BILLABLE",
  "TECHNICAL_READINESS_BLOCKED",
]);
const TENANT_CREATE_READINESS_REASONS = new Set([
  "RUNTIME_TARGET_REQUIRED",
  "COMPONENT_BINDING_REQUIRED",
  "ACTIVE_COMPONENT_REQUIRED",
  "PUBLISHED_RELEASE_REQUIRED",
  "MINIMUM_RELEASE_NOT_SATISFIED",
  "DATABASE_PERMISSION_MANIFEST_REQUIRED",
  "DATABASE_PERMISSION_MANIFEST_INVALID",
]);
const TENANT_CREATE_OPTIONS_KEYS = new Set([
  "contractVersion",
  "applications",
]);
const TENANT_CREATE_APPLICATION_KEYS = new Set([
  "applicationId",
  "key",
  "name",
  "description",
  "rank",
  "commercialMode",
  "technicalDefinitionRevision",
  "selectionAllowed",
  "selectionBlockers",
  "readinessReasons",
  "catalogueReasons",
  "tiers",
]);
const TENANT_CREATE_TIER_KEYS = new Set(["id", "key", "name", "rank"]);
const TENANT_CREATE_CATALOGUE_REASONS = new Set(["ACTIVE_TIER_REQUIRED"]);

export function readTenantCreateOptions(
  payload: unknown,
): TenantApplicationCandidate[] {
  const root = asRecord(payload);
  if (
    !root ||
    !hasOnlyKeys(root, TENANT_CREATE_OPTIONS_KEYS) ||
    root.contractVersion !== 1 ||
    !Array.isArray(root.applications) ||
    root.applications.length > 100
  ) {
    throw new Error("INVALID_TENANT_CREATE_OPTIONS_RESPONSE");
  }

  const applicationIds = new Set<string>();
  const applicationKeys = new Set<string>();
  const tierIds = new Set<string>();
  const parsed = root.applications.map((value) => {
    const application = asRecord(value);
    if (
      !application ||
      !hasOnlyKeys(application, TENANT_CREATE_APPLICATION_KEYS) ||
      !isUuidV7(application.applicationId) ||
      !isApplicationKey(application.key) ||
      !isNonEmptyString(application.name) ||
      (application.description !== null &&
        typeof application.description !== "string") ||
      !isNonNegativeInteger(application.rank) ||
      !["INCLUDED", "SUBSCRIPTION"].includes(
        String(application.commercialMode),
      ) ||
      !isPositiveIntegerString(application.technicalDefinitionRevision) ||
      typeof application.selectionAllowed !== "boolean" ||
      !isStringArrayFromSet(
        application.selectionBlockers,
        TENANT_CREATE_SELECTION_BLOCKERS,
      ) ||
      !isStringArrayFromSet(
        application.readinessReasons,
        TENANT_CREATE_READINESS_REASONS,
      ) ||
      !isStringArrayFromSet(
        application.catalogueReasons,
        TENANT_CREATE_CATALOGUE_REASONS,
      ) ||
      !Array.isArray(application.tiers) ||
      applicationIds.has(application.applicationId) ||
      applicationKeys.has(application.key)
    ) {
      throw new Error("INVALID_TENANT_CREATE_OPTIONS_RESPONSE");
    }

    applicationIds.add(application.applicationId);
    applicationKeys.add(application.key);
    const tiers = application.tiers.map((tierValue) => {
      const tier = asRecord(tierValue);
      if (
        !tier ||
        !hasOnlyKeys(tier, TENANT_CREATE_TIER_KEYS) ||
        !isUuidV7(tier.id) ||
        !isApplicationKey(tier.key) ||
        !isNonEmptyString(tier.name) ||
        !isNonNegativeInteger(tier.rank) ||
        tierIds.has(tier.id)
      ) {
        throw new Error("INVALID_TENANT_CREATE_OPTIONS_RESPONSE");
      }
      tierIds.add(tier.id);
      return {
        id: tier.id,
        key: tier.key,
        name: tier.name,
        rank: tier.rank,
      };
    });

    const selectionBlockers =
      application.selectionBlockers as TenantApplicationCandidate["selectionBlockers"];
    const readinessReasons =
      application.readinessReasons as TenantApplicationCandidate["readinessReasons"];
    const catalogueReasons =
      application.catalogueReasons as TenantApplicationCandidate["catalogueReasons"];
    if (
      (tiers.length === 0) !==
        catalogueReasons.includes("ACTIVE_TIER_REQUIRED") ||
      (application.selectionAllowed &&
        (selectionBlockers.length > 0 ||
          readinessReasons.length > 0 ||
          catalogueReasons.length > 0))
    ) {
      throw new Error("INVALID_TENANT_CREATE_OPTIONS_RESPONSE");
    }

    return {
      applicationId: application.applicationId,
      key: application.key,
      name: application.name,
      description: application.description,
      rank: application.rank,
      commercialMode: application.commercialMode as "INCLUDED" | "SUBSCRIPTION",
      technicalDefinitionRevision: application.technicalDefinitionRevision,
      selectionAllowed: application.selectionAllowed,
      selectionBlockers,
      readinessReasons,
      catalogueReasons,
      tiers,
    };
  });

  return parsed.sort(
    (left, right) =>
      left.rank - right.rank || left.key.localeCompare(right.key),
  );
}

export function readDatabasePlacementOptions(
  payload: unknown,
): TenantDatabasePlacementOption[] {
  const root = asRecord(payload);
  const items = root?.items;
  const total = root?.total;
  if (!Array.isArray(items) || !isNonNegativeInteger(total)) {
    throw new Error("INVALID_DATABASE_PLACEMENT_OPTIONS_RESPONSE");
  }

  const parsed = items.map((value) => {
    const item = asRecord(value);
    if (
      !item ||
      !isUuidV7(item.id) ||
      !isNonEmptyString(item.name) ||
      item.status !== "ACTIVE" ||
      !isNonNegativeInteger(item.currentTenants) ||
      !isPositiveInteger(item.maxTenants) ||
      item.currentTenants >= item.maxTenants ||
      (item.countryName !== undefined && !isNonEmptyString(item.countryName)) ||
      (item.countryIsoCode !== undefined &&
        (typeof item.countryIsoCode !== "string" ||
          !/^[A-Z]{2}$/.test(item.countryIsoCode)))
    ) {
      throw new Error("INVALID_DATABASE_PLACEMENT_OPTIONS_RESPONSE");
    }
    return {
      id: item.id,
      name: item.name,
      status: "ACTIVE" as const,
      ...(typeof item.countryName === "string"
        ? { countryName: item.countryName }
        : {}),
      ...(typeof item.countryIsoCode === "string"
        ? { countryIsoCode: item.countryIsoCode }
        : {}),
      currentTenants: item.currentTenants,
      maxTenants: item.maxTenants,
    };
  });
  if (parsed.length !== total) {
    throw new Error("INVALID_DATABASE_PLACEMENT_OPTIONS_RESPONSE");
  }
  return parsed;
}

export function readProvisioningPlanPreview(
  payload: unknown,
  expectedApplicationKeys: readonly string[],
): TenantProvisioningPlanPreview {
  const preview = payload as Partial<TenantProvisioningPlanPreview> | null;
  const expected = [...new Set(expectedApplicationKeys)].sort();
  if (
    !preview ||
    preview.contractVersion !== 1 ||
    !Array.isArray(preview.selectedApplicationKeys) ||
    preview.selectedApplicationKeys.join(",") !== expected.join(",") ||
    typeof preview.selectionDigest !== "string" ||
    !/^[0-9a-f]{64}$/i.test(preview.selectionDigest) ||
    !Array.isArray(preview.components) ||
    !Array.isArray(preview.steps)
  ) {
    throw new Error("INVALID_TENANT_PROVISIONING_PREVIEW_RESPONSE");
  }
  return preview as TenantProvisioningPlanPreview;
}

export function readSubscriptionQuote(
  payload: unknown,
  expectedLines: readonly TenantSubscriptionLine[],
  expectedBillingCycle: "MONTHLY" | "ANNUAL",
): TenantSubscriptionQuote {
  const quote = payload as Partial<TenantSubscriptionQuote> | null;
  if (
    !quote ||
    !isUuidV7(quote.quoteId) ||
    quote.currencyCode !== "USD" ||
    quote.billingCycle !== expectedBillingCycle ||
    !isNonEmptyString(quote.requestHash) ||
    !isNonEmptyString(quote.pricingRevision) ||
    !isDecimalString(quote.total) ||
    !isDecimalString(quote.totalUsd) ||
    typeof quote.expiresAt !== "string" ||
    Number.isNaN(Date.parse(quote.expiresAt)) ||
    !Array.isArray(quote.items) ||
    quote.items.length !== expectedLines.length
  ) {
    throw new Error("INVALID_SUBSCRIPTION_QUOTE_RESPONSE");
  }

  const expected = new Map(
    expectedLines.map((line) => [
      `${line.applicationId}:${line.tierId}:${line.seats}`,
      true,
    ]),
  );
  for (const item of quote.items) {
    if (
      !isUuidV7(item.moduleId) ||
      !isUuidV7(item.tierId) ||
      !Number.isInteger(item.seats) ||
      !isDecimalString(item.lineTotal) ||
      !isDecimalString(item.lineTotalUsd) ||
      !expected.delete(`${item.moduleId}:${item.tierId}:${item.seats}`)
    ) {
      throw new Error("INVALID_SUBSCRIPTION_QUOTE_RESPONSE");
    }
  }
  if (expected.size > 0) {
    throw new Error("INVALID_SUBSCRIPTION_QUOTE_RESPONSE");
  }
  return quote as TenantSubscriptionQuote;
}

export function shouldRetainTenantCreateIntent(
  error: NormalizedApiError,
): boolean {
  return (
    error.errorCode === "GW.IDEM.IN.FLIGHT" ||
    error.httpStatus >= 500 ||
    error.errorCode === "UNKNOWN_ERROR"
  );
}

const IDENTITY_RESULT_KEYS = new Set(["valid", "fields", "message"]);
const IDENTITY_FIELDS_KEYS = new Set(["name", "companyName"]);
const IDENTITY_FIELD_KEYS = new Set([
  "valid",
  "available",
  "reason",
  "message",
]);
const IDENTITY_REASONS = new Set(["REQUIRED", "TAKEN"]);

export function tenantIdentityFingerprint(name: string, companyName: string) {
  return JSON.stringify([name.trim().toLowerCase(), companyName.trim()]);
}

export function isTenantIdentityEvidenceCurrent(
  evidence: TenantIdentityValidationEvidence | null,
  name: string,
  companyName: string,
): boolean {
  return (
    evidence !== null &&
    evidence.fingerprint === tenantIdentityFingerprint(name, companyName) &&
    evidence.result.valid
  );
}

export function readTenantIdentityValidation(
  payload: unknown,
): TenantIdentityValidationResult {
  const root = asRecord(payload);
  const fields = asRecord(root?.fields);
  if (
    !root ||
    !fields ||
    !hasOnlyKeys(root, IDENTITY_RESULT_KEYS) ||
    !hasOnlyKeys(fields, IDENTITY_FIELDS_KEYS) ||
    typeof root.valid !== "boolean" ||
    !isNonEmptyString(root.message)
  ) {
    throw new Error("INVALID_TENANT_IDENTITY_VALIDATION_RESPONSE");
  }

  const readField = (value: unknown) => {
    const field = asRecord(value);
    if (
      !field ||
      !hasOnlyKeys(field, IDENTITY_FIELD_KEYS) ||
      typeof field.valid !== "boolean" ||
      typeof field.available !== "boolean" ||
      !isNonEmptyString(field.message) ||
      (field.reason !== undefined &&
        (typeof field.reason !== "string" || !IDENTITY_REASONS.has(field.reason)))
    ) {
      throw new Error("INVALID_TENANT_IDENTITY_VALIDATION_RESPONSE");
    }
    return {
      valid: field.valid,
      available: field.available,
      ...(field.reason ? { reason: field.reason as "REQUIRED" | "TAKEN" } : {}),
      message: field.message,
    };
  };

  const name = readField(fields.name);
  const companyName = readField(fields.companyName);
  if (root.valid !== (name.valid && name.available && companyName.valid && companyName.available)) {
    throw new Error("INVALID_TENANT_IDENTITY_VALIDATION_RESPONSE");
  }
  return { valid: root.valid, fields: { name, companyName }, message: root.message };
}

export function readTenantCreateResult(payload: unknown): TenantCreateResult {
  const tenant = asRecord(payload);
  if (!tenant || !isUuidV7(tenant.id) || tenant.status !== "PROVISIONING") {
    throw new Error("INVALID_TENANT_CREATE_RESPONSE");
  }
  return { id: tenant.id, status: "PROVISIONING" };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isApplicationKey(value: unknown): value is string {
  return (
    typeof value === "string" && /^[a-z][a-z0-9_]{0,31}$/.test(value)
  );
}

function isPositiveIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value);
}

function isStringArrayFromSet(
  value: unknown,
  allowed: ReadonlySet<string>,
): value is string[] {
  return (
    Array.isArray(value) &&
    new Set(value).size === value.length &&
    value.every((item) => typeof item === "string" && allowed.has(item))
  );
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isUuidV7(value: unknown): value is string {
  return typeof value === "string" && UUID_V7_PATTERN.test(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value);
}

import { readInitialCreateOptions } from "@/features/admin/subscriptions/initial-commercial/initial-create-options";
import { assertQuoteMatchesRequest, readInitialQuoteRequest } from "@/features/admin/subscriptions/initial-commercial/initial-commercial-request";
import { readInitialQuote } from "@/features/admin/subscriptions/initial-commercial-readers";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import { isAmbiguousWriteOutcome } from "@/shared/api/write-command-recovery";
import { getAllTimezones } from "@/lib/geo/country-data";
import { Country } from "country-state-city";
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

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CanonicalCountrySelection {
  countryName: string;
  countryIsoCode: string;
  callingCode: string;
  timezones: readonly string[];
}

export function getCanonicalCountrySelection(
  countryIsoCode: string,
): CanonicalCountrySelection | null {
  const normalizedCode = countryIsoCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedCode)) return null;
  const country = Country.getCountryByCode(normalizedCode);
  if (!country || country.isoCode !== normalizedCode) return null;
  const timezones = [
    ...new Set(
    (country.timezones ?? [])
        .map((timezone) => timezone.zoneName.trim())
        .filter((timezone) => timezone.length > 0),
    ),
  ];
  const digits = country.phonecode.replace(/[^0-9]/g, "");
  if (!country.name.trim() || !digits || timezones.length === 0) return null;
  return {
    countryName: country.name.trim(),
    countryIsoCode: normalizedCode,
    callingCode: `+${digits}`,
    timezones,
  };
}

let cachedKnownTimezones: ReadonlySet<string> | null = null;

/**
 * Exactly the zones the wizard offers, so nothing selectable is unacceptable.
 *
 * Reading the same list the dropdown renders is the point: an independently
 * written rule is free to drift from it, and this one did — the dropdown was
 * widened to every IANA zone (a tenant can be registered in one country and
 * operate on another country's clock) while the check still demanded one of
 * the selected country's zones. Egypt plus Africa/Accra was offered, chosen,
 * and then refused with an instruction to pick a zone belonging to the
 * country. Core binds neither field to the other.
 */
function knownTimezones(): ReadonlySet<string> {
  cachedKnownTimezones ??= new Set(getAllTimezones());
  return cachedKnownTimezones;
}

export function isCanonicalCountrySelection(input: {
  countryName: string;
  countryIsoCode: string;
  timezone: string;
}): boolean {
  const country = getCanonicalCountrySelection(input.countryIsoCode);
  return Boolean(
    country &&
    input.countryName === country.countryName &&
    knownTimezones().has(input.timezone),
  );
}

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
      const tier = candidate?.tiers.find(
        (item) => item.id === selection.tierId,
      );
      if (
        !candidate ||
        !canSelectTenantApplication(candidate) ||
        !tier ||
        !Number.isInteger(selection.seats) ||
        selection.seats < 1 ||
        selection.seats > 100_000 || !isUuidV7(selection.selectionKey) ||
        selection.addons.some(chosen => {
          const option = candidate.addons.find(addon => addon.addonId === chosen.addonId && addon.definitionVersionId === chosen.definitionVersionId);
          return !option || !option.compatibleTierIds.includes(tier.id) || option.catalogueReasons.length > 0 ||
            !isUuidV7(chosen.selectionKey) || !Number.isInteger(chosen.seats) || chosen.seats < 1 || chosen.seats > selection.seats;
        })
      ) {
        return null;
      }
      return {
        selectionKey: selection.selectionKey,
        addons: selection.addons,
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

/** Display eligibility only. A fresh quote still checks complete commercial authority. */
export function canSelectTenantApplication(candidate: TenantApplicationCandidate): boolean {
  return candidate.tiers.length > 0 && candidate.selectionBlockers.length === 0 && candidate.readinessReasons.length === 0 && candidate.catalogueReasons.length === 0;
}

export function readTenantCreateOptions(payload: unknown): TenantApplicationCandidate[] {
  return readInitialCreateOptions(payload).applications;
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
      (item.countryName !== undefined &&
        item.countryName !== null &&
        !isNonEmptyString(item.countryName)) ||
      (item.countryIsoCode !== undefined &&
        item.countryIsoCode !== null &&
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
    !Array.isArray(preview.applications) ||
    preview.applications.length !== 0 ||
    !Array.isArray(preview.selectedApplicationKeys) ||
    preview.selectedApplicationKeys.join(",") !== expected.join(",") ||
    typeof preview.selectionDigest !== "string" ||
    !/^[0-9a-f]{64}$/i.test(preview.selectionDigest) ||
    !Array.isArray(preview.components) ||
    preview.components.some(component => !component || component.installedReadiness !== null) ||
    !Array.isArray(preview.steps)
  ) {
    throw new Error("INVALID_TENANT_PROVISIONING_PREVIEW_RESPONSE");
  }
  return preview as TenantProvisioningPlanPreview;
}

export function tenantCreationQuoteRequest(lines: readonly TenantSubscriptionLine[], billingCycle: "MONTHLY" | "ANNUAL") {
  return readInitialQuoteRequest({ purpose: "TENANT_CREATION", billingCycle, currencyCode: "USD",
    applications: lines.map(({ selectionKey, applicationId, tierId, seats, addons }) => ({ selectionKey, applicationId, tierId, seats, addons })) });
}

export function readSubscriptionQuote(payload: unknown, expectedLines: readonly TenantSubscriptionLine[], expectedBillingCycle: "MONTHLY" | "ANNUAL"): TenantSubscriptionQuote {
  return assertQuoteMatchesRequest(readInitialQuote(payload), tenantCreationQuoteRequest(expectedLines, expectedBillingCycle));
}

export function shouldRetainTenantCreateIntent(
  error: NormalizedApiError,
): boolean {
  return isAmbiguousWriteOutcome(error);
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
        (typeof field.reason !== "string" ||
          !IDENTITY_REASONS.has(field.reason)))
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
  if (
    root.valid !==
    (name.valid && name.available && companyName.valid && companyName.available)
  ) {
    throw new Error("INVALID_TENANT_IDENTITY_VALIDATION_RESPONSE");
  }
  return {
    valid: root.valid,
    fields: { name, companyName },
    message: root.message,
  };
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

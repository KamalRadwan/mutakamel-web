import {
  TENANT_FQDN_VALIDATION_STATUSES,
  TENANT_OPERATION_STATUSES,
  TENANT_OPERATION_TYPES,
  TENANT_STATUSES,
  type FqdnAvailabilityResult,
  type TenantAddress,
  type TenantDatabaseServerSummary,
  type TenantFqdnView,
  type TenantProfileDraft,
  type TenantProvisioningCommandResult,
  type TenantStorageServerSummary,
  type TenantSubscriptionSummary,
  type TenantView,
  type UpdateTenantProfileDto,
} from "../types";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TENANT_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const SUBSCRIPTION_STATUSES = [
  "TRIAL",
  "PENDING_ACTIVATION",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
] as const;
const ADDRESS_KEYS = [
  "city",
  "state",
  "district",
  "street1",
  "street2",
  "buildingNo",
  "postalCode",
  "landmark",
  "formattedAddress",
] as const;

export function readTenantView(value: unknown): TenantView {
  const tenant = object(value, "INVALID_TENANT_DETAIL_RESPONSE");
  const id = uuidV7(tenant.id, "INVALID_TENANT_DETAIL_RESPONSE");
  const name = requiredString(tenant.name, "INVALID_TENANT_DETAIL_RESPONSE");
  if (!TENANT_NAME_PATTERN.test(name))
    invalid("INVALID_TENANT_DETAIL_RESPONSE");

  const fqdns = array(tenant.fqdns, "INVALID_TENANT_DETAIL_RESPONSE").map(
    readTenantFqdn,
  );
  if (fqdns.filter((row) => row.isPrimary).length > 1) {
    invalid("INVALID_TENANT_DETAIL_RESPONSE");
  }

  const result: TenantView = {
    id,
    name,
    companyName: requiredString(
      tenant.companyName,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    countryName: requiredString(
      tenant.countryName,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    countryIsoCode: countryIso(
      tenant.countryIsoCode,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    industry: optionalNullableString(
      tenant.industry,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    timezone: optionalNullableString(
      tenant.timezone,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    phoneCountryCode: optionalNullableString(
      tenant.phoneCountryCode,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    phone: optionalNullableString(
      tenant.phone,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    address: readAddress(tenant.address, "INVALID_TENANT_DETAIL_RESPONSE"),
    taxNumber: optionalNullableString(
      tenant.taxNumber,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    commercialRegistrationNumber: optionalNullableString(
      tenant.commercialRegistrationNumber,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    ownerEmail: optionalNullableString(
      tenant.ownerEmail,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    ownerFirstName: optionalNullableString(
      tenant.ownerFirstName,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    ownerLastName: optionalNullableString(
      tenant.ownerLastName,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    ownerPhoneCountryCode: optionalNullableString(
      tenant.ownerPhoneCountryCode,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    ownerPhone: optionalNullableString(
      tenant.ownerPhone,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    ownerJobTitle: optionalNullableString(
      tenant.ownerJobTitle,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    ownerLanguage: optionalNullableString(
      tenant.ownerLanguage,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    ownerUsername: optionalNullableString(
      tenant.ownerUsername,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    ownerAccountLinked: boolean(
      tenant.ownerAccountLinked,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    databaseName: requiredString(
      tenant.databaseName,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    status: oneOf(
      tenant.status,
      TENANT_STATUSES,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    createdAt: isoDate(tenant.createdAt, "INVALID_TENANT_DETAIL_RESPONSE"),
    updatedAt: isoDate(tenant.updatedAt, "INVALID_TENANT_DETAIL_RESPONSE"),
    fqdns,
    storageServerId: uuidV7(
      tenant.storageServerId,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
  };

  if (tenant.subscription !== undefined && tenant.subscription !== null) {
    result.subscription = readSubscription(tenant.subscription);
  }
  if (tenant.databaseServer !== undefined && tenant.databaseServer !== null) {
    result.databaseServer = readDatabaseServer(tenant.databaseServer);
  }
  if (tenant.storageServer !== undefined && tenant.storageServer !== null) {
    result.storageServer = readStorageServer(
      tenant.storageServer,
      result.storageServerId,
    );
  }
  return result;
}

export function readTenantFqdn(value: unknown): TenantFqdnView {
  const fqdn = object(value, "INVALID_TENANT_FQDN_RESPONSE");
  return {
    id: uuidV7(fqdn.id, "INVALID_TENANT_FQDN_RESPONSE"),
    fqdn: normalizedFqdn(fqdn.fqdn, "INVALID_TENANT_FQDN_RESPONSE"),
    isPrimary: boolean(fqdn.isPrimary, "INVALID_TENANT_FQDN_RESPONSE"),
    validationStatus: oneOf(
      fqdn.validationStatus,
      TENANT_FQDN_VALIDATION_STATUSES,
      "INVALID_TENANT_FQDN_RESPONSE",
    ),
    verifiedAt: nullableIsoDate(
      fqdn.verifiedAt,
      "INVALID_TENANT_FQDN_RESPONSE",
    ),
    createdAt: isoDate(fqdn.createdAt, "INVALID_TENANT_FQDN_RESPONSE"),
    updatedAt: isoDate(fqdn.updatedAt, "INVALID_TENANT_FQDN_RESPONSE"),
  };
}

export function readTenantFqdnList(value: unknown): TenantFqdnView[] {
  if (!Array.isArray(value) || value.length > 200) {
    throw new Error("INVALID_TENANT_FQDN_LIST_RESPONSE");
  }
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  let primaryCount = 0;
  const result = value.map((item) => {
    const fqdn = readTenantFqdn(item);
    if (seenIds.has(fqdn.id) || seenNames.has(fqdn.fqdn)) {
      throw new Error("INVALID_TENANT_FQDN_LIST_RESPONSE");
    }
    seenIds.add(fqdn.id);
    seenNames.add(fqdn.fqdn);
    if (fqdn.isPrimary) primaryCount += 1;
    return fqdn;
  });
  if (primaryCount > 1) {
    throw new Error("INVALID_TENANT_FQDN_LIST_RESPONSE");
  }
  return result;
}

export function readFqdnAvailability(value: unknown): FqdnAvailabilityResult {
  const result = object(value, "INVALID_FQDN_PREFLIGHT_RESPONSE");
  const valid = boolean(result.valid, "INVALID_FQDN_PREFLIGHT_RESPONSE");
  const available = boolean(
    result.available,
    "INVALID_FQDN_PREFLIGHT_RESPONSE",
  );
  const reason =
    result.reason === undefined
      ? undefined
      : oneOf(
          result.reason,
          ["INVALID_FORMAT", "TAKEN", "DNS_NOT_FOUND", "UNREACHABLE"] as const,
          "INVALID_FQDN_PREFLIGHT_RESPONSE",
        );
  const parsed: FqdnAvailabilityResult = {
    fqdn:
      reason === "INVALID_FORMAT"
        ? normalizedInvalidFqdnCandidate(
            result.fqdn,
            "INVALID_FQDN_PREFLIGHT_RESPONSE",
          )
        : normalizedFqdn(result.fqdn, "INVALID_FQDN_PREFLIGHT_RESPONSE"),
    valid,
    available,
    message: requiredString(result.message, "INVALID_FQDN_PREFLIGHT_RESPONSE"),
  };
  if (result.dnsResolved !== undefined) {
    parsed.dnsResolved = boolean(
      result.dnsResolved,
      "INVALID_FQDN_PREFLIGHT_RESPONSE",
    );
  }
  if (result.reachable !== undefined) {
    parsed.reachable = boolean(
      result.reachable,
      "INVALID_FQDN_PREFLIGHT_RESPONSE",
    );
  }
  if (reason !== undefined) parsed.reason = reason;
  if (
    (reason === undefined && (!valid || !available)) ||
    (reason === "INVALID_FORMAT" && (valid || available)) ||
    (reason === "TAKEN" && (!valid || available)) ||
    ((reason === "DNS_NOT_FOUND" || reason === "UNREACHABLE") &&
      (valid || !available))
  ) {
    invalid("INVALID_FQDN_PREFLIGHT_RESPONSE");
  }
  return parsed;
}

export function readTenantProvisioningCommandResult(
  value: unknown,
): TenantProvisioningCommandResult {
  const result = object(value, "INVALID_TENANT_COMMAND_RESPONSE");
  const operation = object(result.operation, "INVALID_TENANT_COMMAND_RESPONSE");
  const parsed: TenantProvisioningCommandResult = {
    replayed: boolean(result.replayed, "INVALID_TENANT_COMMAND_RESPONSE"),
    operation: {
      id: uuidV7(operation.id, "INVALID_TENANT_COMMAND_RESPONSE"),
      type: oneOf(
        operation.type,
        TENANT_OPERATION_TYPES,
        "INVALID_TENANT_COMMAND_RESPONSE",
      ),
      status: oneOf(
        operation.status,
        TENANT_OPERATION_STATUSES,
        "INVALID_TENANT_COMMAND_RESPONSE",
      ),
    },
  };
  if (operation.tenantId !== undefined) {
    parsed.operation.tenantId = uuidV7(
      operation.tenantId,
      "INVALID_TENANT_COMMAND_RESPONSE",
    );
  }
  if (operation.generation !== undefined) {
    parsed.operation.generation = nonNegativeInteger(
      operation.generation,
      "INVALID_TENANT_COMMAND_RESPONSE",
    );
  }
  if (operation.currentPhase !== undefined) {
    parsed.operation.currentPhase = requiredString(
      operation.currentPhase,
      "INVALID_TENANT_COMMAND_RESPONSE",
    );
  }
  if (operation.updatedAt !== undefined) {
    parsed.operation.updatedAt = isoDate(
      operation.updatedAt,
      "INVALID_TENANT_COMMAND_RESPONSE",
    );
  }
  return parsed;
}

export function isTenantDatabaseReady(tenant: Pick<TenantView, "status">) {
  return tenant.status === "ACTIVE" || tenant.status === "SUSPENDED";
}

export function platformFqdnForTenant(
  tenant: Pick<TenantView, "name">,
): string {
  return `${tenant.name}.mutakamel.ai`;
}

export function hasPlatformPrimaryFqdn(
  tenant: Pick<TenantView, "name" | "fqdns">,
): boolean {
  const platformFqdn = platformFqdnForTenant(tenant);
  return tenant.fqdns.some((row) => row.fqdn === platformFqdn);
}

export function canPromoteLegacyPrimary(
  tenant: Pick<TenantView, "name" | "status" | "fqdns">,
  fqdn: TenantFqdnView,
): boolean {
  return (
    tenant.status === "ACTIVE" &&
    !hasPlatformPrimaryFqdn(tenant) &&
    !fqdn.isPrimary &&
    fqdn.validationStatus === "VALID" &&
    fqdn.verifiedAt !== null
  );
}

export function canAttachAfterPreflight(
  evidence: FqdnAvailabilityResult | null,
): boolean {
  return Boolean(
    evidence?.available &&
    (evidence.valid ||
      evidence.reason === "DNS_NOT_FOUND" ||
      evidence.reason === "UNREACHABLE"),
  );
}

export function createTenantProfileDraft(
  tenant: TenantView,
): TenantProfileDraft {
  return {
    companyName: tenant.companyName,
    countryName: tenant.countryName,
    countryIsoCode: tenant.countryIsoCode,
    industry: tenant.industry,
    timezone: tenant.timezone,
    phoneCountryCode: tenant.phoneCountryCode,
    phone: tenant.phone,
    address: tenant.address ? { ...tenant.address } : null,
    taxNumber: tenant.taxNumber,
    commercialRegistrationNumber: tenant.commercialRegistrationNumber,
  };
}

export function buildUpdateTenantProfileDto(
  draft: TenantProfileDraft,
  expectedUpdatedAt: string,
): UpdateTenantProfileDto {
  const companyName = draft.companyName.trim();
  const countryName = draft.countryName.trim();
  const countryIsoCode = draft.countryIsoCode.trim().toUpperCase();
  if (!companyName || !countryName || !/^[A-Z]{2}$/.test(countryIsoCode)) {
    invalid("INVALID_TENANT_PROFILE_DRAFT");
  }

  return {
    expectedUpdatedAt: isoDate(
      expectedUpdatedAt,
      "INVALID_TENANT_PROFILE_DRAFT",
    ),
    companyName,
    countryName,
    countryIsoCode,
    industry: nullableTrimmed(draft.industry),
    timezone: nullableTrimmed(draft.timezone),
    phoneCountryCode: nullableTrimmed(draft.phoneCountryCode),
    phone: nullableTrimmed(draft.phone),
    address: normalizeAddressDraft(draft.address),
    taxNumber: nullableTrimmed(draft.taxNumber),
    commercialRegistrationNumber: nullableTrimmed(
      draft.commercialRegistrationNumber,
    ),
  };
}

export function replaceTenantFqdn(
  tenant: TenantView,
  fqdn: TenantFqdnView,
): TenantView {
  const existingIndex = tenant.fqdns.findIndex((row) => row.id === fqdn.id);
  const fqdns = [...tenant.fqdns];
  if (existingIndex >= 0) fqdns[existingIndex] = fqdn;
  else fqdns.push(fqdn);
  return { ...tenant, fqdns };
}

function readSubscription(value: unknown): TenantSubscriptionSummary {
  const subscription = object(value, "INVALID_TENANT_DETAIL_RESPONSE");
  return {
    status: oneOf(
      subscription.status,
      SUBSCRIPTION_STATUSES,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    effectiveAllowedUsers: nonNegativeInteger(
      subscription.effectiveAllowedUsers,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    billingCycle: optionalNullableString(
      subscription.billingCycle,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    currencyCode: optionalNullableString(
      subscription.currencyCode,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    totalPrice: nullableDecimal(
      subscription.totalPrice,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    startedAt: isoDate(
      subscription.startedAt,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    currentPeriodStart: nullableIsoDate(
      subscription.currentPeriodStart,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    currentPeriodEnd: isoDate(
      subscription.currentPeriodEnd,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    trialDays: nonNegativeInteger(
      subscription.trialDays,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    trialStartedAt: nullableIsoDate(
      subscription.trialStartedAt,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    trialEndsAt: nullableIsoDate(
      subscription.trialEndsAt,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    activationScheduledAt: nullableIsoDate(
      subscription.activationScheduledAt,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    activatedAt: nullableIsoDate(
      subscription.activatedAt,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    cancelAt: nullableIsoDate(
      subscription.cancelAt,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
  };
}

function readDatabaseServer(value: unknown): TenantDatabaseServerSummary {
  const server = object(value, "INVALID_TENANT_DETAIL_RESPONSE");
  const parsed: TenantDatabaseServerSummary = {
    id: uuidV7(server.id, "INVALID_TENANT_DETAIL_RESPONSE"),
    name: requiredString(server.name, "INVALID_TENANT_DETAIL_RESPONSE"),
    driver: oneOf(
      server.driver,
      ["postgres"] as const,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
    status: oneOf(
      server.status,
      ["DRAFT", "ACTIVE", "DRAINING", "OFFLINE"] as const,
      "INVALID_TENANT_DETAIL_RESPONSE",
    ),
  };
  if (server.countryName !== undefined && server.countryName !== null) {
    parsed.countryName = requiredString(
      server.countryName,
      "INVALID_TENANT_DETAIL_RESPONSE",
    );
  }
  if (server.countryIsoCode !== undefined && server.countryIsoCode !== null) {
    parsed.countryIsoCode = countryIso(
      server.countryIsoCode,
      "INVALID_TENANT_DETAIL_RESPONSE",
    );
  }
  if (server.maxTenants !== undefined) {
    parsed.maxTenants = nonNegativeInteger(
      server.maxTenants,
      "INVALID_TENANT_DETAIL_RESPONSE",
    );
  }
  if (server.currentTenants !== undefined) {
    parsed.currentTenants = nonNegativeInteger(
      server.currentTenants,
      "INVALID_TENANT_DETAIL_RESPONSE",
    );
  }
  return parsed;
}

function readStorageServer(
  value: unknown,
  storageServerId: string,
): TenantStorageServerSummary {
  const server = object(value, "INVALID_TENANT_STORAGE_RESPONSE");
  const id = uuidV7(server.id, "INVALID_TENANT_STORAGE_RESPONSE");
  if (id !== storageServerId) invalid("INVALID_TENANT_STORAGE_RESPONSE");
  return {
    id,
    code: requiredString(server.code, "INVALID_TENANT_STORAGE_RESPONSE"),
    name: requiredString(server.name, "INVALID_TENANT_STORAGE_RESPONSE"),
    region: requiredString(server.region, "INVALID_TENANT_STORAGE_RESPONSE"),
    status: oneOf(
      server.status,
      ["DRAFT", "ACTIVE", "OFFLINE"] as const,
      "INVALID_TENANT_STORAGE_RESPONSE",
    ),
  };
}

function readAddress(value: unknown, code: string): TenantAddress | null {
  if (value === undefined || value === null) return null;
  const source = object(value, code);
  const result: TenantAddress = {};
  for (const key of ADDRESS_KEYS) {
    if (source[key] !== undefined) {
      result[key] = requiredString(source[key], code);
    }
  }
  return result;
}

function normalizeAddressDraft(
  value: TenantAddress | null,
): TenantAddress | null {
  if (value === null) return null;
  const result: TenantAddress = {};
  for (const key of ADDRESS_KEYS) {
    const normalized = value[key]?.trim();
    if (normalized) result[key] = normalized;
  }
  return Object.keys(result).length ? result : null;
}

function nullableTrimmed(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function optionalNullableString(value: unknown, code: string): string | null {
  if (value === undefined || value === null) return null;
  return requiredString(value, code);
}

function nullableDecimal(value: unknown, code: string): string | null {
  if (value === undefined || value === null) return null;
  const decimal = requiredString(value, code);
  if (!DECIMAL_PATTERN.test(decimal)) invalid(code);
  return decimal;
}

function normalizedFqdn(value: unknown, code: string): string {
  const fqdn = requiredString(value, code).toLowerCase();
  if (
    fqdn.length > 253 ||
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(
      fqdn,
    )
  ) {
    invalid(code);
  }
  return fqdn;
}

function normalizedInvalidFqdnCandidate(value: unknown, code: string): string {
  const candidate = requiredString(value, code).toLowerCase();
  if (candidate.length > 253) invalid(code);
  return candidate;
}

function countryIso(value: unknown, code: string): string {
  const iso = requiredString(value, code).toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso)) invalid(code);
  return iso;
}

function uuidV7(value: unknown, code: string): string {
  const uuid = requiredString(value, code);
  if (!UUID_V7_PATTERN.test(uuid)) invalid(code);
  return uuid;
}

function isoDate(value: unknown, code: string): string {
  const date = requiredString(value, code);
  if (!Number.isFinite(Date.parse(date)) || !/^\d{4}-\d{2}-\d{2}T/.test(date)) {
    invalid(code);
  }
  return date;
}

function nullableIsoDate(value: unknown, code: string): string | null {
  return value === undefined || value === null ? null : isoDate(value, code);
}

function nonNegativeInteger(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    invalid(code);
  }
  return value;
}

function boolean(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") invalid(code);
  return value;
}

function requiredString(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) invalid(code);
  return value.trim();
}

function oneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  code: string,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) invalid(code);
  return value as Values[number];
}

function array(value: unknown, code: string): unknown[] {
  if (!Array.isArray(value)) invalid(code);
  return value;
}

function object(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    invalid(code);
  return value as Record<string, unknown>;
}

function invalid(code: string): never {
  throw new Error(code);
}

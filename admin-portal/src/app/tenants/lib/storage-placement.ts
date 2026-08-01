export const TENANT_CREATE_PERMISSION = "admin.tenants.create";
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_SERVER_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "DRAINING",
  "OFFLINE",
] as const;
const STORAGE_AVAILABILITY_CLASSES = [
  "DEGRADED_SINGLE_NODE",
  "SINGLE_NODE_OPERATIONAL",
  "BACKUP_TARGET_OPERATIONAL",
  "HA_PRODUCTION_READY",
] as const;

export interface TenantStoragePlacementOption {
  id: string;
  name: string;
  provider: "GARAGE";
  region: string;
  status: "ACTIVE";
  availabilityClass: "HA_PRODUCTION_READY";
  currentTenants: number;
  retainedTenants: number;
  reservedTenants: number;
  maxTenants: number;
  capacityPercent: number;
  allocatableCapacityBytes: string;
  availableReservationBytes: string;
}

export interface TenantStorageServerSummary {
  id: string;
  name: string;
  provider: "GARAGE";
  region: string;
  status: (typeof STORAGE_SERVER_STATUSES)[number];
  availabilityClass: (typeof STORAGE_AVAILABILITY_CLASSES)[number];
}

export type StoragePlacementState =
  | "loading"
  | "forbidden"
  | "error"
  | "empty"
  | "ready";

export function getStoragePlacementState({
  canCreateTenant,
  isLoading,
  hasError,
  optionCount,
}: {
  canCreateTenant: boolean;
  isLoading: boolean;
  hasError: boolean;
  optionCount: number;
}): StoragePlacementState {
  if (isLoading) return "loading";
  if (!canCreateTenant) return "forbidden";
  if (hasError) return "error";
  return optionCount > 0 ? "ready" : "empty";
}

export function readStoragePlacementOptions(
  payload: unknown,
): TenantStoragePlacementOption[] {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const items = data?.items;
  const total = data?.total;

  if (!Array.isArray(items) || !isNonNegativeInteger(total)) {
    throw new Error("INVALID_STORAGE_PLACEMENT_OPTIONS_RESPONSE");
  }

  const parsed = items.map(readStoragePlacementOption);
  if (total !== parsed.length) {
    throw new Error("INVALID_STORAGE_PLACEMENT_OPTIONS_RESPONSE");
  }

  return parsed;
}

export function sanitizeTenantStoragePlacement<
  Tenant extends Record<string, unknown>,
>(
  tenant: Tenant,
): Tenant & {
  storageServerId: string | null;
  storageServer?: TenantStorageServerSummary;
} {
  const rawStorageServerId = tenant.storageServerId;
  const storageServerId =
    rawStorageServerId === null
      ? null
      : typeof rawStorageServerId === "string" &&
          UUID_V7.test(rawStorageServerId)
        ? rawStorageServerId
        : (() => {
            throw new Error("INVALID_TENANT_STORAGE_PLACEMENT_RESPONSE");
          })();
  const rawSummary = tenant.storageServer;
  const result = {
    ...tenant,
    storageServerId,
  } as Tenant & {
    storageServerId: string | null;
    storageServer?: TenantStorageServerSummary;
  };

  delete result.storageServer;
  if (rawSummary === undefined || rawSummary === null) return result;

  const summary = asRecord(rawSummary);
  if (
    !summary ||
    storageServerId === null ||
    summary.id !== storageServerId ||
    !isNonEmptyString(summary.name) ||
    summary.provider !== "GARAGE" ||
    !isNonEmptyString(summary.region) ||
    !isOneOf(summary.status, STORAGE_SERVER_STATUSES) ||
    !isOneOf(summary.availabilityClass, STORAGE_AVAILABILITY_CLASSES)
  ) {
    throw new Error("INVALID_TENANT_STORAGE_PLACEMENT_RESPONSE");
  }

  result.storageServer = {
    id: summary.id,
    name: summary.name,
    provider: summary.provider,
    region: summary.region,
    status: summary.status,
    availabilityClass: summary.availabilityClass,
  };
  return result;
}

export function formatStorageBytes(value: string): string {
  if (!/^\d+$/.test(value)) return "Unavailable";

  const bytes = BigInt(value);
  const units = [
    { label: "PiB", value: BigInt("1125899906842624") },
    { label: "TiB", value: BigInt("1099511627776") },
    { label: "GiB", value: BigInt("1073741824") },
    { label: "MiB", value: BigInt("1048576") },
    { label: "KiB", value: BigInt("1024") },
  ] as const;

  const unit = units.find((candidate) => bytes >= candidate.value);
  if (!unit) return `${bytes.toString()} B`;

  const whole = bytes / unit.value;
  const fraction = ((bytes % unit.value) * BigInt(10)) / unit.value;
  return `${whole.toString()}.${fraction.toString()} ${unit.label}`;
}

function readStoragePlacementOption(
  value: unknown,
): TenantStoragePlacementOption {
  const item = asRecord(value);
  if (
    !item ||
    typeof item.id !== "string" ||
    !UUID_V7.test(item.id) ||
    !isNonEmptyString(item.name) ||
    item.provider !== "GARAGE" ||
    !isNonEmptyString(item.region) ||
    item.status !== "ACTIVE" ||
    item.availabilityClass !== "HA_PRODUCTION_READY" ||
    !isNonNegativeInteger(item.currentTenants) ||
    !isNonNegativeInteger(item.retainedTenants) ||
    !isNonNegativeInteger(item.reservedTenants) ||
    !isNonNegativeInteger(item.maxTenants) ||
    typeof item.capacityPercent !== "number" ||
    !Number.isFinite(item.capacityPercent) ||
    item.capacityPercent < 0 ||
    item.capacityPercent > 100 ||
    !isDecimalString(item.allocatableCapacityBytes) ||
    !isDecimalString(item.availableReservationBytes)
  ) {
    throw new Error("INVALID_STORAGE_PLACEMENT_OPTIONS_RESPONSE");
  }

  return {
    id: item.id,
    name: item.name,
    provider: item.provider,
    region: item.region,
    status: item.status,
    availabilityClass: item.availabilityClass,
    currentTenants: item.currentTenants,
    retainedTenants: item.retainedTenants,
    reservedTenants: item.reservedTenants,
    maxTenants: item.maxTenants,
    capacityPercent: item.capacityPercent,
    allocatableCapacityBytes: item.allocatableCapacityBytes,
    availableReservationBytes: item.availableReservationBytes,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
): value is Values[number] {
  return typeof value === "string" && values.includes(value);
}

function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

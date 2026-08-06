export const TENANT_CREATE_PERMISSION = "admin.tenants.create";
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_SERVER_STATUSES = ["DRAFT", "ACTIVE", "OFFLINE"] as const;

export interface TenantStoragePlacementOption {
  id: string;
  code: string;
  name: string;
  region: string;
  status: "ACTIVE";
  maxTenants: number | null;
  assignedTenants: number;
}

export interface TenantStorageServerSummary {
  id: string;
  code: string;
  name: string;
  region: string;
  bucketName: string;
  status: (typeof STORAGE_SERVER_STATUSES)[number];
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
    !isNonEmptyString(summary.code) ||
    !isNonEmptyString(summary.region) ||
    !isNonEmptyString(summary.bucketName) ||
    !isOneOf(summary.status, STORAGE_SERVER_STATUSES)
  ) {
    throw new Error("INVALID_TENANT_STORAGE_PLACEMENT_RESPONSE");
  }

  result.storageServer = {
    id: summary.id as string,
    code: summary.code as string,
    name: summary.name as string,
    region: summary.region as string,
    bucketName: summary.bucketName as string,
    status: summary.status as (typeof STORAGE_SERVER_STATUSES)[number],
  };
  return result;
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
    !isNonEmptyString(item.code) ||
    !isNonEmptyString(item.region) ||
    item.status !== "ACTIVE" ||
    !isNonNegativeInteger(item.assignedTenants) ||
    (item.maxTenants !== null && !isNonNegativeInteger(item.maxTenants))
  ) {
    throw new Error("INVALID_STORAGE_PLACEMENT_OPTIONS_RESPONSE");
  }

  return {
    id: item.id,
    code: item.code,
    name: item.name,
    region: item.region,
    status: item.status,
    maxTenants: item.maxTenants as number | null,
    assignedTenants: item.assignedTenants,
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

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

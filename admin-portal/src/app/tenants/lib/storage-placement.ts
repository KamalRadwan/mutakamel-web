export const TENANT_CREATE_PERMISSION = "admin.tenants.create";
const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TenantStoragePlacementOption {
  id: string;
  code: string;
  name: string;
  region: string;
  status: "ACTIVE";
  maxTenants: number | null;
  assignedTenants: number;
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

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

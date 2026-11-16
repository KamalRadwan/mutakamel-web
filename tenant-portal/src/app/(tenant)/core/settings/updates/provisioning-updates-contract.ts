import type { CorePath } from "@/lib/api/envelope";
import { isUuidV7 } from "../../core-validation";

export const PROVISIONING_UPDATES_PATH: CorePath = "/api/tenant/core/v1/provisioning/updates";
export const PROVISIONING_UPDATES_APPLY_PATH: CorePath =
  "/api/tenant/core/v1/provisioning/updates/apply";

/** Fixed page size for self-service component update discovery (`TenantAvailableUpdateQueryDto`). */
export const PROVISIONING_UPDATES_PAGE_SIZE = 25;

// Mirrors `@ArrayMaxSize(100)` in `core-app/src/admin/tenants/provisioning/dto/apply-tenant-updates.dto.ts`.
export const MAX_PROVISIONING_UPDATE_SELECTIONS = 100;

export function provisioningOperationPath(operationId: string): CorePath {
  return `/api/tenant/core/v1/provisioning/operations/${encodeURIComponent(operationId)}`;
}

// Mirrors `COMPONENT_KEY_PATTERN` in `core-app/src/admin/tenants/provisioning/dto/provisioning-read-query.dto.ts`.
const COMPONENT_KEY_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)*$/u;
// Mirrors `SHA256_PATTERN` in `core-app/src/admin/tenants/provisioning/dto/apply-tenant-updates.dto.ts`.
export const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
export const RISK_LEVELS = new Set(["LOW", "MEDIUM", "HIGH"]);
const SORT_FIELDS = new Set(["publishedAt", "componentKey", "riskLevel"]);

// Mirrors `TenantOperationStatusEnum` in
// `core-app/packages/database/src/enums/tenant-provisioning.enum.ts`.
export const TENANT_OPERATION_STATUSES = [
  "REQUESTED",
  "PLANNING",
  "QUEUED",
  "RUNNING",
  "WAITING_RETRY",
  "CANCEL_REQUESTED",
  "SUCCEEDED",
  "FAILED_RETRYABLE",
  "MANUAL_RECOVERY_REQUIRED",
  "CANCELLED",
] as const;

const TENANT_OPERATION_STATUS_SET = new Set<string>(TENANT_OPERATION_STATUSES);
const TERMINAL_OPERATION_STATUS_SET = new Set<TenantOperationStatus>([
  "SUCCEEDED",
  "FAILED_RETRYABLE",
  "MANUAL_RECOVERY_REQUIRED",
  "CANCELLED",
]);

export type TenantOperationStatus = (typeof TENANT_OPERATION_STATUSES)[number];
export type ComponentReleaseRisk = "LOW" | "MEDIUM" | "HIGH";
export type ProvisioningUpdatesSortField = "publishedAt" | "componentKey" | "riskLevel";
type ProvisioningUpdatesSortDir = "ASC" | "DESC";

export interface ProvisioningUpdatesSort {
  sortBy: ProvisioningUpdatesSortField;
  sortDir: ProvisioningUpdatesSortDir;
}

export const DEFAULT_PROVISIONING_UPDATES_SORT: ProvisioningUpdatesSort = {
  sortBy: "publishedAt",
  sortDir: "DESC",
};

/** Client-derived row eligibility view state; never sent as a query/body parameter. */
export type UpdateEligibility =
  | "ELIGIBLE"
  | "PLANNED"
  | "ADMIN_MANAGED"
  | "INCOMPLETE_EVIDENCE";

export interface ProvisioningUpdatesFilters {
  componentKey: string;
  riskLevel: "" | ComponentReleaseRisk;
  requiresBackup: "" | "true" | "false";
  requiresMaintenance: "" | "true" | "false";
}

export interface TenantAvailableUpdate {
  lastOperationId: string | null;
  componentId: string;
  componentKey: string;
  ownerApp: string;
  installationState: string;
  current: {
    releaseId: string | null;
    releaseVersion: string | null;
    schemaVersion: string | null;
    manifestChecksum: string | null;
  };
  desiredReleaseId: string | null;
  updateAlreadyPlanned: boolean;
  availableRelease: {
    id: string;
    releaseVersion: string;
    manifestVersion: string | null;
    schemaTarget: string | null;
    manifestChecksum: string;
    schemaChecksum: string | null;
    riskLevel: ComponentReleaseRisk;
    selfServiceAllowed: boolean;
    requiresBackup: boolean;
    requiresMaintenance: boolean;
    publishedAt: string | null;
    compatibilityContractVersion: string | null;
  };
}

interface ProvisioningUpdateSelection {
  componentKey: string;
  targetReleaseId: string;
  targetReleaseVersion: string;
  targetManifestChecksum: string;
  currentAppliedReleaseId: string;
  currentAppliedManifestChecksum: string;
}

export interface ApplyTenantProvisioningUpdatesRequest {
  selections: ProvisioningUpdateSelection[];
}

export interface TenantProvisioningOperationView {
  id: string;
  status: TenantOperationStatus;
  type: string | null;
  currentPhase: string | null;
  safeErrorCode: string | null;
  safeErrorMessage: string | null;
  updatedAt: string | null;
}

export function isTenantOperationStatus(value: unknown): value is TenantOperationStatus {
  return typeof value === "string" && TENANT_OPERATION_STATUS_SET.has(value);
}

export function isTerminalOperationStatus(status: TenantOperationStatus): boolean {
  return TERMINAL_OPERATION_STATUS_SET.has(status);
}

export function isValidComponentKeyFilter(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 || (normalized.length <= 96 && COMPONENT_KEY_PATTERN.test(normalized))
  );
}

export function buildProvisioningUpdatesQuery(
  filters: ProvisioningUpdatesFilters,
  page = 1,
  limit = PROVISIONING_UPDATES_PAGE_SIZE,
  sort: ProvisioningUpdatesSort = DEFAULT_PROVISIONING_UPDATES_SORT,
): string {
  const safePage = Number.isInteger(page) && page >= 1 ? page : 1;
  const safeLimit =
    Number.isInteger(limit) && limit >= 1 ? limit : PROVISIONING_UPDATES_PAGE_SIZE;
  const safeSortBy = SORT_FIELDS.has(sort.sortBy) ? sort.sortBy : "publishedAt";
  const safeSortDir = sort.sortDir === "ASC" ? "ASC" : "DESC";
  const params = new URLSearchParams({
    page: String(safePage),
    limit: String(safeLimit),
    sortBy: safeSortBy,
    sortDir: safeSortDir,
  });
  const normalizedKey = filters.componentKey.trim().toLowerCase();
  if (
    normalizedKey.length > 0 &&
    normalizedKey.length <= 96 &&
    COMPONENT_KEY_PATTERN.test(normalizedKey)
  ) {
    params.set("componentKey", normalizedKey);
  }
  if (filters.riskLevel) params.set("riskLevel", filters.riskLevel);
  if (filters.requiresBackup) params.set("requiresBackup", filters.requiresBackup);
  if (filters.requiresMaintenance) params.set("requiresMaintenance", filters.requiresMaintenance);
  return params.toString();
}

export function classifyUpdateEligibility(item: TenantAvailableUpdate): UpdateEligibility {
  if (item.updateAlreadyPlanned) return "PLANNED";
  if (!item.availableRelease.selfServiceAllowed) return "ADMIN_MANAGED";
  const hasCompleteEvidence =
    Boolean(item.current.releaseId && isUuidV7(item.current.releaseId)) &&
    Boolean(
      item.current.manifestChecksum && SHA256_PATTERN.test(item.current.manifestChecksum),
    ) &&
    isUuidV7(item.availableRelease.id) &&
    SHA256_PATTERN.test(item.availableRelease.manifestChecksum);
  return hasCompleteEvidence ? "ELIGIBLE" : "INCOMPLETE_EVIDENCE";
}

export function canSelectAvailableUpdate(item: TenantAvailableUpdate): boolean {
  return classifyUpdateEligibility(item) === "ELIGIBLE";
}

export function buildApplyProvisioningUpdatesRequest(
  items: readonly TenantAvailableUpdate[],
): ApplyTenantProvisioningUpdatesRequest {
  const selections: ProvisioningUpdateSelection[] = [];
  const seenKeys = new Set<string>();
  for (const item of items) {
    if (selections.length >= MAX_PROVISIONING_UPDATE_SELECTIONS) break;
    if (
      seenKeys.has(item.componentKey) ||
      !canSelectAvailableUpdate(item) ||
      !item.current.releaseId ||
      !item.current.manifestChecksum
    ) {
      continue;
    }
    seenKeys.add(item.componentKey);
    selections.push({
      componentKey: item.componentKey,
      targetReleaseId: item.availableRelease.id,
      targetReleaseVersion: item.availableRelease.releaseVersion,
      targetManifestChecksum: item.availableRelease.manifestChecksum,
      currentAppliedReleaseId: item.current.releaseId,
      currentAppliedManifestChecksum: item.current.manifestChecksum,
    });
  }
  return { selections };
}

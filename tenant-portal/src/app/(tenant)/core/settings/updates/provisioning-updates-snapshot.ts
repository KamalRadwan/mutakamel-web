import type { NormalizedApiError } from "@/lib/api/errors";
import {
  MAX_PROVISIONING_UPDATE_SELECTIONS,
  buildApplyProvisioningUpdatesRequest,
  canSelectAvailableUpdate,
  type ApplyTenantProvisioningUpdatesRequest,
  type TenantAvailableUpdate,
} from "./provisioning-updates-contract";

// Mirrors conflict/staleness error codes emitted by
// `core-app/src/admin/tenants/provisioning/services/tenant-provisioning-command.service.ts` and
// `core-app/src/admin/tenants/provisioning/services/tenant-provisioning-plan.service.ts`.
const STALE_APPLY_CONFLICT_CODES = new Set([
  "TENANT_PROVISIONING_UPDATE_SELECTION_STALE",
  "TENANT_PROVISIONING_PLAN_STALE",
  "TENANT_PROVISIONING_OPERATION_SUPERSEDED",
  "TENANT_PROVISIONING_OPERATION_STATE_INVALID",
  "TENANT_PROVISIONING_ADDON_REBIND_REQUIRED",
  "TENANT_PROVISIONING_NO_SELF_SERVICE_UPDATES",
  "TENANT_PROVISIONING_UPDATE_INCOMPATIBLE",
]);

export interface ApplyAttemptSnapshot {
  attemptKey: string;
  items: TenantAvailableUpdate[];
  requestBody: ApplyTenantProvisioningUpdatesRequest;
}

export interface UnreadableAcceptedAttempt {
  snapshot: ApplyAttemptSnapshot;
  responseOperationId: string | null;
}

export interface AcceptedAttemptReconciliation {
  resolved: boolean;
  correlatedOperationId: string | null;
}

export function cloneAvailableUpdate(item: TenantAvailableUpdate): TenantAvailableUpdate {
  return {
    ...item,
    current: { ...item.current },
    availableRelease: { ...item.availableRelease },
  };
}

export function createApplyAttemptSnapshot(
  attemptKey: string,
  items: readonly TenantAvailableUpdate[],
): ApplyAttemptSnapshot | null {
  const uniqueEligible: TenantAvailableUpdate[] = [];
  const seenKeys = new Set<string>();
  for (const item of items) {
    if (uniqueEligible.length >= MAX_PROVISIONING_UPDATE_SELECTIONS) break;
    if (seenKeys.has(item.componentKey) || !canSelectAvailableUpdate(item)) continue;
    seenKeys.add(item.componentKey);
    uniqueEligible.push(cloneAvailableUpdate(item));
  }
  const requestBody = buildApplyProvisioningUpdatesRequest(uniqueEligible);
  if (requestBody.selections.length === 0) return null;
  return {
    attemptKey,
    items: uniqueEligible,
    requestBody,
  };
}

export function doesDiscoveryMatchSnapshotItem(
  snapshotItem: TenantAvailableUpdate,
  liveItem: TenantAvailableUpdate | undefined,
): boolean {
  if (!liveItem || !canSelectAvailableUpdate(liveItem)) return false;
  return (
    snapshotItem.componentId === liveItem.componentId &&
    snapshotItem.componentKey === liveItem.componentKey &&
    snapshotItem.ownerApp === liveItem.ownerApp &&
    snapshotItem.updateAlreadyPlanned === liveItem.updateAlreadyPlanned &&
    snapshotItem.current.releaseId === liveItem.current.releaseId &&
    snapshotItem.current.releaseVersion === liveItem.current.releaseVersion &&
    snapshotItem.current.manifestChecksum === liveItem.current.manifestChecksum &&
    snapshotItem.availableRelease.id === liveItem.availableRelease.id &&
    snapshotItem.availableRelease.releaseVersion === liveItem.availableRelease.releaseVersion &&
    snapshotItem.availableRelease.manifestChecksum === liveItem.availableRelease.manifestChecksum &&
    snapshotItem.availableRelease.riskLevel === liveItem.availableRelease.riskLevel &&
    snapshotItem.availableRelease.selfServiceAllowed ===
      liveItem.availableRelease.selfServiceAllowed &&
    snapshotItem.availableRelease.requiresBackup === liveItem.availableRelease.requiresBackup &&
    snapshotItem.availableRelease.requiresMaintenance ===
      liveItem.availableRelease.requiresMaintenance
  );
}

export function hasSnapshotDiverged(
  snapshotItems: readonly TenantAvailableUpdate[],
  liveItems: readonly TenantAvailableUpdate[],
): boolean {
  const liveByKey = new Map(liveItems.map((item) => [item.componentKey, item]));
  return snapshotItems.some(
    (snapshotItem) =>
      !doesDiscoveryMatchSnapshotItem(snapshotItem, liveByKey.get(snapshotItem.componentKey)),
  );
}

export function isStaleApplyConflictError(error: NormalizedApiError): boolean {
  return typeof error.code === "string" && STALE_APPLY_CONFLICT_CODES.has(error.code);
}

export function doesDiscoveryReconcileAcceptedAttempt(
  attempt: UnreadableAcceptedAttempt,
  liveItems: readonly TenantAvailableUpdate[],
): AcceptedAttemptReconciliation {
  const snapshotItems = attempt.snapshot.items;
  if (snapshotItems.length === 0) {
    return { resolved: false, correlatedOperationId: null };
  }

  const liveByKey = new Map(liveItems.map((item) => [item.componentKey, item]));
  let sharedPlannedOperationId: string | null = null;

  for (const snapshotItem of snapshotItems) {
    const liveItem = liveByKey.get(snapshotItem.componentKey);
    if (!liveItem || liveItem.componentId !== snapshotItem.componentId) {
      return { resolved: false, correlatedOperationId: null };
    }

    const targetId = snapshotItem.availableRelease.id;
    const targetChecksum = snapshotItem.availableRelease.manifestChecksum;

    const appliedToCurrent =
      liveItem.current.releaseId === targetId &&
      liveItem.current.manifestChecksum === targetChecksum;
    if (appliedToCurrent) {
      continue;
    }

    const hasCorrelatedOperationId =
      liveItem.lastOperationId !== null &&
      (attempt.responseOperationId !== null
        ? liveItem.lastOperationId === attempt.responseOperationId
        : liveItem.lastOperationId !== snapshotItem.lastOperationId);

    const plannedForTarget =
      liveItem.updateAlreadyPlanned &&
      liveItem.desiredReleaseId === targetId &&
      liveItem.availableRelease.id === targetId &&
      liveItem.availableRelease.manifestChecksum === targetChecksum &&
      hasCorrelatedOperationId;

    if (!plannedForTarget || liveItem.lastOperationId === null) {
      return { resolved: false, correlatedOperationId: null };
    }

    if (
      sharedPlannedOperationId !== null &&
      sharedPlannedOperationId !== liveItem.lastOperationId
    ) {
      return { resolved: false, correlatedOperationId: null };
    }
    sharedPlannedOperationId = liveItem.lastOperationId;
  }

  return {
    resolved: true,
    correlatedOperationId: sharedPlannedOperationId,
  };
}

export function findPlannedOperationId(
  items: readonly TenantAvailableUpdate[],
): string | undefined {
  return (
    items.find(
      (row) =>
        row.updateAlreadyPlanned &&
        row.desiredReleaseId === row.availableRelease.id &&
        row.lastOperationId !== null,
    )?.lastOperationId ?? undefined
  );
}

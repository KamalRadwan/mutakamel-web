import type {
  ApplyTenantUpdatesDto,
  CreateDecommissionOperationDto,
  CreateRepairOperationDto,
  ResolveTenantSeedConflictDto,
  SeedConflictDecision,
  TenantAvailableUpdate,
  TenantComponentInstallation,
  TenantSeedState,
} from "../types";
import {
  COMPONENT_KEY_PATTERN,
  SAFE_CODE_PATTERN,
  SHA256_PATTERN,
  UUID_V7_PATTERN,
} from "./readers";

export function buildApplyUpdatesDto(
  updates: readonly TenantAvailableUpdate[],
): ApplyTenantUpdatesDto {
  if (updates.length < 1 || updates.length > 100) {
    throw new Error("TENANT_UPDATE_SELECTION_REQUIRED");
  }
  const seen = new Set<string>();
  const selections = updates.map((update) => {
    if (seen.has(update.componentKey)) {
      throw new Error("TENANT_UPDATE_SELECTION_DUPLICATE");
    }
    seen.add(update.componentKey);
    if (!update.current.manifestChecksum) {
      throw new Error("TENANT_UPDATE_CURRENT_EVIDENCE_MISSING");
    }
    return {
      componentKey: update.componentKey,
      targetReleaseId: update.availableRelease.id,
      targetReleaseVersion: update.availableRelease.releaseVersion,
      targetManifestChecksum: update.availableRelease.manifestChecksum,
      currentAppliedReleaseId: update.current.releaseId,
      currentAppliedManifestChecksum: update.current.manifestChecksum,
    };
  });
  return { selections };
}

export function buildRepairOperationDto(
  component: TenantComponentInstallation,
  reasonCode: string,
  conflictResolutionIds: string[] = [],
): CreateRepairOperationDto {
  assertReasonCode(reasonCode);
  const desiredReleaseId = requiredUuid(
    component.desired.releaseId,
    "TENANT_REPAIR_DESIRED_EVIDENCE_MISSING",
  );
  const desiredManifestChecksum = requiredChecksum(
    component.desired.manifestChecksum,
    "TENANT_REPAIR_DESIRED_EVIDENCE_MISSING",
  );
  const hasAppliedRelease = component.applied.releaseId !== null;
  const hasAppliedChecksum = component.applied.manifestChecksum !== null;
  if (hasAppliedRelease !== hasAppliedChecksum) {
    throw new Error("TENANT_REPAIR_APPLIED_EVIDENCE_INCOMPLETE");
  }
  if (conflictResolutionIds.length > 100) {
    throw new Error("TENANT_REPAIR_CONFLICT_RESOLUTION_LIMIT");
  }
  conflictResolutionIds.forEach((id) => requiredUuid(id, "INVALID_CONFLICT_RESOLUTION_ID"));

  return {
    componentKey: component.componentKey,
    currentDesiredReleaseId: desiredReleaseId,
    currentDesiredManifestChecksum: desiredManifestChecksum,
    ...(hasAppliedRelease && hasAppliedChecksum
      ? {
          currentAppliedReleaseId: component.applied.releaseId as string,
          currentAppliedManifestChecksum: component.applied
            .manifestChecksum as string,
        }
      : {}),
    targetReleaseId: desiredReleaseId,
    targetManifestChecksum: desiredManifestChecksum,
    reasonCode,
    ...(conflictResolutionIds.length ? { conflictResolutionIds } : {}),
  };
}

export function buildDecommissionOperationDto(
  component: TenantComponentInstallation,
  reasonCode: string,
  retentionAcknowledged: boolean,
): CreateDecommissionOperationDto {
  assertReasonCode(reasonCode);
  if (!retentionAcknowledged) {
    throw new Error("TENANT_DECOMMISSION_RETENTION_ACK_REQUIRED");
  }
  return {
    componentKey: component.componentKey,
    currentDesiredReleaseId: requiredUuid(
      component.desired.releaseId,
      "TENANT_DECOMMISSION_DESIRED_EVIDENCE_MISSING",
    ),
    currentDesiredManifestChecksum: requiredChecksum(
      component.desired.manifestChecksum,
      "TENANT_DECOMMISSION_DESIRED_EVIDENCE_MISSING",
    ),
    currentAppliedReleaseId: requiredUuid(
      component.applied.releaseId,
      "TENANT_DECOMMISSION_APPLIED_EVIDENCE_MISSING",
    ),
    currentAppliedManifestChecksum: requiredChecksum(
      component.applied.manifestChecksum,
      "TENANT_DECOMMISSION_APPLIED_EVIDENCE_MISSING",
    ),
    retentionAcknowledged: true,
    reasonCode,
  };
}

export function buildResolveSeedConflictDto(
  seed: TenantSeedState,
  decision: SeedConflictDecision,
  reasonCode: string,
): ResolveTenantSeedConflictDto {
  assertReasonCode(reasonCode);
  if (seed.status !== "CONFLICT") {
    throw new Error("TENANT_SEED_NOT_IN_CONFLICT");
  }
  if (seed.revision === null) {
    throw new Error("TENANT_SEED_CONFLICT_REVISION_UNAVAILABLE");
  }
  return {
    decision,
    reasonCode,
    expectedConflictRevision: seed.revision,
    expectedStatus: "CONFLICT",
    expectedAppliedChecksum: requiredChecksum(
      seed.appliedChecksum,
      "TENANT_SEED_CONFLICT_EVIDENCE_MISSING",
    ),
    expectedDesiredChecksum: requiredChecksum(
      seed.desiredChecksum,
      "TENANT_SEED_CONFLICT_EVIDENCE_MISSING",
    ),
  };
}

/** Stable in-memory identity only; the UUIDv7 remains the server command id. */
export function canonicalProvisioningIntent(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function assertReasonCode(value: string): void {
  if (!SAFE_CODE_PATTERN.test(value)) {
    throw new Error("INVALID_PROVISIONING_REASON_CODE");
  }
}

export function validateAddApplicationInput(value: {
  applicationKey: string;
  expectedAccessPolicyRevision: number;
  targetSelection: Array<{
    componentKey: string;
    componentId: string;
    targetReleaseId: string;
    targetReleaseVersion: string;
    targetManifestChecksum: string;
  }>;
  reasonCode: string;
}): void {
  if (
    !hasOnlyKeys(value as unknown as Record<string, unknown>, [
      "applicationKey",
      "expectedAccessPolicyRevision",
      "targetSelection",
      "reasonCode",
    ])
  ) {
    throw new Error("INVALID_ADD_APPLICATION_COMMAND_SHAPE");
  }
  if (!/^[a-z][a-z0-9_-]{0,63}$/u.test(value.applicationKey)) {
    throw new Error("INVALID_APPLICATION_KEY");
  }
  if (
    !Number.isInteger(value.expectedAccessPolicyRevision) ||
    value.expectedAccessPolicyRevision < 1 ||
    value.expectedAccessPolicyRevision > 2_147_483_647
  ) {
    throw new Error("INVALID_ACCESS_POLICY_REVISION");
  }
  if (value.targetSelection.length < 1 || value.targetSelection.length > 100) {
    throw new Error("INVALID_ADD_APPLICATION_TARGET_SELECTION");
  }
  const keys = new Set<string>();
  value.targetSelection.forEach((target) => {
    if (
      !hasOnlyKeys(target as unknown as Record<string, unknown>, [
        "componentKey",
        "componentId",
        "targetReleaseId",
        "targetReleaseVersion",
        "targetManifestChecksum",
      ])
    ) {
      throw new Error("INVALID_ADD_APPLICATION_TARGET_SELECTION");
    }
    if (!COMPONENT_KEY_PATTERN.test(target.componentKey) || keys.has(target.componentKey)) {
      throw new Error("INVALID_ADD_APPLICATION_TARGET_SELECTION");
    }
    keys.add(target.componentKey);
    requiredUuid(target.componentId, "INVALID_ADD_APPLICATION_TARGET_SELECTION");
    requiredUuid(target.targetReleaseId, "INVALID_ADD_APPLICATION_TARGET_SELECTION");
    if (!target.targetReleaseVersion.trim() || target.targetReleaseVersion.length > 120) {
      throw new Error("INVALID_ADD_APPLICATION_TARGET_SELECTION");
    }
    requiredChecksum(
      target.targetManifestChecksum,
      "INVALID_ADD_APPLICATION_TARGET_SELECTION",
    );
  });
  assertReasonCode(value.reasonCode);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function requiredUuid(value: string | null, code: string): string {
  if (!value || !UUID_V7_PATTERN.test(value)) throw new Error(code);
  return value;
}

function requiredChecksum(value: string | null, code: string): string {
  if (!value || !SHA256_PATTERN.test(value)) throw new Error(code);
  return value;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  const keys = new Set(allowed);
  return Object.keys(value).every((key) => keys.has(key));
}

export const TENANT_ID = "019f0000-0000-7000-8000-000000000001";
export const OPERATION_ID = "019f0000-0000-7000-8000-000000000010";
export const RETRY_OPERATION_ID = "019f0000-0000-7000-8000-000000000011";
export const STEP_ID = "019f0000-0000-7000-8000-000000000020";
export const EVENT_ID = "019f0000-0000-7000-8000-000000000030";
export const EVENT_ROW_ID = "019f0000-0000-7000-8000-000000000031";
export const COMPONENT_ID = "019f0000-0000-7000-8000-000000000040";
export const INSTALLATION_ID = "019f0000-0000-7000-8000-000000000041";
export const RELEASE_ID = "019f0000-0000-7000-8000-000000000050";
export const TARGET_RELEASE_ID = "019f0000-0000-7000-8000-000000000051";
export const SEED_ID = "019f0000-0000-7000-8000-000000000060";
export const REQUEST_ID = "019f0000-0000-7000-8000-000000000070";
export const EVIDENCE_ID = "019f0000-0000-7000-8000-000000000080";
export const FENCE_ID = "019f0000-0000-7000-8000-000000000090";
export const RUN_ID = "019f0000-0000-7000-8000-0000000000a0";
export const ARTIFACT_ID = "019f0000-0000-7000-8000-0000000000a1";
export const LEASE_ID = "019f0000-0000-7000-8000-0000000000b0";
export const RESOLUTION_ID = "019f0000-0000-7000-8000-0000000000c0";
export const ADMIN_ID = "019f0000-0000-7000-8000-0000000000d0";
export const COMMAND_ID = "019f0000-0000-7000-8000-0000000000e0";
export const SHA_A = "a".repeat(64);
export const SHA_B = "b".repeat(64);
export const SHA_C = "c".repeat(64);
export const NOW = "2026-08-11T19:33:49.000Z";

export const META = {
  page: 1,
  limit: 100,
  total: 1,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

export function operationSummary(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: OPERATION_ID,
    tenantId: TENANT_ID,
    generation: 1,
    type: "INITIAL_PROVISION",
    status: "RUNNING",
    currentPhase: "INSTALLING",
    planDigest: SHA_A,
    accessPolicyRevision: 1,
    actor: { type: "ADMIN", id: ADMIN_ID },
    reason: null,
    requestedAt: NOW,
    startedAt: NOW,
    heartbeatAt: NOW,
    cancellationRequestedAt: null,
    completedAt: null,
    safeError: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function operationStep(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: STEP_ID,
    componentId: COMPONENT_ID,
    componentKey: "core.foundation",
    stepKey: "core.foundation.schema",
    kind: "SCHEMA",
    status: "RUNNING",
    required: true,
    activationRequired: true,
    weight: 10,
    attemptCount: 1,
    retryable: true,
    dependsOnStepKeys: [],
    fromVersion: null,
    targetVersion: "1.0.0",
    appliedVersion: null,
    targetChecksum: SHA_B,
    appliedChecksum: null,
    producer: "core-app",
    startedAt: NOW,
    heartbeatAt: NOW,
    finishedAt: null,
    safeError: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function operationDetail(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...operationSummary(),
    progress: {
      totalSteps: 2,
      completedSteps: 1,
      failedSteps: 0,
      totalWeight: 20,
      completedWeight: 10,
      percent: 50,
    },
    timelineEventCount: 1,
    steps: [operationStep()],
    ...overrides,
  };
}

export function timelineEvent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: EVENT_ROW_ID,
    eventId: EVENT_ID,
    sequence: "1",
    componentId: COMPONENT_ID,
    componentKey: "core.foundation",
    stepId: STEP_ID,
    eventType: "STEP_STARTED",
    phase: "INSTALLING",
    status: "RUNNING",
    actor: { type: "SYSTEM", id: null },
    message: "Schema installation started.",
    occurredAt: NOW,
    ...overrides,
  };
}

export function safeRelease(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: TARGET_RELEASE_ID,
    releaseVersion: "1.1.0",
    manifestVersion: 2,
    schemaTarget: "1.1.0",
    manifestChecksum: SHA_B,
    riskLevel: "MEDIUM",
    selfServiceAllowed: true,
    requiresBackup: true,
    requiresMaintenance: false,
    publishedAt: NOW,
    ...overrides,
  };
}

export function availableUpdate(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    componentId: COMPONENT_ID,
    componentKey: "core.foundation",
    ownerApp: "core",
    installationState: "READY",
    current: {
      releaseId: RELEASE_ID,
      releaseVersion: "1.0.0",
      schemaVersion: "1.0.0",
      manifestChecksum: SHA_A,
    },
    desiredReleaseId: RELEASE_ID,
    updateAlreadyPlanned: false,
    availableRelease: {
      ...safeRelease(),
      schemaChecksum: SHA_C,
      compatibilityContractVersion: 1,
    },
    ...overrides,
  };
}

export function componentInstallation(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: INSTALLATION_ID,
    tenantId: TENANT_ID,
    componentId: COMPONENT_ID,
    componentKey: "core.foundation",
    ownerApp: "core",
    generation: 1,
    selectionSource: "FOUNDATION",
    activationRequired: true,
    evidenceOrigin: "PROVISIONED",
    state: "READY",
    desired: {
      releaseId: RELEASE_ID,
      releaseVersion: "1.0.0",
      schemaVersion: "1.0.0",
      manifestChecksum: SHA_A,
    },
    applied: {
      releaseId: RELEASE_ID,
      releaseVersion: "1.0.0",
      schemaVersion: "1.0.0",
      manifestChecksum: SHA_A,
    },
    latestPublishedRelease: safeRelease(),
    updateAvailable: true,
    updateAlreadyPlanned: false,
    lastOperationId: OPERATION_ID,
    installedAt: NOW,
    readyAt: NOW,
    disabledAt: null,
    lastVerifiedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function seedState(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: SEED_ID,
    tenantId: TENANT_ID,
    componentId: COMPONENT_ID,
    componentKey: "core.foundation",
    seedKey: "countries.v1",
    policy: "MANUAL_CONFLICT",
    status: "CONFLICT",
    desiredVersion: "2",
    appliedVersion: "1",
    desiredChecksum: SHA_B,
    appliedChecksum: SHA_A,
    updateAvailable: true,
    customizedAt: NOW,
    conflictCode: "TENANT_VALUE_CUSTOMIZED",
    lastOperationId: OPERATION_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function prerequisiteRequest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    requestId: REQUEST_ID,
    tenantId: TENANT_ID,
    operationId: OPERATION_ID,
    generation: 1,
    planDigest: SHA_A,
    requestDigest: SHA_B,
    status: "REQUESTED",
    releasePins: [
      {
        componentKey: "core.foundation",
        releaseId: TARGET_RELEASE_ID,
        releaseVersion: "1.1.0",
        manifestChecksum: SHA_B,
        requiresBackup: true,
        requiresMaintenance: true,
      },
    ],
    safeCode: null,
    requestedAt: NOW,
    expiresAt: "2026-08-11T20:33:49.000Z",
    completedAt: null,
    releasedAt: null,
    ...overrides,
  };
}

export function prerequisiteEvidenceRecord(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...prerequisiteRequest({ status: "SUCCEEDED", completedAt: NOW }),
    maintenanceFence: {
      fenceId: FENCE_ID,
      status: "ACTIVE",
      accessPolicyRevision: 2,
      fencedAt: NOW,
      expiresAt: "2026-08-11T20:33:49.000Z",
      releasedAt: null,
      evidenceDigest: SHA_C,
    },
    evidence: [
      {
        evidenceId: EVIDENCE_ID,
        status: "SUCCEEDED",
        evidenceDigest: SHA_C,
        safeCode: "PREREQUISITES_READY",
        occurredAt: NOW,
        expiresAt: "2026-08-11T20:33:49.000Z",
        backupEvidence: {
          runId: RUN_ID,
          artifactId: ARTIFACT_ID,
          artifactSha256: SHA_A,
          sizeBytes: "9223372036854775807",
          completedAt: NOW,
          storageKey: "must-not-survive",
        },
        maintenanceEvidence: {
          leaseId: LEASE_ID,
          fenceId: FENCE_ID,
          accessPolicyRevision: 2,
          drainedAt: NOW,
          activeSessionCount: 0,
          aclSnapshotDigest: SHA_A,
          runtimePrincipalsDigest: SHA_B,
          terminatedSessionCount: 3,
          preparedTransactionCount: 0,
          restoredAt: null,
        },
      },
    ],
    ...overrides,
  };
}

export function managedOperation(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    operationId: RETRY_OPERATION_ID,
    tenantId: TENANT_ID,
    type: "REPAIR",
    status: "QUEUED",
    generation: 2,
    planDigest: SHA_C,
    replayed: false,
    ...overrides,
  };
}

export function seedResolution(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    resolutionId: RESOLUTION_ID,
    tenantId: TENANT_ID,
    seedStateId: SEED_ID,
    decision: "KEEP_TENANT_VALUE",
    expectedConflictRevision: 3,
    resolutionDigest: SHA_C,
    resolvedAt: NOW,
    ...overrides,
  };
}

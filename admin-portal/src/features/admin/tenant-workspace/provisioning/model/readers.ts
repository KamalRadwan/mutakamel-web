import {
  MAINTENANCE_FENCE_STATUSES,
  PREREQUISITE_EVIDENCE_STATUSES,
  PREREQUISITE_REQUEST_STATUSES,
  RELEASE_RISK_LEVELS,
  SEED_CONFLICT_DECISIONS,
  TENANT_COMPONENT_INSTALLATION_STATES,
  TENANT_COMPONENT_SELECTION_SOURCES,
  TENANT_OPERATION_ACTOR_TYPES,
  TENANT_OPERATION_STATUSES,
  TENANT_OPERATION_STEP_KINDS,
  TENANT_OPERATION_STEP_STATUSES,
  TENANT_OPERATION_TYPES,
  TENANT_SEED_POLICIES,
  TENANT_SEED_STATUSES,
  type ManagedProvisioningOperation,
  type PaginationMeta,
  type PrerequisiteReleasePin,
  type ProvisioningPage,
  type SafeOperationError,
  type SafeReleaseEvidence,
  type SeedConflictResolution,
  type TenantAvailableUpdate,
  type TenantComponentInstallation,
  type TenantMaintenanceFence,
  type TenantOperationActor,
  type TenantOperationDetail,
  type TenantOperationProgress,
  type TenantOperationStep,
  type TenantOperationSummary,
  type TenantOperationTimelineEvent,
  type TenantPrerequisiteEvidence,
  type TenantPrerequisiteEvidenceRecord,
  type TenantPrerequisiteRequest,
  type TenantProvisioningCommandResult,
  type TenantReleaseState,
  type TenantSeedState,
} from "../types";

export const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
export const COMPONENT_KEY_PATTERN =
  /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)*$/u;
export const SAFE_CODE_PATTERN = /^[A-Z][A-Z0-9._-]{2,95}$/u;

type Reader<T> = (value: unknown) => T;

export function readProvisioningPage<T>(
  value: unknown,
  meta: unknown,
  reader: Reader<T>,
  code = "INVALID_PROVISIONING_PAGE_RESPONSE",
): ProvisioningPage<T> {
  return {
    items: array(value, code).map(reader),
    meta: readPaginationMeta(meta, code),
  };
}

export function readPaginationMeta(
  value: unknown,
  code = "INVALID_PROVISIONING_PAGE_RESPONSE",
): PaginationMeta {
  const meta = object(value, code);
  return {
    page: positiveInteger(meta.page, code),
    limit: positiveInteger(meta.limit, code),
    total: nonNegativeInteger(meta.total, code),
    totalPages: nonNegativeInteger(meta.totalPages, code),
    hasNext: boolean(meta.hasNext, code),
    hasPrev: boolean(meta.hasPrev, code),
  };
}

export function readTenantOperationSummary(value: unknown): TenantOperationSummary {
  const code = "INVALID_TENANT_OPERATION_RESPONSE";
  const operation = object(value, code);
  return {
    id: uuidV7(operation.id, code),
    tenantId: uuidV7(operation.tenantId, code),
    generation: positiveInteger(operation.generation, code),
    type: oneOf(operation.type, TENANT_OPERATION_TYPES, code),
    status: oneOf(operation.status, TENANT_OPERATION_STATUSES, code),
    currentPhase: requiredString(operation.currentPhase, code, 160),
    planDigest: sha256(operation.planDigest, code),
    accessPolicyRevision: positiveInteger(operation.accessPolicyRevision, code),
    actor: readActor(operation.actor, code),
    reason: nullableString(operation.reason, code, 500),
    requestedAt: isoDate(operation.requestedAt, code),
    startedAt: nullableIsoDate(operation.startedAt, code),
    heartbeatAt: nullableIsoDate(operation.heartbeatAt, code),
    cancellationRequestedAt: nullableIsoDate(
      operation.cancellationRequestedAt,
      code,
    ),
    completedAt: nullableIsoDate(operation.completedAt, code),
    safeError: readSafeError(operation.safeError, code),
    createdAt: isoDate(operation.createdAt, code),
    updatedAt: isoDate(operation.updatedAt, code),
  };
}

export function readTenantOperationDetail(value: unknown): TenantOperationDetail {
  const code = "INVALID_TENANT_OPERATION_DETAIL_RESPONSE";
  const operation = object(value, code);
  return {
    ...readTenantOperationSummary(operation),
    progress: readProgress(operation.progress, code),
    timelineEventCount: nonNegativeInteger(operation.timelineEventCount, code),
    steps: array(operation.steps, code).map(readTenantOperationStep),
  };
}

export function readTenantOperationStep(value: unknown): TenantOperationStep {
  const code = "INVALID_TENANT_OPERATION_STEP_RESPONSE";
  const step = object(value, code);
  return {
    id: uuidV7(step.id, code),
    componentId: nullableUuidV7(step.componentId, code),
    componentKey: nullableComponentKey(step.componentKey, code),
    stepKey: requiredString(step.stepKey, code, 160),
    kind: oneOf(step.kind, TENANT_OPERATION_STEP_KINDS, code),
    status: oneOf(step.status, TENANT_OPERATION_STEP_STATUSES, code),
    required: boolean(step.required, code),
    activationRequired: boolean(step.activationRequired, code),
    weight: nonNegativeInteger(step.weight, code),
    attemptCount: nonNegativeInteger(step.attemptCount, code),
    retryable: boolean(step.retryable, code),
    dependsOnStepKeys: array(step.dependsOnStepKeys, code).map((entry) =>
      requiredString(entry, code, 160),
    ),
    fromVersion: nullableString(step.fromVersion, code, 120),
    targetVersion: nullableString(step.targetVersion, code, 120),
    appliedVersion: nullableString(step.appliedVersion, code, 120),
    targetChecksum: nullableSha256(step.targetChecksum, code),
    appliedChecksum: nullableSha256(step.appliedChecksum, code),
    producer: nullableString(step.producer, code, 120),
    startedAt: nullableIsoDate(step.startedAt, code),
    heartbeatAt: nullableIsoDate(step.heartbeatAt, code),
    finishedAt: nullableIsoDate(step.finishedAt, code),
    safeError: readSafeError(step.safeError, code),
    createdAt: isoDate(step.createdAt, code),
    updatedAt: isoDate(step.updatedAt, code),
  };
}

export function readTenantOperationTimelineEvent(
  value: unknown,
): TenantOperationTimelineEvent {
  const code = "INVALID_TENANT_OPERATION_TIMELINE_RESPONSE";
  const event = object(value, code);
  return {
    id: uuidV7(event.id, code),
    eventId: uuidV7(event.eventId, code),
    sequence: unsignedIntegerString(event.sequence, code),
    componentId: nullableUuidV7(event.componentId, code),
    componentKey: nullableComponentKey(event.componentKey, code),
    stepId: nullableUuidV7(event.stepId, code),
    eventType: requiredString(event.eventType, code, 160),
    phase: nullableString(event.phase, code, 160),
    status: nullableString(event.status, code, 160),
    actor: readActor(event.actor, code),
    message: nullableString(event.message, code, 1_000),
    occurredAt: isoDate(event.occurredAt, code),
  };
}

export function readTenantProvisioningCommandResult(
  value: unknown,
): TenantProvisioningCommandResult {
  const code = "INVALID_TENANT_PROVISIONING_COMMAND_RESPONSE";
  const result = object(value, code);
  return {
    replayed: boolean(result.replayed, code),
    operation: readTenantOperationDetail(result.operation),
  };
}

export function readTenantAvailableUpdate(value: unknown): TenantAvailableUpdate {
  const code = "INVALID_TENANT_AVAILABLE_UPDATE_RESPONSE";
  const update = object(value, code);
  const current = object(update.current, code);
  const available = object(update.availableRelease, code);
  const baseRelease = readSafeReleaseEvidence(available, code);
  const compatibilityContractVersion = positiveInteger(
    available.compatibilityContractVersion,
    code,
  );
  if (compatibilityContractVersion !== 1) invalid(code);

  return {
    componentId: uuidV7(update.componentId, code),
    componentKey: componentKey(update.componentKey, code),
    ownerApp: requiredString(update.ownerApp, code, 64),
    installationState: oneOf(
      update.installationState,
      TENANT_COMPONENT_INSTALLATION_STATES,
      code,
    ),
    current: {
      releaseId: uuidV7(current.releaseId, code),
      releaseVersion: requiredString(current.releaseVersion, code, 120),
      schemaVersion: nullableString(current.schemaVersion, code, 120),
      manifestChecksum: nullableSha256(current.manifestChecksum, code),
    },
    desiredReleaseId: nullableUuidV7(update.desiredReleaseId, code),
    updateAlreadyPlanned: boolean(update.updateAlreadyPlanned, code),
    availableRelease: {
      ...baseRelease,
      schemaChecksum: nullableSha256(available.schemaChecksum, code),
      compatibilityContractVersion: 1,
    },
  };
}

export function readTenantComponentInstallation(
  value: unknown,
): TenantComponentInstallation {
  const code = "INVALID_TENANT_COMPONENT_STATE_RESPONSE";
  const installation = object(value, code);
  const latest = installation.latestPublishedRelease;
  return {
    id: uuidV7(installation.id, code),
    tenantId: uuidV7(installation.tenantId, code),
    componentId: uuidV7(installation.componentId, code),
    componentKey: componentKey(installation.componentKey, code),
    ownerApp: requiredString(installation.ownerApp, code, 64),
    generation: positiveInteger(installation.generation, code),
    selectionSource: oneOf(
      installation.selectionSource,
      TENANT_COMPONENT_SELECTION_SOURCES,
      code,
    ),
    activationRequired: boolean(installation.activationRequired, code),
    evidenceOrigin: exact(installation.evidenceOrigin, "PROVISIONED", code),
    state: oneOf(
      installation.state,
      TENANT_COMPONENT_INSTALLATION_STATES,
      code,
    ),
    desired: readReleaseState(installation.desired, code),
    applied: readReleaseState(installation.applied, code),
    latestPublishedRelease:
      latest === null ? null : readSafeReleaseEvidence(latest, code),
    updateAvailable: boolean(installation.updateAvailable, code),
    updateAlreadyPlanned: boolean(installation.updateAlreadyPlanned, code),
    lastOperationId: nullableUuidV7(installation.lastOperationId, code),
    installedAt: nullableIsoDate(installation.installedAt, code),
    readyAt: nullableIsoDate(installation.readyAt, code),
    disabledAt: nullableIsoDate(installation.disabledAt, code),
    lastVerifiedAt: nullableIsoDate(installation.lastVerifiedAt, code),
    createdAt: isoDate(installation.createdAt, code),
    updatedAt: isoDate(installation.updatedAt, code),
  };
}

export function readTenantSeedState(value: unknown): TenantSeedState {
  const code = "INVALID_TENANT_SEED_STATE_RESPONSE";
  const seed = object(value, code);
  const revision = seed.revision;
  return {
    id: uuidV7(seed.id, code),
    tenantId: uuidV7(seed.tenantId, code),
    componentId: uuidV7(seed.componentId, code),
    componentKey: componentKey(seed.componentKey, code),
    seedKey: seedKey(seed.seedKey, code),
    policy: oneOf(seed.policy, TENANT_SEED_POLICIES, code),
    status: oneOf(seed.status, TENANT_SEED_STATUSES, code),
    desiredVersion: nullableString(seed.desiredVersion, code, 120),
    appliedVersion: nullableString(seed.appliedVersion, code, 120),
    desiredChecksum: nullableSha256(seed.desiredChecksum, code),
    appliedChecksum: nullableSha256(seed.appliedChecksum, code),
    updateAvailable: boolean(seed.updateAvailable, code),
    customizedAt: nullableIsoDate(seed.customizedAt, code),
    conflictCode: nullableString(seed.conflictCode, code, 160),
    lastOperationId: nullableUuidV7(seed.lastOperationId, code),
    revision:
      revision === undefined || revision === null
        ? null
        : positiveInteger(revision, code),
    createdAt: isoDate(seed.createdAt, code),
    updatedAt: isoDate(seed.updatedAt, code),
  };
}

export function readTenantPrerequisiteRequest(
  value: unknown,
): TenantPrerequisiteRequest {
  const code = "INVALID_TENANT_PREREQUISITE_RESPONSE";
  const request = object(value, code);
  return {
    requestId: uuidV7(request.requestId, code),
    tenantId: uuidV7(request.tenantId, code),
    operationId: uuidV7(request.operationId, code),
    generation: positiveInteger(request.generation, code),
    planDigest: sha256(request.planDigest, code),
    requestDigest: sha256(request.requestDigest, code),
    status: oneOf(request.status, PREREQUISITE_REQUEST_STATUSES, code),
    releasePins: array(request.releasePins, code).map((pin) =>
      readPrerequisiteReleasePin(pin, code),
    ),
    safeCode: nullableString(request.safeCode, code, 160),
    requestedAt: isoDate(request.requestedAt, code),
    expiresAt: isoDate(request.expiresAt, code),
    completedAt: nullableIsoDate(request.completedAt, code),
    releasedAt: nullableIsoDate(request.releasedAt, code),
  };
}

export function readTenantPrerequisiteEvidenceRecord(
  value: unknown,
): TenantPrerequisiteEvidenceRecord {
  const code = "INVALID_TENANT_PREREQUISITE_EVIDENCE_RESPONSE";
  const record = object(value, code);
  return {
    ...readTenantPrerequisiteRequest(record),
    maintenanceFence:
      record.maintenanceFence === null
        ? null
        : readMaintenanceFence(record.maintenanceFence, code),
    evidence: array(record.evidence, code).map((entry) =>
      readPrerequisiteEvidence(entry, code),
    ),
  };
}

export function readManagedProvisioningOperation(
  value: unknown,
): ManagedProvisioningOperation {
  const code = "INVALID_MANAGED_PROVISIONING_OPERATION_RESPONSE";
  const operation = object(value, code);
  const type = oneOf(operation.type, TENANT_OPERATION_TYPES, code);
  if (type === "INITIAL_PROVISION" || type === "RETRY") invalid(code);
  return {
    operationId: uuidV7(operation.operationId, code),
    tenantId: uuidV7(operation.tenantId, code),
    type,
    status: oneOf(operation.status, TENANT_OPERATION_STATUSES, code),
    generation: positiveInteger(operation.generation, code),
    planDigest: sha256(operation.planDigest, code),
    replayed: boolean(operation.replayed, code),
  };
}

export function readSeedConflictResolution(
  value: unknown,
): SeedConflictResolution {
  const code = "INVALID_SEED_CONFLICT_RESOLUTION_RESPONSE";
  const resolution = object(value, code);
  return {
    resolutionId: uuidV7(resolution.resolutionId, code),
    tenantId: uuidV7(resolution.tenantId, code),
    seedStateId: uuidV7(resolution.seedStateId, code),
    decision: oneOf(resolution.decision, SEED_CONFLICT_DECISIONS, code),
    expectedConflictRevision: positiveInteger(
      resolution.expectedConflictRevision,
      code,
    ),
    resolutionDigest: sha256(resolution.resolutionDigest, code),
    resolvedAt: isoDate(resolution.resolvedAt, code),
  };
}

export function isOperationTerminal(status: string): boolean {
  return (
    status === "SUCCEEDED" ||
    status === "FAILED_RETRYABLE" ||
    status === "MANUAL_RECOVERY_REQUIRED" ||
    status === "CANCELLED"
  );
}

export function canResolveSeedConflict(seed: TenantSeedState): boolean {
  return (
    seed.status === "CONFLICT" &&
    seed.revision !== null &&
    seed.appliedChecksum !== null &&
    seed.desiredChecksum !== null
  );
}

function readActor(value: unknown, code: string): TenantOperationActor {
  const actor = object(value, code);
  return {
    type: oneOf(actor.type, TENANT_OPERATION_ACTOR_TYPES, code),
    id: nullableUuidV7(actor.id, code),
  };
}

function readSafeError(value: unknown, code: string): SafeOperationError | null {
  if (value === null) return null;
  const error = object(value, code);
  return {
    code: nullableString(error.code, code, 160),
    message: nullableString(error.message, code, 1_000),
  };
}

function readProgress(value: unknown, code: string): TenantOperationProgress {
  const progress = object(value, code);
  const percent = nonNegativeInteger(progress.percent, code);
  if (percent > 100) invalid(code);
  return {
    totalSteps: nonNegativeInteger(progress.totalSteps, code),
    completedSteps: nonNegativeInteger(progress.completedSteps, code),
    failedSteps: nonNegativeInteger(progress.failedSteps, code),
    totalWeight: nonNegativeInteger(progress.totalWeight, code),
    completedWeight: nonNegativeInteger(progress.completedWeight, code),
    percent,
  };
}

function readSafeReleaseEvidence(
  value: unknown,
  code: string,
): SafeReleaseEvidence {
  const release = object(value, code);
  return {
    id: uuidV7(release.id, code),
    releaseVersion: requiredString(release.releaseVersion, code, 120),
    manifestVersion: positiveInteger(release.manifestVersion, code),
    schemaTarget: requiredString(release.schemaTarget, code, 120),
    manifestChecksum: sha256(release.manifestChecksum, code),
    riskLevel: oneOf(release.riskLevel, RELEASE_RISK_LEVELS, code),
    selfServiceAllowed: boolean(release.selfServiceAllowed, code),
    requiresBackup: boolean(release.requiresBackup, code),
    requiresMaintenance: boolean(release.requiresMaintenance, code),
    publishedAt: isoDate(release.publishedAt, code),
  };
}

function readReleaseState(value: unknown, code: string): TenantReleaseState {
  const state = object(value, code);
  return {
    releaseId: nullableUuidV7(state.releaseId, code),
    releaseVersion: nullableString(state.releaseVersion, code, 120),
    schemaVersion: nullableString(state.schemaVersion, code, 120),
    manifestChecksum: nullableSha256(state.manifestChecksum, code),
  };
}

function readPrerequisiteReleasePin(
  value: unknown,
  code: string,
): PrerequisiteReleasePin {
  const pin = object(value, code);
  return {
    componentKey: componentKey(pin.componentKey, code),
    releaseId: uuidV7(pin.releaseId, code),
    releaseVersion: requiredString(pin.releaseVersion, code, 120),
    manifestChecksum: sha256(pin.manifestChecksum, code),
    requiresBackup: boolean(pin.requiresBackup, code),
    requiresMaintenance: boolean(pin.requiresMaintenance, code),
  };
}

function readMaintenanceFence(
  value: unknown,
  code: string,
): TenantMaintenanceFence {
  const fence = object(value, code);
  return {
    fenceId: uuidV7(fence.fenceId, code),
    status: oneOf(fence.status, MAINTENANCE_FENCE_STATUSES, code),
    accessPolicyRevision: positiveInteger(fence.accessPolicyRevision, code),
    fencedAt: isoDate(fence.fencedAt, code),
    expiresAt: isoDate(fence.expiresAt, code),
    releasedAt: nullableIsoDate(fence.releasedAt, code),
    evidenceDigest: nullableSha256(fence.evidenceDigest, code),
  };
}

function readPrerequisiteEvidence(
  value: unknown,
  code: string,
): TenantPrerequisiteEvidence {
  const evidence = object(value, code);
  const backup = evidence.backupEvidence;
  const maintenance = evidence.maintenanceEvidence;
  return {
    evidenceId: uuidV7(evidence.evidenceId, code),
    status: oneOf(evidence.status, PREREQUISITE_EVIDENCE_STATUSES, code),
    evidenceDigest: sha256(evidence.evidenceDigest, code),
    safeCode: nullableString(evidence.safeCode, code, 160),
    occurredAt: isoDate(evidence.occurredAt, code),
    expiresAt: isoDate(evidence.expiresAt, code),
    backupEvidence:
      backup === null
        ? null
        : (() => {
            const item = object(backup, code);
            return {
              runId: uuidV7(item.runId, code),
              artifactId: uuidV7(item.artifactId, code),
              artifactSha256: sha256(item.artifactSha256, code),
              sizeBytes: unsignedIntegerString(item.sizeBytes, code),
              completedAt: isoDate(item.completedAt, code),
            };
          })(),
    maintenanceEvidence:
      maintenance === null
        ? null
        : (() => {
            const item = object(maintenance, code);
            return {
              leaseId: uuidV7(item.leaseId, code),
              fenceId: uuidV7(item.fenceId, code),
              accessPolicyRevision: positiveInteger(
                item.accessPolicyRevision,
                code,
              ),
              drainedAt: isoDate(item.drainedAt, code),
              activeSessionCount: nonNegativeInteger(
                item.activeSessionCount,
                code,
              ),
              aclSnapshotDigest: sha256(item.aclSnapshotDigest, code),
              runtimePrincipalsDigest: sha256(
                item.runtimePrincipalsDigest,
                code,
              ),
              terminatedSessionCount: nonNegativeInteger(
                item.terminatedSessionCount,
                code,
              ),
              preparedTransactionCount: nonNegativeInteger(
                item.preparedTransactionCount,
                code,
              ),
              restoredAt: nullableIsoDate(item.restoredAt, code),
            };
          })(),
  };
}

function object(value: unknown, code: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(code);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, code: string): unknown[] {
  if (!Array.isArray(value)) invalid(code);
  return value;
}

function requiredString(value: unknown, code: string, maximum = 4_000): string {
  if (typeof value !== "string") invalid(code);
  const result = value.trim();
  if (!result || result.length > maximum) invalid(code);
  return result;
}

function nullableString(
  value: unknown,
  code: string,
  maximum = 4_000,
): string | null {
  if (value === null) return null;
  return requiredString(value, code, maximum);
}

function boolean(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") invalid(code);
  return value;
}

function nonNegativeInteger(value: unknown, code: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    invalid(code);
  }
  return value;
}

function positiveInteger(value: unknown, code: string): number {
  const result = nonNegativeInteger(value, code);
  if (result < 1) invalid(code);
  return result;
}

function uuidV7(value: unknown, code: string): string {
  const result = requiredString(value, code, 36);
  if (!UUID_V7_PATTERN.test(result)) invalid(code);
  return result.toLowerCase();
}

function nullableUuidV7(value: unknown, code: string): string | null {
  return value === null ? null : uuidV7(value, code);
}

function sha256(value: unknown, code: string): string {
  const result = requiredString(value, code, 64);
  if (!SHA256_PATTERN.test(result)) invalid(code);
  return result;
}

function nullableSha256(value: unknown, code: string): string | null {
  return value === null ? null : sha256(value, code);
}

function componentKey(value: unknown, code: string): string {
  const result = requiredString(value, code, 96);
  if (!COMPONENT_KEY_PATTERN.test(result)) invalid(code);
  return result;
}

function nullableComponentKey(value: unknown, code: string): string | null {
  return value === null ? null : componentKey(value, code);
}

function seedKey(value: unknown, code: string): string {
  const result = requiredString(value, code, 128);
  if (!/^[a-z][a-z0-9_.-]{1,127}$/u.test(result)) invalid(code);
  return result;
}

function isoDate(value: unknown, code: string): string {
  const result = requiredString(value, code, 64);
  if (!Number.isFinite(Date.parse(result))) invalid(code);
  return result;
}

function nullableIsoDate(value: unknown, code: string): string | null {
  return value === null ? null : isoDate(value, code);
}

function unsignedIntegerString(value: unknown, code: string): string {
  const result = requiredString(value, code, 32);
  if (!/^(?:0|[1-9]\d*)$/u.test(result)) invalid(code);
  return result;
}

function oneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  code: string,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) invalid(code);
  return value as Values[number];
}

function exact<const Value extends string>(
  value: unknown,
  expected: Value,
  code: string,
): Value {
  if (value !== expected) invalid(code);
  return expected;
}

function invalid(code: string): never {
  throw new Error(code);
}

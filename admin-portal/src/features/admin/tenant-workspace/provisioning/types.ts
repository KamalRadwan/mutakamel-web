import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { PaginationMeta } from "@/types/common";

export type { PaginationMeta };

export const TENANT_OPERATION_TYPES = [
  "INITIAL_PROVISION",
  "RETRY",
  "UPDATE",
  "ADD_APPLICATION",
  "REPAIR",
  "DECOMMISSION",
] as const;

type TenantOperationType = (typeof TENANT_OPERATION_TYPES)[number];

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

export type TenantOperationStatus = (typeof TENANT_OPERATION_STATUSES)[number];

export const TENANT_OPERATION_ACTOR_TYPES = [
  "ADMIN",
  "TENANT_USER",
  "SYSTEM",
] as const;

type TenantOperationActorType =
  (typeof TENANT_OPERATION_ACTOR_TYPES)[number];

export const TENANT_OPERATION_STEP_KINDS = [
  "DATABASE",
  "SCHEMA",
  "SYSTEM_SEED",
  "REFERENCE_SEED",
  "IDENTITY",
  "CONFIG",
  "VERIFICATION",
  "NOTIFICATION",
  "ACTIVATION",
] as const;

type TenantOperationStepKind =
  (typeof TENANT_OPERATION_STEP_KINDS)[number];

export const TENANT_OPERATION_STEP_STATUSES = [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "SKIPPED",
  "CONFLICT",
  "CANCELLED",
] as const;

export type TenantOperationStepStatus =
  (typeof TENANT_OPERATION_STEP_STATUSES)[number];

export const TENANT_COMPONENT_INSTALLATION_STATES = [
  "NOT_INSTALLED",
  "PENDING",
  "INSTALLING",
  "READY",
  "FAILED",
  "OUTDATED",
  "DRIFTED",
  "DISABLED_RETAINED",
  "INCOMPATIBLE",
] as const;

type TenantComponentInstallationState =
  (typeof TENANT_COMPONENT_INSTALLATION_STATES)[number];

export const TENANT_COMPONENT_SELECTION_SOURCES = [
  "FOUNDATION",
  "ENTITLEMENT",
  "DEPENDENCY",
] as const;

type TenantComponentSelectionSource =
  (typeof TENANT_COMPONENT_SELECTION_SOURCES)[number];

export const TENANT_SEED_POLICIES = [
  "SYSTEM_MANAGED",
  "CREATE_ONCE",
  "CREATE_IF_MISSING",
  "PATCH_IF_UNMODIFIED",
  "ADDITIVE",
  "TRANSFORM",
  "MANUAL_CONFLICT",
] as const;

type TenantSeedPolicy = (typeof TENANT_SEED_POLICIES)[number];

export const TENANT_SEED_STATUSES = [
  "PENDING",
  "APPLYING",
  "APPLIED",
  "NOOP",
  "CONFLICT",
  "FAILED",
  "SKIPPED_NOT_SELECTED",
] as const;

type TenantSeedStatus = (typeof TENANT_SEED_STATUSES)[number];

export const RELEASE_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
type ReleaseRiskLevel = (typeof RELEASE_RISK_LEVELS)[number];

export const PREREQUISITE_REQUEST_STATUSES = [
  "REQUESTED",
  "SUCCEEDED",
  "FAILED",
  "RELEASE_REQUESTED",
  "RELEASED",
  "EXPIRED_AWAITING_RELEASE",
] as const;

type PrerequisiteRequestStatus =
  (typeof PREREQUISITE_REQUEST_STATUSES)[number];

export const MAINTENANCE_FENCE_STATUSES = [
  "REQUESTED",
  "ACTIVE",
  "RELEASE_REQUESTED",
  "RELEASED",
  "EXPIRED_AWAITING_RELEASE",
] as const;

type MaintenanceFenceStatus =
  (typeof MAINTENANCE_FENCE_STATUSES)[number];

export const PREREQUISITE_EVIDENCE_STATUSES = [
  "SUCCEEDED",
  "FAILED",
  "RELEASED",
  "EXPIRED",
] as const;

type PrerequisiteEvidenceStatus =
  (typeof PREREQUISITE_EVIDENCE_STATUSES)[number];

export const SEED_CONFLICT_DECISIONS = [
  "KEEP_TENANT_VALUE",
  "APPLY_RELEASE_VALUE_IF_UNMODIFIED",
  "SKIP_THIS_RELEASE",
] as const;

export type SeedConflictDecision = (typeof SEED_CONFLICT_DECISIONS)[number];

export interface ProvisioningPage<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface SafeOperationError {
  code: string | null;
  message: string | null;
}

export interface TenantOperationActor {
  type: TenantOperationActorType;
  id: string | null;
}

export interface TenantOperationSummary {
  id: string;
  tenantId: string;
  generation: number;
  type: TenantOperationType;
  status: TenantOperationStatus;
  currentPhase: string;
  planDigest: string;
  accessPolicyRevision: number;
  actor: TenantOperationActor;
  reason: string | null;
  requestedAt: string;
  startedAt: string | null;
  heartbeatAt: string | null;
  cancellationRequestedAt: string | null;
  completedAt: string | null;
  safeError: SafeOperationError | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantOperationStep {
  id: string;
  componentId: string | null;
  componentKey: string | null;
  stepKey: string;
  kind: TenantOperationStepKind;
  status: TenantOperationStepStatus;
  required: boolean;
  activationRequired: boolean;
  weight: number;
  attemptCount: number;
  retryable: boolean;
  dependsOnStepKeys: string[];
  fromVersion: string | null;
  targetVersion: string | null;
  appliedVersion: string | null;
  targetChecksum: string | null;
  appliedChecksum: string | null;
  producer: string | null;
  startedAt: string | null;
  heartbeatAt: string | null;
  finishedAt: string | null;
  safeError: SafeOperationError | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantOperationProgress {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  totalWeight: number;
  completedWeight: number;
  percent: number;
}

export interface TenantOperationDetail extends TenantOperationSummary {
  prerequisiteCount: number;
  progress: TenantOperationProgress;
  timelineEventCount: number;
  steps: TenantOperationStep[];
}

export interface TenantOperationTimelineEvent {
  id: string;
  eventId: string;
  sequence: string;
  componentId: string | null;
  componentKey: string | null;
  stepId: string | null;
  eventType: string;
  phase: string | null;
  status: string | null;
  actor: TenantOperationActor;
  message: string | null;
  occurredAt: string;
}

export interface TenantProvisioningCommandResult {
  replayed: boolean;
  operation: TenantOperationDetail;
}

export interface SafeReleaseEvidence {
  id: string;
  releaseVersion: string;
  manifestVersion: number;
  schemaTarget: string;
  manifestChecksum: string;
  riskLevel: ReleaseRiskLevel;
  selfServiceAllowed: boolean;
  requiresBackup: boolean;
  requiresMaintenance: boolean;
  publishedAt: string;
}

export interface TenantAvailableUpdate {
  componentId: string;
  componentKey: string;
  ownerApp: string;
  installationState: TenantComponentInstallationState;
  current: {
    releaseId: string;
    releaseVersion: string;
    schemaVersion: string | null;
    manifestChecksum: string | null;
  };
  desiredReleaseId: string | null;
  updateAlreadyPlanned: boolean;
  availableRelease: SafeReleaseEvidence & {
    schemaChecksum: string | null;
    compatibilityContractVersion: 1;
  };
}

export interface TenantReleaseState {
  releaseId: string | null;
  releaseVersion: string | null;
  schemaVersion: string | null;
  manifestChecksum: string | null;
}

export interface TenantComponentInstallation {
  id: string;
  tenantId: string;
  componentId: string;
  componentKey: string;
  ownerApp: string;
  generation: number;
  selectionSource: TenantComponentSelectionSource;
  activationRequired: boolean;
  evidenceOrigin: "PROVISIONED";
  state: TenantComponentInstallationState;
  desired: TenantReleaseState;
  applied: TenantReleaseState;
  latestPublishedRelease: SafeReleaseEvidence | null;
  updateAvailable: boolean;
  updateAlreadyPlanned: boolean;
  lastOperationId: string | null;
  installedAt: string | null;
  readyAt: string | null;
  disabledAt: string | null;
  lastVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenantSeedState {
  id: string;
  tenantId: string;
  componentId: string;
  componentKey: string;
  seedKey: string;
  policy: TenantSeedPolicy;
  status: TenantSeedStatus;
  desiredVersion: string | null;
  appliedVersion: string | null;
  desiredChecksum: string | null;
  appliedChecksum: string | null;
  updateAvailable: boolean;
  customizedAt: string | null;
  conflictCode: string | null;
  lastOperationId: string | null;
  /**
   * Older/incompatible responses may omit this safe concurrency fence. Null
   * disables resolution; callers never invent it.
   */
  revision: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrerequisiteReleasePin {
  componentKey: string;
  releaseId: string;
  releaseVersion: string;
  manifestChecksum: string;
  requiresBackup: boolean;
  requiresMaintenance: boolean;
}

export interface TenantPrerequisiteRequest {
  requestId: string;
  tenantId: string;
  operationId: string;
  generation: number;
  planDigest: string;
  requestDigest: string;
  status: PrerequisiteRequestStatus;
  releasePins: PrerequisiteReleasePin[];
  safeCode: string | null;
  requestedAt: string;
  expiresAt: string;
  completedAt: string | null;
  releasedAt: string | null;
}

export interface TenantMaintenanceFence {
  fenceId: string;
  status: MaintenanceFenceStatus;
  accessPolicyRevision: number;
  fencedAt: string;
  expiresAt: string;
  releasedAt: string | null;
  evidenceDigest: string | null;
}

export interface TenantPrerequisiteEvidence {
  evidenceId: string;
  status: PrerequisiteEvidenceStatus;
  evidenceDigest: string;
  safeCode: string | null;
  occurredAt: string;
  expiresAt: string;
  backupEvidence: {
    runId: string;
    artifactId: string;
    artifactSha256: string;
    sizeBytes: string;
    completedAt: string;
  } | null;
  maintenanceEvidence: {
    leaseId: string;
    fenceId: string;
    accessPolicyRevision: number;
    drainedAt: string;
    activeSessionCount: number;
    aclSnapshotDigest: string;
    runtimePrincipalsDigest: string;
    terminatedSessionCount: number;
    preparedTransactionCount: number;
    restoredAt: string | null;
  } | null;
}

export interface TenantPrerequisiteEvidenceRecord
  extends TenantPrerequisiteRequest {
  maintenanceFence: TenantMaintenanceFence | null;
  evidence: TenantPrerequisiteEvidence[];
}

interface FleetTargetSelection {
  componentKey: string;
  componentId: string;
  targetReleaseId: string;
  targetReleaseVersion: string;
  targetManifestChecksum: string;
}

export interface ApplyTenantUpdatesDto {
  selections: Array<{
    componentKey: string;
    targetReleaseId: string;
    targetReleaseVersion: string;
    targetManifestChecksum: string;
    currentAppliedReleaseId: string;
    currentAppliedManifestChecksum: string;
  }>;
}

export interface RequestTenantPrerequisiteDto {
  operationId: string;
  expectedPlanDigest: string;
  reasonCode: string;
}

export interface CreateAddApplicationOperationDto {
  applicationKey: string;
  expectedAccessPolicyRevision: number;
  targetSelection: FleetTargetSelection[];
  reasonCode: string;
}

export interface CreateRepairOperationDto {
  componentKey: string;
  currentDesiredReleaseId: string;
  currentDesiredManifestChecksum: string;
  currentAppliedReleaseId?: string;
  currentAppliedManifestChecksum?: string;
  targetReleaseId: string;
  targetManifestChecksum: string;
  reasonCode: string;
  conflictResolutionIds?: string[];
}

export interface CreateDecommissionOperationDto {
  componentKey: string;
  currentDesiredReleaseId: string;
  currentDesiredManifestChecksum: string;
  currentAppliedReleaseId: string;
  currentAppliedManifestChecksum: string;
  retentionAcknowledged: true;
  reasonCode: string;
}

export interface ResolveTenantSeedConflictDto {
  decision: SeedConflictDecision;
  reasonCode: string;
  expectedConflictRevision: number;
  expectedStatus: "CONFLICT";
  expectedAppliedChecksum: string;
  expectedDesiredChecksum: string;
}

export interface ManagedProvisioningOperation {
  operationId: string;
  tenantId: string;
  type: Exclude<TenantOperationType, "INITIAL_PROVISION" | "RETRY">;
  status: TenantOperationStatus;
  generation: number;
  planDigest: string;
  replayed: boolean;
}

export interface SeedConflictResolution {
  resolutionId: string;
  tenantId: string;
  seedStateId: string;
  decision: SeedConflictDecision;
  expectedConflictRevision: number;
  resolutionDigest: string;
  resolvedAt: string;
}

export interface TenantOperationQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: TenantOperationType;
  status?: TenantOperationStatus;
  sortBy?: "requestedAt" | "generation" | "status" | "completedAt";
  sortDir?: "ASC" | "DESC";
}

export interface TenantOperationTimelineQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "sequence" | "occurredAt";
  sortDir?: "ASC" | "DESC";
}

export interface TenantAvailableUpdateQuery {
  page?: number;
  limit?: number;
  search?: string;
  componentKey?: string;
  riskLevel?: ReleaseRiskLevel;
  requiresBackup?: boolean;
  requiresMaintenance?: boolean;
  sortBy?: "componentKey" | "publishedAt" | "riskLevel";
  sortDir?: "ASC" | "DESC";
}

export interface TenantComponentStateQuery {
  page?: number;
  limit?: number;
  search?: string;
  componentKey?: string;
  state?: TenantComponentInstallationState;
  selectionSource?: TenantComponentSelectionSource;
  sortBy?: "state" | "createdAt" | "updatedAt";
  sortDir?: "ASC" | "DESC";
}

export interface TenantSeedStateQuery {
  page?: number;
  limit?: number;
  search?: string;
  componentKey?: string;
  seedKey?: string;
  policy?: TenantSeedPolicy;
  status?: TenantSeedStatus;
  sortBy?: "seedKey" | "status" | "createdAt" | "updatedAt";
  sortDir?: "ASC" | "DESC";
}

type ProvisioningResourceStatus =
  | "idle"
  | "loading"
  | "ready"
  | "forbidden"
  | "error";

export interface ProvisioningResource<T> {
  status: ProvisioningResourceStatus;
  data: T;
  error: NormalizedApiError | null;
  refreshing: boolean;
}

export type ProvisioningMutationName =
  | "retry"
  | "cancel"
  | "apply-updates"
  | "request-prerequisites"
  | "add-application"
  | "repair"
  | "decommission"
  | "resolve-seed-conflict";

export interface ProvisioningMutationState {
  name: ProvisioningMutationName | null;
  intentKey: string | null;
  error: NormalizedApiError | null;
}

export interface ProvisioningPermissions {
  canReadOperations: boolean;
  canRetryOrCancel: boolean;
  canApplyUpdates: boolean;
  canReadPrerequisites: boolean;
  canRequestPrerequisites: boolean;
  canAddApplication: boolean;
  canRepair: boolean;
  canDecommission: boolean;
  canResolveConflicts: boolean;
}

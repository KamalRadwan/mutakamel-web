import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

export const FLEET_OPERATION_TYPES = [
  "UPDATE",
  "ADD_APPLICATION",
  "REPAIR",
  "DECOMMISSION",
] as const;
export type FleetOperationType = (typeof FLEET_OPERATION_TYPES)[number];

export const FLEET_ROLLOUT_STATUSES = [
  "DRAFT",
  "RUNNING",
  "PAUSED",
  "CANCEL_REQUESTED",
  "CANCELLED",
  "SUCCEEDED",
  "FAILED",
] as const;
export type FleetRolloutStatus = (typeof FLEET_ROLLOUT_STATUSES)[number];

export const FLEET_TENANT_STATUSES = [
  "ELIGIBLE",
  "INELIGIBLE",
  "PENDING",
  "DISPATCHED",
  "SUCCEEDED",
  "FAILED",
  "SKIPPED",
  "CANCELLED",
] as const;
export type FleetTenantStatus = (typeof FLEET_TENANT_STATUSES)[number];

export type TenantLifecycleStatus = "ACTIVE" | "SUSPENDED";

export interface FleetTargetSelection {
  componentKey: string;
  componentId: string;
  targetReleaseId: string;
  targetReleaseVersion: string;
  targetManifestChecksum: string;
  expectedCurrentReleaseId?: string;
  expectedCurrentManifestChecksum?: string;
}

export type FleetOperationCommand =
  | Record<string, never>
  | { applicationKey: string }
  | { componentKey: string; retentionAcknowledged: true };

export type FleetSelectionFilter =
  | {
      tenantIds: string[];
      tenantStatuses?: TenantLifecycleStatus[];
    }
  | {
      allEligibleTenantsAcknowledged: true;
      tenantStatuses?: TenantLifecycleStatus[];
    };

export interface CreateFleetPreviewCommand {
  operationType: FleetOperationType;
  applicationKey?: string;
  componentKey?: string;
  retentionAcknowledged?: boolean;
  targetSelection?: FleetTargetSelection[];
  selectionFilter: FleetSelectionFilter;
}

export interface FleetPreview {
  previewId: string;
  operationType: FleetOperationType;
  operationCommand: FleetOperationCommand;
  targetSelection: FleetTargetSelection[];
  targetSelectionDigest: string;
  selectionFilter: FleetSelectionFilter;
  selectionDigest: string;
  eligibleCount: number;
  ineligibleCount: number;
  expiresAt: string;
  createdAt: string;
}

export interface FleetPreviewTenant {
  tenantId: string;
  eligible: boolean;
  deterministicRank: number;
  safeReasonCode: string | null;
  eligibilityDigest: string;
}

export interface CreateFleetRolloutCommand {
  previewId: string;
  expectedSelectionDigest: string;
  canarySize: number;
  batchSize: number;
  maxParallel: number;
  failureThreshold: number;
}

export interface ManageFleetRolloutCommand {
  expectedRevision: number;
  reasonCode: string;
}

export type FleetManageAction = "pause" | "resume" | "cancel";

export interface FleetRollout {
  rolloutId: string;
  previewId: string;
  operationType: FleetOperationType;
  operationCommand: FleetOperationCommand;
  targetSelection: FleetTargetSelection[];
  targetSelectionDigest: string;
  selectionDigest: string;
  status: FleetRolloutStatus;
  canarySize: number;
  batchSize: number;
  maxParallel: number;
  failureThreshold: number;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  currentBatch: number;
  revision: number;
  safeReasonCode: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface FleetRolloutTenant {
  tenantId: string;
  deterministicRank: number;
  batchNumber: number;
  status: FleetTenantStatus;
  operationId: string | null;
  eligibilityDigest: string;
  evidenceDigest: string | null;
  safeReasonCode: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
}

export type FleetReportStatus =
  | "NOT_READY"
  | "READY_FOR_ATTESTATION"
  | "ATTESTED";

export interface FleetReport {
  rolloutId: string;
  revision: number;
  status: FleetReportStatus;
  payloadBase64: string | null;
  signingDigest: string | null;
  reportDigest: string | null;
  generatedAt: string | null;
  publisherKeyId: string | null;
  signatureAlgorithm: "Ed25519" | null;
  signatureBase64: string | null;
  attestedAt: string | null;
  attestedByActorRef: string | null;
}

export interface AttestFleetReportCommand {
  expectedRevision: number;
  publisherKeyId: string;
  signatureAlgorithm: "Ed25519";
  signatureBase64: string;
}

export interface FleetPage<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  correlationId: string;
  timestamp: string;
}

export interface FleetResult<T> {
  data: T;
  correlationId: string;
  timestamp: string;
}

export type FleetRequestState =
  | "IDLE"
  | "LOADING"
  | "READY"
  | "EMPTY"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "UNAVAILABLE"
  | "INVALID"
  | "ERROR";

export interface FleetView<T> {
  state: FleetRequestState;
  data: T | null;
  error: NormalizedApiError | null;
  isRefreshing: boolean;
}

export type FleetCommandState =
  | "IDLE"
  | "PENDING"
  | "SUCCESS"
  | "FORBIDDEN"
  | "VALIDATION"
  | "STALE"
  | "CONFLICT"
  | "AMBIGUOUS"
  | "ERROR";

export interface FleetCommandView<T> {
  state: FleetCommandState;
  result: T | null;
  error: NormalizedApiError | null;
  exactRetryAvailable: boolean;
  idempotencyKey: string | null;
}

export interface FleetTargetDraft {
  componentKey: string;
  componentId: string;
  targetReleaseId: string;
  targetReleaseVersion: string;
  targetManifestChecksum: string;
  expectedCurrentReleaseId: string;
  expectedCurrentManifestChecksum: string;
}

export interface FleetPreviewDraft {
  operationType: FleetOperationType;
  applicationKey: string;
  componentKey: string;
  retentionAcknowledged: boolean;
  targets: FleetTargetDraft[];
  broadSelection: boolean;
  allEligibleTenantsAcknowledged: boolean;
  tenantIdsText: string;
  tenantStatuses: TenantLifecycleStatus[];
}

export interface FleetRolloutDraft {
  canarySize: string;
  batchSize: string;
  maxParallel: string;
  failureThreshold: string;
}

export interface FleetManageDraft {
  expectedRevision: string;
  reasonCode: string;
}

export interface FleetAttestationDraft {
  expectedRevision: string;
  publisherKeyId: string;
  signatureBase64: string;
}

export type FieldErrors = Record<string, string>;

export type StorageServerProvider = "GARAGE";
export type StorageServerPlacementRole = "GENERAL" | "BACKUP_ONLY";
export type StorageServerStatus = "DRAFT" | "ACTIVE" | "DRAINING" | "OFFLINE";
export type StorageServerAvailabilityClass =
  | "DEGRADED_SINGLE_NODE"
  | "SINGLE_NODE_OPERATIONAL"
  | "BACKUP_TARGET_OPERATIONAL"
  | "HA_PRODUCTION_READY";
export type StorageServerHealthStatus = "UNKNOWN" | "HEALTHY" | "UNHEALTHY";
export type StorageVerificationStatus = "PENDING" | "PASS" | "FAIL" | "EXPIRED";
export type StoragePrincipal =
  | "CORE"
  | "CRM"
  | "TRADE"
  | "WORKER"
  | "BACKUP"
  | "PROBE";
export type StorageCredentialRole = "OPERATION" | "SIGNING";
export type StorageServerHistoryAction =
  | "BOOTSTRAPPED"
  | "CREATED"
  | "UPDATED"
  | "BINDINGS_CHANGED"
  | "PRINCIPAL_ROTATED"
  | "VERIFIED"
  | "ACTIVATED"
  | "DRAINED"
  | "OFFLINED"
  | "DELETED";

export interface StorageServerAdminView {
  id: string;
  code: string;
  name: string;
  provider: StorageServerProvider;
  placementRole: StorageServerPlacementRole;
  internalEndpoint: string;
  publicEndpoint: string;
  region: string;
  forcePathStyle: true;
  configRevision: number;
  bindingRevision: number;
  readinessRevision: number;
  status: StorageServerStatus;
  availabilityClass: StorageServerAvailabilityClass;
  healthStatus: StorageServerHealthStatus;
  maxTenants: number;
  currentTenants: number;
  retainedTenants: number;
  reservedTenants: number;
  desiredNodeCount: number;
  desiredZoneCount: number;
  requiredReplicationFactor: number;
  observedNodeCount: number | null;
  observedZoneCount: number | null;
  observedReplicationFactor: number | null;
  usableCapacityBytes: string | null;
  usedCapacityBytes: string | null;
  allocatableCapacityBytes: string | null;
  activeReservedCapacityBytes: string;
  warningPercent: number;
  criticalPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface StorageServerDraft {
  name: string;
  internalEndpoint: string;
  publicEndpoint: string;
  region: string;
  placementRole: StorageServerPlacementRole;
  desiredNodeCount: number;
  desiredZoneCount: number;
  requiredReplicationFactor: number;
  maxTenants: number;
  warningPercent: number;
  criticalPercent: number;
}

export interface CreateStorageServerDto extends StorageServerDraft {
  code: string;
  forcePathStyle: true;
}

export type UpdateStorageServerDto = Partial<StorageServerDraft>;

export interface StorageServerHistoryChange {
  field: string;
  previousValue: string | number | boolean | null;
  nextValue: string | number | boolean | null;
}

export interface StorageServerHistoryItem {
  id: string;
  action: StorageServerHistoryAction;
  configRevision: number;
  bindingRevision: number;
  readinessRevision: number;
  changes: StorageServerHistoryChange[];
  actorId: string | null;
  correlationId: string | null;
  createdAt: string;
}

export interface StorageServerListResponse {
  items: StorageServerAdminView[];
  total: number;
}

export interface StorageServerHistoryResponse {
  items: StorageServerHistoryItem[];
  total: number;
}

export interface StorageVerificationRunStartView {
  verificationRunId: string;
  correlationId: string;
  status: StorageVerificationStatus;
  expiresAt: string;
}

export interface StorageVerificationResultView {
  principal: StoragePrincipal;
  credentialRole: StorageCredentialRole;
  status: "PASS" | "FAIL";
  verifiedAt: string;
}

export interface StorageVerificationRunView {
  id: string;
  status: StorageVerificationStatus;
  configRevision: number;
  bindingRevision: number;
  readinessRevision: number;
  probeProfileVersion: 1;
  requestedAt: string;
  expiresAt: string;
  completedAt: string | null;
  correlationId: string;
  results: StorageVerificationResultView[];
}

export interface StorageApiError {
  status?: number;
  code: string;
  message: string;
  correlationId?: string;
  fieldErrors: Record<string, string>;
  ambiguous: boolean;
}

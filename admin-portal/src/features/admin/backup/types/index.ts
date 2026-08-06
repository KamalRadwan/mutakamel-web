export const BackupRunStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  COMPLETED_WITH_ERRORS: "COMPLETED_WITH_ERRORS",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;

export type BackupRunStatus =
  (typeof BackupRunStatus)[keyof typeof BackupRunStatus];

export const BackupArtifactStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
  EXPIRED: "EXPIRED",
} as const;

export type BackupArtifactStatus =
  (typeof BackupArtifactStatus)[keyof typeof BackupArtifactStatus];

export const BackupTrigger = {
  SCHEDULE: "schedule",
  MANUAL: "manual",
} as const;

export type BackupTrigger =
  (typeof BackupTrigger)[keyof typeof BackupTrigger];

export const BackupCompressionAlgorithm = {
  NONE: "none",
  GZIP: "gzip",
} as const;

export type BackupCompressionAlgorithm =
  (typeof BackupCompressionAlgorithm)[keyof typeof BackupCompressionAlgorithm];

export const RestoreRunStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  VERIFIED: "VERIFIED",
  FAILED: "FAILED",
  PROMOTED: "PROMOTED",
  CANCELLED: "CANCELLED",
} as const;

export type RestoreRunStatus =
  (typeof RestoreRunStatus)[keyof typeof RestoreRunStatus];

export const RestoreTrigger = {
  MANUAL: "manual",
} as const;

export type RestoreTrigger =
  (typeof RestoreTrigger)[keyof typeof RestoreTrigger];

export interface BackupPolicy {
  id: string;
  databaseServerId: string;
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  retentionDays: number;
  serverConcurrency: number;
  tenantConcurrency: number;
  defaultBackupEnabled: boolean;
  defaultCompressionEnabled: boolean;
  defaultCompressionAlgorithm: BackupCompressionAlgorithm;
  createdAt: string;
  updatedAt: string;
}

export interface BackupDatabaseOverride {
  id: string;
  databaseServerId: string;
  tenantId: string;
  databaseName: string;
  backupEnabled: boolean | null;
  compressionEnabled: boolean | null;
  compressionAlgorithm: BackupCompressionAlgorithm | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupDatabaseConfig {
  tenantId: string;
  tenantStatus: string;
  databaseName: string;
  backupEnabled: boolean;
  compressionEnabled: boolean;
  compressionAlgorithm: BackupCompressionAlgorithm;
  override?: BackupDatabaseOverride | null;
}

export interface BackupRun {
  id: string;
  databaseServerId: string;
  trigger: BackupTrigger;
  status: BackupRunStatus;
  totalTenants: number;
  succeededTenants: number;
  failedTenants: number;
  skippedTenants: number;
  reason: string | null;
  hasFailure: boolean;
  failureCode: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface BackupArtifact {
  id: string;
  runId: string;
  databaseServerId: string;
  tenantId: string;
  databaseName: string;
  status: BackupArtifactStatus;
  sizeBytes: string | null;
  sha256: string | null;
  compressionAlgorithm: BackupCompressionAlgorithm;
  hasFailure: boolean;
  failureCode: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface RestoreRun {
  id: string;
  artifactId: string;
  tenantId: string;
  databaseServerId: string;
  sourceDatabaseName: string;
  targetDatabaseName: string;
  status: RestoreRunStatus;
  hasVerification: boolean;
  reason: string | null;
  hasFailure: boolean;
  failureCode: string | null;
  startedAt: string;
  finishedAt: string | null;
  promotedAt: string | null;
  promoteReason: string | null;
}

export interface BackupPolicyListQuery {
  databaseServerId?: string;
  enabled?: boolean;
}

export interface UpsertBackupPolicyDto {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  retentionDays?: number;
  serverConcurrency: number;
  tenantConcurrency: number;
  defaultBackupEnabled: boolean;
  defaultCompressionEnabled: boolean;
  defaultCompressionAlgorithm: BackupCompressionAlgorithm;
}

export interface UpsertBackupDatabaseOverrideDto {
  backupEnabled?: boolean | null;
  compressionEnabled?: boolean | null;
  compressionAlgorithm?: BackupCompressionAlgorithm | null;
}

export interface StartBackupRunDto {
  databaseServerId: string;
  reason: string;
  tenantConcurrency?: number;
}

export interface BackupRunListQuery {
  databaseServerId?: string;
  status?: BackupRunStatus;
  policyId?: string;
}

export interface BackupArtifactListQuery {
  runId?: string;
  databaseServerId?: string;
  tenantId?: string;
}

export interface StartRestoreRunDto {
  artifactId: string;
  targetDatabaseName?: string;
  reason: string;
}

export interface PromoteRestoreRunDto {
  reason: string;
  confirmationText: string;
}

export interface RestoreRunListQuery {
  tenantId?: string;
  status?: RestoreRunStatus;
}

export type BackupDatabaseAccessBindingStatus =
  | "PENDING"
  | "PROVISIONING"
  | "READY"
  | "ROTATING"
  | "DEFERRED"
  | "RECONCILING"
  | "DEGRADED"
  | "DISABLED";

export interface BackupDatabaseAccessBinding {
  purpose: "BACKUP";
  databasePrincipal: "mutakamel_backup";
  status: BackupDatabaseAccessBindingStatus;
  credentialRevision: string;
  rotationEnabled: boolean;
  rotationIntervalHours: number;
  maintenanceWindowStartUtc: number;
  maintenanceWindowHours: number;
  rotationDueAt: string | null;
  lastRotationAttemptAt: string | null;
  lastRotationSucceededAt: string | null;
  retryAt: string | null;
  safeFailureCode: string | null;
  operationGeneration: string;
  hasStagedCandidate: boolean;
}

export interface BackupCredentialCommandDto {
  expectedCredentialRevision: string;
  reason: string;
}

export interface UpdateBackupRotationPolicyDto
  extends BackupCredentialCommandDto {
  rotationEnabled?: boolean;
  rotationIntervalHours?: number;
  maintenanceWindowStartUtc?: number;
  maintenanceWindowHours?: number;
}

export interface BackupCredentialMutationReceipt {
  databaseServerId: string;
  purpose: "BACKUP";
  databasePrincipal: "mutakamel_backup";
  credentialRevision: string;
  status: "READY";
}

export type BackupDatabaseServerStatus =
  | "DRAFT"
  | "ACTIVE"
  | "DRAINING"
  | "OFFLINE";

export interface BackupDatabaseServerOption {
  id: string;
  name: string;
  status: BackupDatabaseServerStatus;
  host?: string;
}

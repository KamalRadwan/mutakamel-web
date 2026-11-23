import { CorePage } from '../../../../core/api/core-page';

export type ComponentRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type InstallationState = 'READY' | 'OUTDATED';
export type OperationStatus =
  | 'REQUESTED'
  | 'PLANNING'
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_RETRY'
  | 'CANCEL_REQUESTED'
  | 'SUCCEEDED'
  | 'FAILED_RETRYABLE'
  | 'MANUAL_RECOVERY_REQUIRED'
  | 'CANCELLED';

export const TERMINAL_STATUSES: readonly OperationStatus[] = [
  'SUCCEEDED',
  'FAILED_RETRYABLE',
  'MANUAL_RECOVERY_REQUIRED',
  'CANCELLED',
]; // WAITING_RETRY is NOT terminal

export const KNOWN_OPERATION_STATUSES: ReadonlySet<string> = new Set<OperationStatus>([
  'REQUESTED',
  'PLANNING',
  'QUEUED',
  'RUNNING',
  'WAITING_RETRY',
  'CANCEL_REQUESTED',
  'SUCCEEDED',
  'FAILED_RETRYABLE',
  'MANUAL_RECOVERY_REQUIRED',
  'CANCELLED',
]);

export type OperationType =
  | 'INITIAL_PROVISION'
  | 'RETRY'
  | 'UPDATE'
  | 'ADD_APPLICATION'
  | 'ADDON_INSTALL'
  | 'REPAIR'
  | 'DECOMMISSION';

export type UpdateSortBy = 'componentKey' | 'publishedAt' | 'riskLevel';
export type SortDir = 'ASC' | 'DESC';

export interface AvailableRelease {
  id: string;
  releaseVersion: string;
  manifestVersion: number;
  schemaTarget: string;
  manifestChecksum: string; // sha256 hex
  riskLevel: ComponentRisk;
  selfServiceAllowed: boolean;
  requiresBackup: boolean;
  requiresMaintenance: boolean;
  publishedAt: string;
  schemaChecksum: string | null;
  compatibilityContractVersion: 1;
}

export interface CurrentRelease {
  releaseId: string;
  releaseVersion: string;
  schemaVersion: string | null;
  manifestChecksum: string | null;
}

export interface TenantAvailableUpdate {
  lastOperationId: string | null;
  componentId: string;
  componentKey: string; // unique
  ownerApp: string;
  installationState: InstallationState;
  current: CurrentRelease;
  desiredReleaseId: string | null;
  updateAlreadyPlanned: boolean; // desiredReleaseId === availableRelease.id
  availableRelease: AvailableRelease;
}

export interface UpdatesQuery {
  page: number;
  limit: number; // 25
  search?: string;
  componentKey?: string; // ^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9_-]*)*$ max 96
  riskLevel?: ComponentRisk;
  requiresBackup?: boolean;
  requiresMaintenance?: boolean;
  sortBy: UpdateSortBy;
  sortDir: SortDir; // default publishedAt DESC
}

/** Core's envelope keeps { data, meta } only; the service's checkedAt is dropped. */
export type UpdatesPageResult = CorePage<TenantAvailableUpdate>;

export interface UpdateSelection {
  // six required fields, verbatim from the row
  componentKey: string; // row.componentKey
  targetReleaseId: string; // availableRelease.id (uuid v7)
  targetReleaseVersion: string; // availableRelease.releaseVersion (1..120)
  targetManifestChecksum: string; // availableRelease.manifestChecksum
  currentAppliedReleaseId: string; // current.releaseId (uuid v7)
  currentAppliedManifestChecksum: string; // current.manifestChecksum
}

export interface ApplyUpdatesBody {
  selections: UpdateSelection[]; // 1..100, unique by componentKey
}

export interface OperationStep {
  id: string;
  componentKey: string;
  stepKey: string;
  status: string;
  fromVersion: string | null;
  targetVersion: string | null;
  safeError: { code: string; message: string } | null;
}

export interface TenantOperationDetail {
  id: string;
  type: OperationType;
  status: OperationStatus;
  currentPhase: string | null; // AWAITING_PREREQUISITES | PREREQUISITE_FAILED | PREREQUISITE_EXPIRED
  requestedAt: string;
  completedAt: string | null;
  updatedAt: string;
  safeError: { code: string; message: string } | null;
  progress: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    percent: number;
  };
  steps: OperationStep[];
}

export interface ApplyUpdatesResponse {
  replayed: boolean;
  operation: TenantOperationDetail; // HTTP 202
}

/** Backend operation projection; additional server fields are intentionally unused. */
export interface OperationDetailResponse extends Omit<TenantOperationDetail, 'safeError' | 'steps'> {
  safeError: { code: string | null; message: string | null } | null;
  steps: (Omit<OperationStep, 'componentKey' | 'safeError'> & {
    componentKey: string | null;
    safeError: { code: string | null; message: string | null } | null;
  })[];
}

/**
 * NEEDS_BACKUP_OR_MAINTENANCE: Core (tenant-provisioning-plan.service.ts) refuses a self-service
 * update whose release requires a backup or a maintenance window with 422
 * TENANT_PROVISIONING_NO_SELF_SERVICE_UPDATES, so the row cannot be selected.
 */
export type Eligibility =
  | 'ELIGIBLE'
  | 'PLANNED'
  | 'ADMIN_MANAGED'
  | 'NEEDS_BACKUP_OR_MAINTENANCE'
  | 'INCOMPLETE_EVIDENCE';

export interface SnapshotItem {
  selection: UpdateSelection;
  ownerApp: string;
  currentVersion: string;
  riskLevel: ComponentRisk;
  requiresBackup: boolean;
  requiresMaintenance: boolean;
}

export type ApplyDialogPhase = 'confirm' | 'stale' | 'blocked' | 'refused' | 'ambiguous';
/** refused: 422 TENANT_PROVISIONING_NO_SELF_SERVICE_UPDATES (a selected update needs the administrator). */
export type ApplyErrorKind = 'stale' | 'blocked' | 'refused' | 'ambiguous' | 'unreadable' | 'forbidden' | 'toast';
export type BadgeTone = 'success' | 'brand' | 'warning' | 'danger' | 'neutral';

export const MAX_SELECTIONS = 100;
export const PAGE_SIZE = 25;

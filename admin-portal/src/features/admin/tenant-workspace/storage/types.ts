export type TenantStorageMigrationStatus =
  | "ACCEPTED"
  | "COPYING"
  | "COPIED"
  | "PLACEMENT_COMMITTED"
  | "COMPLETED"
  | "ROLLING_BACK"
  | "ROLLED_BACK";

/**
 * Body for `POST /tenants/:tenantId/storage-migrations`. Not currently
 * callable from any screen in this app — see the module-level comment in
 * `api.ts` for why `expectedStoragePlacementRevision` cannot be sourced
 * safely from the frontend today. Kept as a typed, tested API function so
 * the write is ready the moment that gap closes.
 */
export interface StartTenantStorageMigrationDto {
  targetStorageServerId: string;
  /** Numeric string. Optimistic-concurrency fence on the tenant's current storage placement. */
  expectedStoragePlacementRevision: string;
  backupArtifactId: string;
  restoreRunId: string;
  /** Numeric string. Upper bound reserved on the target before any write. */
  maxBytes: string;
}

export interface TenantStorageMigrationView {
  id: string;
  tenantId: string;
  sourceStorageServerId: string;
  targetStorageServerId: string;
  expectedStoragePlacementRevision: string;
  resultingStoragePlacementRevision: string | null;
  sourceOperationGeneration: string;
  targetOperationGeneration: string;
  status: TenantStorageMigrationStatus;
  copiedObjectCount: number | null;
  copiedBytes: string | null;
  namespaceDigest: string | null;
  failureCode: string | null;
}

export const TERMINAL_MIGRATION_STATUSES: ReadonlySet<TenantStorageMigrationStatus> = new Set([
  "COMPLETED",
  "ROLLED_BACK",
]);

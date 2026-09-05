export type TenantStorageMigrationStatus =
  | "ACCEPTED"
  | "COPYING"
  | "COPIED"
  | "PLACEMENT_COMMITTED"
  | "COMPLETED"
  | "ROLLING_BACK"
  | "ROLLED_BACK";

/**
 * Body for `POST /tenants/:tenantId/storage-migrations`.
 *
 * `expectedStoragePlacementRevision` is an optimistic-concurrency fence on the
 * tenant's current storage placement. It is read from
 * `GET /tenants/:tenantId/storage-migration-preflight` and passed through
 * verbatim — never derived, defaulted or guessed, because a wrong value either
 * conflicts outright or silently races a concurrent placement change.
 */
export interface StartTenantStorageMigrationDto {
  targetStorageServerId: string;
  /** Numeric string. Optimistic-concurrency fence on the tenant's current storage placement. */
  expectedStoragePlacementRevision: string;
  backupArtifactId: string;
  restoreRunId: string;
  /** Numeric string. Upper bound reserved on the target before any write. */
  maxBytes: string;
  /**
   * Keep the source namespace after the placement commit, to be removed later
   * by the separate confirmed `release-source` command. Omitted or `false`
   * keeps the historic behaviour, which deletes the source in the same call.
   */
  retainSource?: boolean;
}

/** Typed confirmation body for `POST /storage-migrations/:id/release-source`. */
export interface ReleaseTenantStorageMigrationSourceDto {
  /** Must equal the migrated tenant's id. */
  confirmTenantId: string;
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
  /** Whether this migration kept its source namespace past the placement commit. */
  retainSource: boolean;
  /** Set once an operator has confirmed the retained source may be removed. */
  sourceReleaseRequestedAt: string | null;
}

export const TERMINAL_MIGRATION_STATUSES: ReadonlySet<TenantStorageMigrationStatus> = new Set([
  "COMPLETED",
  "ROLLED_BACK",
]);

/**
 * A migration that has finished moving the tenant and is deliberately holding
 * its source namespace open.
 *
 * This is a resting state, not a stalled one. Placement is on the target and
 * the runtime resolves there, so the tenant is unaffected — Core's storage
 * route fence treats a retaining `PLACEMENT_COMMITTED` migration as normal
 * rather than fencing the tenant, which is what stops the retention window
 * from being an outage. The only outstanding work is deleting the old copy,
 * and that happens when — and only when — an operator confirms it. Nothing
 * advances it on its own, so callers must stop polling here instead of waiting
 * for a status that will never arrive.
 */
export function isStorageMigrationAwaitingSourceRelease(
  migration: Pick<
    TenantStorageMigrationView,
    "status" | "retainSource" | "sourceReleaseRequestedAt"
  >,
): boolean {
  return (
    migration.status === "PLACEMENT_COMMITTED" &&
    migration.retainSource &&
    !migration.sourceReleaseRequestedAt
  );
}

/** Whether a migration has stopped changing on its own. */
export function isStorageMigrationSettled(
  migration: TenantStorageMigrationView,
): boolean {
  return (
    TERMINAL_MIGRATION_STATUSES.has(migration.status) ||
    isStorageMigrationAwaitingSourceRelease(migration)
  );
}

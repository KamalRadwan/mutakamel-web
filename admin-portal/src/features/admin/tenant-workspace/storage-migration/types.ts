import type { TenantPlacementBlockerCode } from "../placement-blockers";

export interface TenantStoragePlacementTenantView {
  id: string;
  name: string;
  status: string;
}

export interface StorageMigrationTarget {
  id: string;
  code: string;
  name: string;
  region: string;
  status: string;
  assignedTenants: number;
  /** `null` means the server declares no tenant ceiling. */
  maxTenants: number | null;
  /** Numeric strings. Byte quotas stay strings; never `parseFloat` them. */
  maxBytes: string | null;
  reservedBytes: string;
  committedBytes: string;
  lastConnectionTestStatus: string;
  lastConnectionTestedAt: string | null;
}

/**
 * `GET /api/admin/core/v1/tenants/:tenantId/storage-migration-preflight`.
 *
 * `current.storagePlacementRevision` is the optimistic-concurrency fence the
 * start command has to submit exactly. It had no admin read until this route
 * existed, which is why the storage migration command — fully implemented on
 * the backend — had never been callable from the Admin Portal.
 */
export interface TenantStorageMigrationPreflight {
  tenant: TenantStoragePlacementTenantView;
  current: {
    storageServerId: string;
    storageServerName: string | null;
    storagePlacementRevision: string;
  };
  targets: StorageMigrationTarget[];
  blockers: TenantPlacementBlockerCode[];
  /** A migration that has not reached COMPLETED or ROLLED_BACK, if one exists. */
  openMigrationId: string | null;
}

/** The status order a healthy migration walks, in order. */
export const STORAGE_MIGRATION_PROGRESS_STATUSES = [
  "ACCEPTED",
  "COPYING",
  "COPIED",
  "PLACEMENT_COMMITTED",
  "COMPLETED",
] as const;

export type StorageMigrationProgressStatus =
  (typeof STORAGE_MIGRATION_PROGRESS_STATUSES)[number];

/** The two statuses that mean the migration is unwinding instead of advancing. */
export const STORAGE_MIGRATION_ROLLBACK_STATUSES = [
  "ROLLING_BACK",
  "ROLLED_BACK",
] as const;

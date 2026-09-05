import { axiosClient } from "@/lib/api/axiosClient";
import { extractCoreData } from "@/shared/api/core-envelope";
import type { SuccessResponse } from "@/types/common";
import type {
  ReleaseTenantStorageMigrationSourceDto,
  StartTenantStorageMigrationDto,
  TenantStorageMigrationView,
} from "./types";

const TENANTS_ROOT = "/api/admin/core/v1/tenants";
const MIGRATIONS_ROOT = "/api/admin/core/v1/storage-migrations";

function commandHeaders(idempotencyKey: string) {
  return { headers: { "x-idempotency-key": idempotencyKey } };
}

export const tenantStorageMigrationApi = {
  /**
   * `POST /tenants/:tenantId/storage-migrations`.
   *
   * Driven by `/tenants/[id]/move-storage`. The
   * `expectedStoragePlacementRevision` fence comes from
   * `GET /tenants/:tenantId/storage-migration-preflight`; before that route
   * existed the value lived only in the private, transaction-locked
   * `tenants.storage_placement_revision` column and no admin GET exposed it,
   * which is why this command — complete and tested — had no caller.
   *
   * Gateway `idempotent: true` / `idempotencyMode: WRITE_SENSITIVE`, so the
   * caller owns one UUIDv7 key per intent and an exact retry returns the
   * original outcome instead of starting a second migration.
   */
  async start(
    tenantId: string,
    dto: StartTenantStorageMigrationDto,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<
      SuccessResponse<TenantStorageMigrationView>
    >(
      `${TENANTS_ROOT}/${encodeURIComponent(tenantId)}/storage-migrations`,
      dto,
      commandHeaders(idempotencyKey),
    );
    return extractCoreData(response);
  },

  async get(migrationId: string, signal?: AbortSignal) {
    const response = await axiosClient.get<
      SuccessResponse<TenantStorageMigrationView>
    >(`${MIGRATIONS_ROOT}/${encodeURIComponent(migrationId)}`, { signal });
    return extractCoreData(response);
  },

  /**
   * `POST /storage-migrations/:id/release-source` — removes the retained
   * source namespace of a committed migration.
   *
   * The one step of a storage move with no rollback: once the source prefix is
   * gone, a target that copied and verified but is subtly wrong has nothing
   * left to compare against. Core therefore requires a typed tenant id, exactly
   * as destroying a relocated database does.
   *
   * Forward-only. A failure leaves the command at `PLACEMENT_COMMITTED` with
   * `STORAGE_MIGRATION_FORWARD_REPAIR_REQUIRED` for an exact retry using the
   * same key, and never restores source placement — so the recovery affordance
   * here is "retry exact", never "roll back". Releasing an already-`COMPLETED`
   * migration is a safe no-op that returns the completed projection.
   */
  async releaseSource(
    migrationId: string,
    dto: ReleaseTenantStorageMigrationSourceDto,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<
      SuccessResponse<TenantStorageMigrationView>
    >(
      `${MIGRATIONS_ROOT}/${encodeURIComponent(migrationId)}/release-source`,
      dto,
      commandHeaders(idempotencyKey),
    );
    return extractCoreData(response);
  },
};

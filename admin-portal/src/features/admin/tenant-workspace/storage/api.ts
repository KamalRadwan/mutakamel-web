import { axiosClient } from "@/lib/api/axiosClient";
import type { SuccessResponse } from "@/types/common";
import type { StartTenantStorageMigrationDto, TenantStorageMigrationView } from "./types";

const TENANTS_ROOT = "/api/admin/core/v1/tenants";
const MIGRATIONS_ROOT = "/api/admin/core/v1/storage-migrations";

function commandHeaders(idempotencyKey: string) {
  return { headers: { "x-idempotency-key": idempotencyKey } };
}

export const tenantStorageMigrationApi = {
  /**
   * `POST /tenants/:tenantId/storage-migrations`. Not wired to any UI
   * trigger in this app yet: `expectedStoragePlacementRevision` is an
   * optimistic-concurrency fence read from the private, transaction-locked
   * `tenants.storage_placement_revision` column
   * (`tenant-storage-migration.service.ts`'s `lockTenant()`), which no
   * admin GET endpoint exposes — verified by reading every query in
   * `core-app/src/admin/tenants/tenants.service.ts` that builds the tenant
   * admin view. Guessing this value would either always 409 or, worse,
   * silently race a concurrent placement change, so no screen calls this
   * until the backend surfaces the current revision somewhere readable.
   * The function is complete and tested so the write is ready the moment
   * that gap closes.
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
    return response.data.data;
  },

  async get(migrationId: string, signal?: AbortSignal) {
    const response = await axiosClient.get<
      SuccessResponse<TenantStorageMigrationView>
    >(`${MIGRATIONS_ROOT}/${encodeURIComponent(migrationId)}`, { signal });
    return response.data.data;
  },
};

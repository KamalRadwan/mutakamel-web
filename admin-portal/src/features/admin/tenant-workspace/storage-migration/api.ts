import { axiosClient } from "@/lib/api/axiosClient";
import { extractCoreData } from "@/shared/api/core-envelope";
import type { SuccessResponse } from "@/types/common";
import type { TenantStorageMigrationPreflight } from "./types";

const CORE_TENANTS_ROOT = "/api/admin/core/v1/tenants";

/**
 * Only the preflight lives here.
 *
 * The migration command and its status read already exist as
 * `tenantStorageMigrationApi` in `../storage/api.ts`, tested and correct; this
 * wizard reuses them rather than opening a second client for the same two
 * routes. What was missing was the one read that makes them callable — the
 * current placement revision the command is fenced on.
 */
export const tenantStorageMigrationPreflightApi = {
  async read(tenantId: string, signal?: AbortSignal) {
    const response = await axiosClient.get<
      SuccessResponse<TenantStorageMigrationPreflight>
    >(
      `${CORE_TENANTS_ROOT}/${encodeURIComponent(tenantId)}/storage-migration-preflight`,
      signal ? { signal } : undefined,
    );
    return extractCoreData(response);
  },
};

export { tenantStorageMigrationApi } from "../storage/api";

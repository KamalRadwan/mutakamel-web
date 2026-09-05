import { axiosClient } from "@/lib/api/axiosClient";
import { extractCoreData } from "@/shared/api/core-envelope";
import type { SuccessResponse } from "@/types/common";
import type {
  DestroyRelocationSourceDto,
  RelocationRecord,
  StartTenantRelocationDto,
  StartTenantRelocationResult,
  TenantDatabaseRelocationPreflight,
  TenantRelocationSummary,
} from "./types";

const CORE_TENANTS_ROOT = "/api/admin/core/v1/tenants";
const WORKER_RELOCATIONS_ROOT = "/api/admin/worker/v1/relocations";

/**
 * Relocation spans both backends, and they answer differently:
 *
 * - the preflight is a Core read, so it arrives inside the Core success
 *   envelope and goes through `extractCoreData`;
 * - every relocation command and read is a Worker route, and Worker returns
 *   the payload as the response body with no envelope at all.
 *
 * Both write routes are Gateway `idempotent: false`. That switches off Gateway
 * idempotency replay, so `nonReplayable` stops the shared client replaying the
 * request after a token refresh — a replayed relocation would start a *second*
 * move, not return the first. `skipAutoIdempotency` stops the client minting a
 * throwaway key; the caller owns a durable UUIDv7 instead, because Worker still
 * requires `x-idempotency-key` as its command id
 * (`WORKER.BACKUP.COMMAND_ID_REQUIRED`).
 */
function relocationCommand(idempotencyKey: string) {
  return {
    headers: { "x-idempotency-key": idempotencyKey },
    nonReplayable: true,
    skipAutoIdempotency: true,
  } as const;
}

export const tenantDatabaseRelocationApi = {
  async readPreflight(tenantId: string, signal?: AbortSignal) {
    const response = await axiosClient.get<
      SuccessResponse<TenantDatabaseRelocationPreflight>
    >(
      `${CORE_TENANTS_ROOT}/${encodeURIComponent(tenantId)}/database-relocation-preflight`,
      signal ? { signal } : undefined,
    );
    return extractCoreData(response);
  },

  /** `202 Accepted`. The move runs in the background; poll `get(runId)`. */
  async start(
    tenantId: string,
    dto: StartTenantRelocationDto,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<StartTenantRelocationResult>(
      `${WORKER_RELOCATIONS_ROOT}/tenants/${encodeURIComponent(tenantId)}`,
      dto,
      relocationCommand(idempotencyKey),
    );
    return response.data;
  },

  async get(runId: string, signal?: AbortSignal) {
    const response = await axiosClient.get<RelocationRecord>(
      `${WORKER_RELOCATIONS_ROOT}/${encodeURIComponent(runId)}`,
      signal ? { signal } : undefined,
    );
    return response.data;
  },

  /**
   * Every relocation recorded against a tenant, newest first.
   *
   * The relocation id is minted at accept time, so an operator who reloaded —
   * or who is opening the page on a tenant someone else moved — has nothing to
   * poll with until this read hands one back.
   */
  async listForTenant(tenantId: string, signal?: AbortSignal) {
    const response = await axiosClient.get<TenantRelocationSummary[]>(
      `${WORKER_RELOCATIONS_ROOT}/tenants/${encodeURIComponent(tenantId)}`,
      signal ? { signal } : undefined,
    );
    return response.data;
  },

  /** Step 10 — irreversible, and the one step with no rollback left. */
  async destroySource(
    runId: string,
    dto: DestroyRelocationSourceDto,
    idempotencyKey: string,
  ) {
    const response = await axiosClient.post<RelocationRecord>(
      `${WORKER_RELOCATIONS_ROOT}/${encodeURIComponent(runId)}/destroy-source`,
      dto,
      relocationCommand(idempotencyKey),
    );
    return response.data;
  },
};

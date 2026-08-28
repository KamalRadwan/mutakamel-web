import { axiosClient } from "@/lib/api/axiosClient";
import {
  readFleetStatusList,
  readMigrationRun,
  readMigrationRunList,
  readTenantResultPage,
  readTenantSchemaVersionPage,
  requireRunId,
} from "../model/migration-readers";
import type {
  MigrationControlDto,
  MigrationRunStatus,
  StartMigrationRunDto,
  TenantSchemaVersionState,
} from "../types/database-migrations";

/**
 * Worker's admin surface, reached through the only browser edge.
 * Gateway `/api/v1/worker/admin/migrations/*` → upstream `/admin/migrations/*`.
 */
export const MIGRATIONS_BASE_URL = "/api/admin/worker/v1/migrations";

type QueryValue = number | string | null | undefined;

function toQueryString(query: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function readConfig(signal?: AbortSignal) {
  return { cache: "no-store" as const, ...(signal ? { signal } : {}) };
}

/**
 * Every mutating `/migrations/runs*` route is `WRITE_SENSITIVE` with
 * `idempotent: false` in the Gateway route contract, so no idempotency key is
 * generated for it and the request is never replayed after a refresh — its
 * server-side outcome would be ambiguous.
 */
const commandConfig = {
  cache: "no-store" as const,
  skipAutoIdempotency: true,
  nonReplayable: true,
} as const;

export const databaseMigrationsApi = {
  /**
   * Fleet roll-up from the `control_plane.tenant_schema_versions` projection.
   * Omitting `applicationKey` asks for every application.
   */
  getFleet: async (applicationKey?: string, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${MIGRATIONS_BASE_URL}/fleet${toQueryString({ applicationKey })}`,
      readConfig(signal),
    );
    return readFleetStatusList(response.data);
  },

  /** Per-tenant projection rows. Always paginated. */
  listTenants: async (
    query: {
      applicationKey?: string;
      state?: TenantSchemaVersionState | "";
      page?: number;
      limit?: number;
    },
    signal?: AbortSignal,
  ) => {
    const response = await axiosClient.get<unknown>(
      `${MIGRATIONS_BASE_URL}/tenants${toQueryString({
        applicationKey: query.applicationKey,
        state: query.state,
        page: query.page ?? 1,
        limit: query.limit ?? 25,
      })}`,
      readConfig(signal),
    );
    return readTenantSchemaVersionPage(response.data);
  },

  listRuns: async (
    query: { status?: MigrationRunStatus | "" } = {},
    signal?: AbortSignal,
  ) => {
    const response = await axiosClient.get<unknown>(
      `${MIGRATIONS_BASE_URL}/runs${toQueryString({ status: query.status })}`,
      readConfig(signal),
    );
    return readMigrationRunList(response.data);
  },

  getRun: async (runId: string, signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      `${MIGRATIONS_BASE_URL}/runs/${encodeURIComponent(requireRunId(runId))}`,
      readConfig(signal),
    );
    return readMigrationRun(response.data);
  },

  /** Per-tenant outcomes for one run. Filterable by outcome, paginated. */
  listRunTenants: async (
    runId: string,
    query: { outcome?: string; page?: number; limit?: number } = {},
    signal?: AbortSignal,
  ) => {
    const response = await axiosClient.get<unknown>(
      `${MIGRATIONS_BASE_URL}/runs/${encodeURIComponent(
        requireRunId(runId),
      )}/tenants${toQueryString({
        outcome: query.outcome,
        page: query.page ?? 1,
        limit: query.limit ?? 50,
      })}`,
      readConfig(signal),
    );
    return readTenantResultPage(response.data);
  },

  /**
   * Starts a run. A single-tenant migration is this same call carrying a tenant
   * filter — never a second code path, which would drift from the fleet path in
   * exactly the safety checks that matter.
   */
  startRun: async (dto: StartMigrationRunDto) => {
    const response = await axiosClient.post<unknown>(
      `${MIGRATIONS_BASE_URL}/runs`,
      dto,
      commandConfig,
    );
    return readMigrationRun(response.data);
  },

  control: async (
    action: "pause" | "resume" | "abort" | "retry-failed",
    dto: MigrationControlDto,
  ) => {
    const runId = requireRunId(dto.runId);
    const response = await axiosClient.post<unknown>(
      `${MIGRATIONS_BASE_URL}/runs/${encodeURIComponent(runId)}/${action}`,
      { runId, reason: dto.reason },
      commandConfig,
    );
    return readMigrationRun(response.data);
  },
};

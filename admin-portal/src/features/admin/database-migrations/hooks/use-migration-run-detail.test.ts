// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MigrationRun } from "../types/database-migrations";

const { authMock, apiMock } = vi.hoisted(() => ({
  authMock: {
    user: { isSuperAdmin: false, permissions: [] as string[] },
    isLoading: false,
  },
  apiMock: {
    getRun: vi.fn(),
    listRunTenants: vi.fn(),
    control: vi.fn(),
  },
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("../api/database-migrations.api", () => ({
  databaseMigrationsApi: apiMock,
}));

import { useMigrationRunDetail } from "./use-migration-run-detail";

const run: MigrationRun = {
  id: "019f0000-0000-7000-8000-000000000001",
  applicationKey: "crm",
  targetVersion: "1801-add-index",
  strategy: "batched",
  batchSize: 50,
  failFast: false,
  status: "PAUSED",
  progress: {
    totalTenants: 2,
    queuedTenants: 1,
    inFlightTenants: 0,
    succeededTenants: 0,
    failedTenants: 1,
    skippedTenants: 0,
    appliedMigrations: 0,
    currentBatch: 1,
    dryRun: false,
  },
  summary: null,
  triggeredBy: "release rollout",
  startedAt: "2026-10-17T10:00:00.000Z",
  pausedAt: "2026-10-17T10:05:00.000Z",
  finishedAt: null,
  error: null,
  tenantScope: null,
};

const controls = [
  ["PAUSE", "pause"],
  ["RESUME", "resume"],
  ["ABORT", "abort"],
  ["RETRY_FAILED", "retry-failed"],
] as const;

describe("useMigrationRunDetail run-control permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.user.permissions = ["admin.migrations.read", "admin.migrations.manage"];
    apiMock.getRun.mockResolvedValue(run);
    apiMock.listRunTenants.mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 50, total: 0 },
    });
    apiMock.control.mockResolvedValue(run);
  });

  it.each(controls)("dispatches %s with manage alone", async (name, action) => {
    const { result } = renderHook(() => useMigrationRunDetail(run.id));
    await waitFor(() => expect(result.current.state).toBe("READY"));
    expect(result.current.permissions.hasCritical).toBe(false);
    expect(result.current.permissions.canDestroy).toBe(false);

    await act(async () => {
      expect(await result.current.control(name, "review rollout")).toEqual(run);
    });

    expect(apiMock.control).toHaveBeenCalledWith(action, {
      runId: run.id,
      reason: "review rollout",
    });
    expect(result.current.mutation.phase).toBe("SUCCEEDED");
  });

  it.each(controls)("withholds %s without manage even when critical is granted", async (name) => {
    authMock.user.permissions = ["admin.migrations.read", "admin.migrations.critical"];
    const { result } = renderHook(() => useMigrationRunDetail(run.id));
    await waitFor(() => expect(result.current.state).toBe("READY"));

    await act(async () => {
      expect(await result.current.control(name, "review rollout")).toBeNull();
    });

    expect(apiMock.control).not.toHaveBeenCalled();
    expect(result.current.mutation.phase).toBe("IDLE");
  });
});

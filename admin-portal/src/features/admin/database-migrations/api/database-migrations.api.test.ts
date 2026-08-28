import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, post: postMock },
}));

import {
  MIGRATIONS_BASE_URL,
  databaseMigrationsApi,
} from "./database-migrations.api";

const RUN_ID = "019f0000-0000-7000-8000-000000000001";

function runPayload() {
  return {
    id: RUN_ID,
    applicationKey: "crm",
    targetVersion: "1801-add-index",
    strategy: "batched",
    batchSize: 50,
    failFast: false,
    status: "RUNNING",
    progress: { totalTenants: 1, dryRun: false },
    summary: null,
    triggeredBy: "release 42",
    startedAt: "2026-08-28T10:00:00.000Z",
    pausedAt: null,
    finishedAt: null,
    error: null,
  };
}

describe("database migrations API", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("calls the canonical browser paths for every read", async () => {
    getMock
      .mockResolvedValueOnce({
        data: [
          {
            applicationKey: "crm",
            availableVersion: "1801",
            counts: {},
            versionDistribution: [],
            activeRun: null,
          },
        ],
      })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [runPayload()] })
      .mockResolvedValueOnce({ data: runPayload() })
      .mockResolvedValueOnce({ data: [] });
    const signal = new AbortController().signal;

    await databaseMigrationsApi.getFleet("crm", signal);
    await databaseMigrationsApi.listTenants(
      { applicationKey: "crm", state: "DRIFTED", page: 2, limit: 25 },
      signal,
    );
    await databaseMigrationsApi.listRuns({ status: "RUNNING" }, signal);
    await databaseMigrationsApi.getRun(RUN_ID, signal);
    await databaseMigrationsApi.listRunTenants(
      RUN_ID,
      { outcome: "SKIPPED", page: 1, limit: 50 },
      signal,
    );

    expect(getMock.mock.calls.map(([url]) => url)).toEqual([
      `${MIGRATIONS_BASE_URL}/fleet?applicationKey=crm`,
      `${MIGRATIONS_BASE_URL}/tenants?applicationKey=crm&state=DRIFTED&page=2&limit=25`,
      `${MIGRATIONS_BASE_URL}/runs?status=RUNNING`,
      `${MIGRATIONS_BASE_URL}/runs/${RUN_ID}`,
      `${MIGRATIONS_BASE_URL}/runs/${RUN_ID}/tenants?outcome=SKIPPED&page=1&limit=50`,
    ]);
    for (const [, config] of getMock.mock.calls) {
      expect(config).toEqual({ cache: "no-store", signal });
    }
  });

  it("routes every read through the Worker admin browser prefix only", () => {
    expect(MIGRATIONS_BASE_URL).toBe("/api/admin/worker/v1/migrations");
  });

  it("sends no idempotency key on the non-idempotent write routes and never replays them", async () => {
    postMock.mockResolvedValue({ data: runPayload() });

    await databaseMigrationsApi.startRun({
      applicationKey: "crm",
      targetVersion: "1801-add-index",
      strategy: "batched",
      batchSize: 50,
      failFast: false,
      dryRun: true,
      triggeredBy: "rehearsal",
    });
    for (const action of ["pause", "resume", "abort", "retry-failed"] as const) {
      await databaseMigrationsApi.control(action, {
        runId: RUN_ID,
        reason: "incident 12",
      });
    }

    expect(postMock.mock.calls.map(([url]) => url)).toEqual([
      `${MIGRATIONS_BASE_URL}/runs`,
      `${MIGRATIONS_BASE_URL}/runs/${RUN_ID}/pause`,
      `${MIGRATIONS_BASE_URL}/runs/${RUN_ID}/resume`,
      `${MIGRATIONS_BASE_URL}/runs/${RUN_ID}/abort`,
      `${MIGRATIONS_BASE_URL}/runs/${RUN_ID}/retry-failed`,
    ]);
    for (const [, , config] of postMock.mock.calls) {
      expect(config).toEqual({
        cache: "no-store",
        skipAutoIdempotency: true,
        nonReplayable: true,
      });
      expect(config).not.toHaveProperty("headers");
    }
  });

  it("carries a single-tenant run as a tenant filter on the fleet route", async () => {
    postMock.mockResolvedValue({ data: runPayload() });

    await databaseMigrationsApi.startRun({
      applicationKey: "crm",
      targetVersion: "1801-add-index",
      strategy: "batched",
      failFast: false,
      dryRun: false,
      tenantFilter: { ids: ["tenant-a"] },
      triggeredBy: "support ticket 9",
    });

    const [url, body] = postMock.mock.calls[0];
    expect(url).toBe(`${MIGRATIONS_BASE_URL}/runs`);
    expect(body).toMatchObject({ tenantFilter: { ids: ["tenant-a"] } });
  });

  it("sends the run id in both the path and the control body", async () => {
    postMock.mockResolvedValue({ data: runPayload() });

    await databaseMigrationsApi.control("abort", {
      runId: RUN_ID,
      reason: "bad migration",
    });

    expect(postMock.mock.calls[0][1]).toEqual({
      runId: RUN_ID,
      reason: "bad migration",
    });
  });

  it("refuses a run id that could escape the route", async () => {
    await expect(
      databaseMigrationsApi.getRun("../jobs"),
    ).rejects.toThrow("INVALID_MIGRATION_RUN_ID");
    expect(getMock).not.toHaveBeenCalled();
  });
});

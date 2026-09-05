import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, post: postMock },
}));

import { tenantDatabaseRelocationApi } from "./api";

const TENANT_ID = "019f0000-0000-7000-8000-000000000001";
const RUN_ID = "019f0000-0000-7000-8000-000000000030";
const COMMAND_ID = "019f0000-0000-7000-8000-000000000050";

const coreEnvelope = (data: unknown) => ({ data: { success: true, data } });
const workerBody = (data: unknown) => ({ data });

describe("tenant database relocation API", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("unwraps the Core envelope for the preflight and forwards cancellation", async () => {
    const preflight = {
      tenant: { id: TENANT_ID, name: "acme", status: "ACTIVE" },
      current: {
        databaseServerId: "019f0000-0000-7000-8000-000000000010",
        databaseServerName: "Postgres Cairo",
        databaseName: "tenant_acme",
        databasePlacementRevision: "4",
      },
      targets: [],
      blockers: [],
      retention: { minDays: 1, maxDays: 30, defaultDays: 7 },
    };
    getMock.mockResolvedValue(coreEnvelope(preflight));
    const controller = new AbortController();

    await expect(
      tenantDatabaseRelocationApi.readPreflight(TENANT_ID, controller.signal),
    ).resolves.toEqual(preflight);
    expect(getMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/tenants/${TENANT_ID}/database-relocation-preflight`,
      { signal: controller.signal },
    );
  });

  it("starts the move with a caller-owned key, no auto idempotency and no replay", async () => {
    const result = { relocationId: "rel-1", runId: RUN_ID, record: { outcome: "RUNNING" } };
    postMock.mockResolvedValue(workerBody(result));
    const dto = {
      targetDatabaseServerId: "019f0000-0000-7000-8000-000000000011",
      reason: "Rebalance the Cairo fleet",
      confirmTenantId: TENANT_ID,
      sourceRetentionDays: 7,
    };

    await expect(
      tenantDatabaseRelocationApi.start(TENANT_ID, dto, COMMAND_ID),
    ).resolves.toEqual(result);

    expect(postMock).toHaveBeenCalledWith(
      `/api/admin/worker/v1/relocations/tenants/${TENANT_ID}`,
      dto,
      {
        headers: { "x-idempotency-key": COMMAND_ID },
        nonReplayable: true,
        skipAutoIdempotency: true,
      },
    );
  });

  it("reads a Worker relocation record without an envelope", async () => {
    const record = { relocationId: "rel-1", outcome: "RELOCATED" };
    getMock.mockResolvedValue(workerBody(record));

    await expect(tenantDatabaseRelocationApi.get(RUN_ID)).resolves.toEqual(record);
    expect(getMock).toHaveBeenCalledWith(
      `/api/admin/worker/v1/relocations/${RUN_ID}`,
      undefined,
    );
  });

  it("lists a tenant's relocations so a reloaded page can find its run", async () => {
    const summaries = [{ runId: RUN_ID, record: { outcome: "RUNNING" } }];
    getMock.mockResolvedValue(workerBody(summaries));

    await expect(
      tenantDatabaseRelocationApi.listForTenant(TENANT_ID),
    ).resolves.toEqual(summaries);
    expect(getMock).toHaveBeenCalledWith(
      `/api/admin/worker/v1/relocations/tenants/${TENANT_ID}`,
      undefined,
    );
  });

  it("sends the irreversible source release as its own non-replayable command", async () => {
    const record = { relocationId: "rel-1", sourceDestroyedAt: "2026-09-09T00:00:00.000Z" };
    postMock.mockResolvedValue(workerBody(record));

    await expect(
      tenantDatabaseRelocationApi.destroySource(
        RUN_ID,
        { confirmTenantId: TENANT_ID },
        COMMAND_ID,
      ),
    ).resolves.toEqual(record);

    expect(postMock).toHaveBeenCalledWith(
      `/api/admin/worker/v1/relocations/${RUN_ID}/destroy-source`,
      { confirmTenantId: TENANT_ID },
      {
        headers: { "x-idempotency-key": COMMAND_ID },
        nonReplayable: true,
        skipAutoIdempotency: true,
      },
    );
  });

  it("encodes identifiers into the path", async () => {
    getMock.mockResolvedValue(workerBody([]));
    await tenantDatabaseRelocationApi.listForTenant("a/b c");
    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/worker/v1/relocations/tenants/a%2Fb%20c",
      undefined,
    );
  });
});

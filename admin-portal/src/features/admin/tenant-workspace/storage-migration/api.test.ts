import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, post: postMock },
}));

import {
  tenantStorageMigrationApi,
  tenantStorageMigrationPreflightApi,
} from "./api";

const TENANT_ID = "019f0000-0000-7000-8000-000000000001";
const coreEnvelope = (data: unknown) => ({ data: { success: true, data } });

describe("tenant storage migration preflight API", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("unwraps the Core envelope and forwards cancellation", async () => {
    const preflight = {
      tenant: { id: TENANT_ID, name: "acme", status: "ACTIVE" },
      current: {
        storageServerId: "019f0000-0000-7000-8000-000000000010",
        storageServerName: "Garage Cairo",
        storagePlacementRevision: "3",
      },
      targets: [],
      blockers: [],
      openMigrationId: null,
    };
    getMock.mockResolvedValue(coreEnvelope(preflight));
    const controller = new AbortController();

    await expect(
      tenantStorageMigrationPreflightApi.read(TENANT_ID, controller.signal),
    ).resolves.toEqual(preflight);
    expect(getMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/tenants/${TENANT_ID}/storage-migration-preflight`,
      { signal: controller.signal },
    );
  });

  it("omits the request config when no signal is supplied", async () => {
    getMock.mockResolvedValue(coreEnvelope({}));
    await tenantStorageMigrationPreflightApi.read(TENANT_ID);
    expect(getMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/tenants/${TENANT_ID}/storage-migration-preflight`,
      undefined,
    );
  });

  it("encodes the tenant id into the path", async () => {
    getMock.mockResolvedValue(coreEnvelope({}));
    await tenantStorageMigrationPreflightApi.read("a/b c");
    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/tenants/a%2Fb%20c/storage-migration-preflight",
      undefined,
    );
  });

  it("re-exports the existing fenced migration command rather than duplicating it", async () => {
    postMock.mockResolvedValue(coreEnvelope({ id: "migration-1" }));
    const dto = {
      targetStorageServerId: "019f0000-0000-7000-8000-000000000011",
      expectedStoragePlacementRevision: "3",
      backupArtifactId: "019f0000-0000-7000-8000-000000000020",
      restoreRunId: "019f0000-0000-7000-8000-000000000021",
      maxBytes: "1000000000",
    };

    await tenantStorageMigrationApi.start(
      TENANT_ID,
      dto,
      "019f0000-0000-7000-8000-000000000050",
    );

    expect(postMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/tenants/${TENANT_ID}/storage-migrations`,
      dto,
      { headers: { "x-idempotency-key": "019f0000-0000-7000-8000-000000000050" } },
    );
  });
});

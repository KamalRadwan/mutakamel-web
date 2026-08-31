import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: {
    get: getMock,
    post: postMock,
  },
}));

import { tenantStorageMigrationApi } from "./api";

const TENANT_ID = "019f0000-0000-7000-8000-000000000001";
const MIGRATION_ID = "019f0000-0000-7000-8000-000000000040";
const COMMAND_ID = "019f0000-0000-7000-8000-000000000050";
const envelope = (data: unknown) => ({ data: { success: true, data } });

describe("tenant storage migration API", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("starts a fenced migration with an idempotency key", async () => {
    const migration = {
      id: MIGRATION_ID,
      tenantId: TENANT_ID,
      sourceStorageServerId: "019f0000-0000-7000-8000-000000000010",
      targetStorageServerId: "019f0000-0000-7000-8000-000000000011",
      expectedStoragePlacementRevision: "3",
      resultingStoragePlacementRevision: null,
      sourceOperationGeneration: "1",
      targetOperationGeneration: "1",
      status: "ACCEPTED",
      copiedObjectCount: null,
      copiedBytes: null,
      namespaceDigest: null,
      failureCode: null,
    };
    postMock.mockResolvedValue(envelope(migration));

    const dto = {
      targetStorageServerId: "019f0000-0000-7000-8000-000000000011",
      expectedStoragePlacementRevision: "3",
      backupArtifactId: "019f0000-0000-7000-8000-000000000020",
      restoreRunId: "019f0000-0000-7000-8000-000000000021",
      maxBytes: "1000000000",
    };
    await expect(
      tenantStorageMigrationApi.start(TENANT_ID, dto, COMMAND_ID),
    ).resolves.toEqual(migration);

    expect(postMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/tenants/${TENANT_ID}/storage-migrations`,
      dto,
      { headers: { "x-idempotency-key": COMMAND_ID } },
    );
  });

  it("fetches migration status by id with cancellation support", async () => {
    const controller = new AbortController();
    const migration = { id: MIGRATION_ID, status: "COPYING" };
    getMock.mockResolvedValue(envelope(migration));

    await expect(
      tenantStorageMigrationApi.get(MIGRATION_ID, controller.signal),
    ).resolves.toEqual(migration);

    expect(getMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/storage-migrations/${MIGRATION_ID}`,
      { signal: controller.signal },
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteMock, getMock, patchMock, postMock } = vi.hoisted(() => ({
  deleteMock: vi.fn(),
  getMock: vi.fn(),
  patchMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: {
    delete: deleteMock,
    get: getMock,
    patch: patchMock,
    post: postMock,
  },
}));

import { backupApi } from "./backup.api";

const SERVER_ID = "019f0000-0000-7000-8000-000000000010";
const TENANT_ID = "019f0000-0000-7000-8000-000000000020";
const POLICY_ID = "019f0000-0000-7000-8000-000000000030";
const RUN_ID = "019f0000-0000-7000-8000-000000000040";
const ARTIFACT_ID = "019f0000-0000-7000-8000-000000000050";
const IDEMPOTENCY_KEY = "019f0000-0000-7000-8000-000000000060";

const workerResponse = <T>(data: T) => ({ data });

describe("backup Worker API", () => {
  beforeEach(() => {
    deleteMock.mockReset();
    getMock.mockReset();
    patchMock.mockReset();
    postMock.mockReset();
  });

  it("serializes policy filters without dropping false", async () => {
    const policies = [{ id: POLICY_ID, enabled: false }];
    const policy = policies[0];
    getMock
      .mockResolvedValueOnce(workerResponse(policies))
      .mockResolvedValueOnce(workerResponse(policy));

    await expect(
      backupApi.listPolicies({
        databaseServerId: SERVER_ID,
        enabled: false,
      }),
    ).resolves.toEqual(policies);

    expect(getMock).toHaveBeenCalledWith(
      `/api/admin/worker/v1/backups/policies?databaseServerId=${SERVER_ID}&enabled=false`,
    );

    await expect(backupApi.getPolicy(SERVER_ID)).resolves.toEqual(policy);
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/worker/v1/backups/policies/${SERVER_ID}`,
    );
  });

  it("uses stable caller-owned idempotency for policy writes", async () => {
    const dto = {
      enabled: true,
      cronExpression: "0 2 * * *",
      timezone: "UTC",
      retentionDays: 30,
      serverConcurrency: 2,
      tenantConcurrency: 3,
      defaultBackupEnabled: true,
      defaultCompressionEnabled: true,
      defaultCompressionAlgorithm: "gzip" as const,
    };
    const policy = { id: POLICY_ID, databaseServerId: SERVER_ID, ...dto };
    patchMock.mockResolvedValue(workerResponse(policy));

    await expect(
      backupApi.upsertPolicy(SERVER_ID, dto, IDEMPOTENCY_KEY),
    ).resolves.toEqual(policy);

    expect(patchMock).toHaveBeenCalledWith(
      `/api/admin/worker/v1/backups/policies/${SERVER_ID}`,
      dto,
      { headers: { "x-idempotency-key": IDEMPOTENCY_KEY } },
    );
  });

  it("reads and writes tenant database overrides through the policy route", async () => {
    const configs = [{ tenantId: TENANT_ID, databaseName: "tenant_1" }];
    getMock.mockResolvedValueOnce(workerResponse(configs));

    await expect(backupApi.listDatabaseConfigs(SERVER_ID)).resolves.toEqual(
      configs,
    );
    expect(getMock).toHaveBeenCalledWith(
      `/api/admin/worker/v1/backups/policies/${SERVER_ID}/databases`,
    );

    const dto = { backupEnabled: false, compressionEnabled: null };
    const override = { id: POLICY_ID, tenantId: TENANT_ID, ...dto };
    patchMock.mockResolvedValueOnce(workerResponse(override));

    await expect(
      backupApi.upsertDatabaseOverride(
        SERVER_ID,
        TENANT_ID,
        dto,
        IDEMPOTENCY_KEY,
      ),
    ).resolves.toEqual(override);
    expect(patchMock).toHaveBeenCalledWith(
      `/api/admin/worker/v1/backups/policies/${SERVER_ID}/databases/${TENANT_ID}`,
      dto,
      { headers: { "x-idempotency-key": IDEMPOTENCY_KEY } },
    );

    deleteMock.mockResolvedValueOnce({ data: "", status: 200 });
    await backupApi.deleteDatabaseOverride(
      SERVER_ID,
      TENANT_ID,
      IDEMPOTENCY_KEY,
    );
    expect(deleteMock).toHaveBeenCalledWith(
      `/api/admin/worker/v1/backups/policies/${SERVER_ID}/databases/${TENANT_ID}`,
      { headers: { "x-idempotency-key": IDEMPOTENCY_KEY } },
    );
  });

  it("starts a backup with the caller-owned stable command key", async () => {
    const dto = {
      databaseServerId: SERVER_ID,
      reason: "Operator requested a bounded manual backup",
      tenantConcurrency: 2,
    };
    const run = {
      id: RUN_ID,
      databaseServerId: SERVER_ID,
      trigger: "manual",
      status: "PENDING",
      totalTenants: 0,
      succeededTenants: 0,
      failedTenants: 0,
      skippedTenants: 0,
      reason: dto.reason,
      hasFailure: true,
      failureCode: "WORKER.BACKUP.RUN_FAILED",
      startedAt: "2026-08-04T10:00:00.000Z",
      finishedAt: null,
    };
    postMock.mockResolvedValue(workerResponse(run));

    const result = await backupApi.startRun(dto, IDEMPOTENCY_KEY);
    expect(result).toEqual({
      id: RUN_ID,
      databaseServerId: SERVER_ID,
      trigger: "manual",
      status: "PENDING",
      totalTenants: 0,
      succeededTenants: 0,
      failedTenants: 0,
      skippedTenants: 0,
      reason: dto.reason,
      hasFailure: true,
      failureCode: "WORKER.BACKUP.RUN_FAILED",
      startedAt: "2026-08-04T10:00:00.000Z",
      finishedAt: null,
    });
    expect(result).not.toHaveProperty("storagePrefix");
    expect(result).not.toHaveProperty("manifestKey");
    expect(result).not.toHaveProperty("summary");
    expect(result).not.toHaveProperty("error");

    expect(postMock).toHaveBeenCalledWith(
      "/api/admin/worker/v1/backups/runs",
      dto,
      { headers: { "x-idempotency-key": IDEMPOTENCY_KEY } },
    );
  });

  it("serializes run and artifact filters and keeps delete keys stable", async () => {
    getMock
      .mockResolvedValueOnce(workerResponse([{ id: RUN_ID }]))
      .mockResolvedValueOnce(workerResponse([{
        id: ARTIFACT_ID,
        runId: RUN_ID,
        databaseServerId: SERVER_ID,
        tenantId: TENANT_ID,
        databaseName: "tenant_1",
        status: "FAILED",
        sizeBytes: null,
        sha256: null,
        compressionAlgorithm: "gzip",
        hasFailure: true,
        failureCode: "WORKER.BACKUP.ARTIFACT_FAILED",
        startedAt: "2026-08-04T10:00:00.000Z",
        finishedAt: "2026-08-04T10:01:00.000Z",
      }]));

    await backupApi.listRuns({
      databaseServerId: SERVER_ID,
      status: "COMPLETED_WITH_ERRORS",
      policyId: POLICY_ID,
    });
    expect(getMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/worker/v1/backups/runs?databaseServerId=${SERVER_ID}&status=COMPLETED_WITH_ERRORS&policyId=${POLICY_ID}`,
    );

    const artifacts = await backupApi.listArtifacts({
      runId: RUN_ID,
      databaseServerId: SERVER_ID,
      tenantId: TENANT_ID,
    });
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/worker/v1/backups/artifacts?runId=${RUN_ID}&databaseServerId=${SERVER_ID}&tenantId=${TENANT_ID}`,
    );
    expect(artifacts[0]).toMatchObject({ id: ARTIFACT_ID, hasFailure: true });
    expect(artifacts[0]).not.toHaveProperty("storageKey");
    expect(artifacts[0]).not.toHaveProperty("metadata");
    expect(artifacts[0]).not.toHaveProperty("error");

    deleteMock.mockResolvedValue({ data: "", status: 200 });
    await backupApi.deleteRun(RUN_ID, IDEMPOTENCY_KEY);
    await backupApi.deleteArtifact(ARTIFACT_ID, IDEMPOTENCY_KEY);

    expect(deleteMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/worker/v1/backups/runs/${RUN_ID}`,
      { headers: { "x-idempotency-key": IDEMPOTENCY_KEY } },
    );
    expect(deleteMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/worker/v1/backups/artifacts/${ARTIFACT_ID}`,
      { headers: { "x-idempotency-key": IDEMPOTENCY_KEY } },
    );
  });

  it("uses caller-owned stable command keys for restore start and promotion", async () => {
    const startDto = {
      artifactId: ARTIFACT_ID,
      targetDatabaseName: "tenant_restore_1",
      reason: "Verify this completed artifact in an isolated database",
    };
    const restore = {
      id: RUN_ID,
      artifactId: ARTIFACT_ID,
      tenantId: TENANT_ID,
      databaseServerId: SERVER_ID,
      sourceDatabaseName: "tenant_source_1",
      targetDatabaseName: startDto.targetDatabaseName,
      status: "VERIFIED",
      reason: startDto.reason,
      hasVerification: true,
      hasFailure: true,
      failureCode: "WORKER.RESTORE.RUN_FAILED",
      startedAt: "2026-08-04T10:00:00.000Z",
      finishedAt: "2026-08-04T10:03:00.000Z",
      promotedAt: null,
      promoteReason: null,
    };
    postMock.mockResolvedValue(workerResponse(restore));

    const started = await backupApi.startRestore(startDto, IDEMPOTENCY_KEY);
    expect(started).toMatchObject({
      id: RUN_ID,
      artifactId: ARTIFACT_ID,
      hasVerification: true,
      hasFailure: true,
    });
    expect(started).not.toHaveProperty("verification");
    expect(started).not.toHaveProperty("error");
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/worker/v1/restores/runs",
      startDto,
      { headers: { "x-idempotency-key": IDEMPOTENCY_KEY } },
    );

    const promoteDto = {
      reason: "Promote the operator-verified restore target",
      confirmationText: startDto.targetDatabaseName,
    };
    await expect(
      backupApi.promoteRestore(RUN_ID, promoteDto, IDEMPOTENCY_KEY),
    ).resolves.toMatchObject({ id: RUN_ID, hasVerification: true, hasFailure: true });
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/worker/v1/restores/runs/${RUN_ID}/promote`,
      promoteDto,
      { headers: { "x-idempotency-key": IDEMPOTENCY_KEY } },
    );
  });

  it("reads individual backup and restore runs from their owning families", async () => {
    getMock
      .mockResolvedValueOnce(workerResponse({ id: RUN_ID, status: "RUNNING" }))
      .mockResolvedValueOnce(workerResponse({ id: RUN_ID, status: "VERIFIED" }))
      .mockResolvedValueOnce(workerResponse([{ id: RUN_ID }]));

    await backupApi.getRun(RUN_ID);
    await backupApi.getRestore(RUN_ID);
    await backupApi.listRestores({ tenantId: TENANT_ID, status: "VERIFIED" });

    expect(getMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/worker/v1/backups/runs/${RUN_ID}`,
    );
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/worker/v1/restores/runs/${RUN_ID}`,
    );
    expect(getMock).toHaveBeenNthCalledWith(
      3,
      `/api/admin/worker/v1/restores/runs?tenantId=${TENANT_ID}&status=VERIFIED`,
    );
  });
});

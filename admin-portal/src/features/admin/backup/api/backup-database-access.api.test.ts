import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, patchMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: {
    get: getMock,
    patch: patchMock,
    post: postMock,
  },
}));

import { backupDatabaseAccessApi } from "./backup-database-access.api";

const SERVER_ID = "019f0000-0000-7000-8000-000000000010";
const IDEMPOTENCY_KEY = "019f0000-0000-7000-8000-000000000020";

const coreResponse = <T>(data: T, meta?: { page: number; limit: number; total: number; totalPages: number; hasNext: boolean; hasPrev: boolean }) => ({
  data: {
    success: true as const,
    data,
    ...(meta ? { meta } : {}),
    correlationId: "019f0000-0000-7000-8000-000000000030",
    timestamp: "2026-08-04T10:00:00.000Z",
  },
});

const backupBinding = {
  purpose: "BACKUP" as const,
  databasePrincipal: "mutakamel_backup" as const,
  status: "READY" as const,
  credentialRevision: "4",
  rotationEnabled: true,
  rotationIntervalHours: 720,
  maintenanceWindowStartUtc: 1,
  maintenanceWindowHours: 2,
  rotationDueAt: "2026-09-04T01:00:00.000Z",
  lastRotationAttemptAt: "2026-08-04T01:00:00.000Z",
  lastRotationSucceededAt: "2026-08-04T01:00:01.000Z",
  retryAt: null,
  safeFailureCode: null,
  operationGeneration: "4",
  hasStagedCandidate: false,
};

describe("backup database access Core API", () => {
  beforeEach(() => {
    getMock.mockReset();
    patchMock.mockReset();
    postMock.mockReset();
  });

  it("loads every Database Server page instead of silently truncating selectors", async () => {
    getMock
      .mockResolvedValueOnce(
        coreResponse(
          [{ id: SERVER_ID, name: "Primary database", status: "ACTIVE" }],
          { page: 1, limit: 100, total: 101, totalPages: 2, hasNext: true, hasPrev: false },
        ),
      )
      .mockResolvedValueOnce(
        coreResponse(
          [{ id: `${SERVER_ID.slice(0, -1)}1`, name: "Archive database", status: "OFFLINE" }],
          { page: 2, limit: 100, total: 101, totalPages: 2, hasNext: false, hasPrev: true },
        ),
      );

    await expect(backupDatabaseAccessApi.listServers()).resolves.toHaveLength(2);
    expect(getMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/core/v1/database-servers?page=2&limit=100",
    );
  });

  it("lists safe Database Server selector fields independently of policies", async () => {
    getMock.mockResolvedValue(
      coreResponse([
        {
          id: SERVER_ID,
          name: "Primary database",
          status: "ACTIVE",
          host: "postgres.internal",
          securityAdminCredentials: { password: "must-not-cross-adapter" },
          systemPrincipals: [backupBinding],
        },
      ]),
    );

    const result = await backupDatabaseAccessApi.listServers();

    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/database-servers?page=1&limit=100",
    );
    expect(result).toEqual([
      {
        id: SERVER_ID,
        name: "Primary database",
        status: "ACTIVE",
        host: "postgres.internal",
      },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/password|credential|secret/i);
  });

  it("selects only the fixed secret-free backup principal", async () => {
    getMock.mockResolvedValue(
      coreResponse([
        {
          ...backupBinding,
          purpose: "PROVISIONING",
          databasePrincipal: "mutakamel_provisioner",
        },
        backupBinding,
      ]),
    );

    await expect(
      backupDatabaseAccessApi.getBinding(SERVER_ID),
    ).resolves.toEqual(backupBinding);
    expect(getMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/database-servers/${SERVER_ID}/system-principals`,
    );
    expect(JSON.stringify(backupBinding)).not.toMatch(/password|credentialsRef|secret/i);
  });

  it("returns null when Core has not projected a backup binding", async () => {
    getMock.mockResolvedValue(coreResponse([]));

    await expect(
      backupDatabaseAccessApi.getBinding(SERVER_ID),
    ).resolves.toBeNull();
  });

  it("fails closed when BACKUP is associated with an unexpected principal", async () => {
    getMock.mockResolvedValue(
      coreResponse([
        {
          ...backupBinding,
          databasePrincipal: "unexpected_role",
        },
      ]),
    );

    await expect(
      backupDatabaseAccessApi.getBinding(SERVER_ID),
    ).rejects.toThrow("CORE_BACKUP_PRINCIPAL_CONTRACT_MISMATCH");
  });

  it("updates only the backup rotation policy with a stable intent key", async () => {
    patchMock.mockResolvedValue(coreResponse(backupBinding));
    const dto = {
      expectedCredentialRevision: "4",
      rotationEnabled: true,
      rotationIntervalHours: 720,
      maintenanceWindowStartUtc: 1,
      maintenanceWindowHours: 2,
      reason: "Keep backup access rotation inside maintenance",
    };

    await expect(
      backupDatabaseAccessApi.updateRotationPolicy(
        SERVER_ID,
        dto,
        IDEMPOTENCY_KEY,
      ),
    ).resolves.toEqual(backupBinding);

    expect(patchMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/database-servers/${SERVER_ID}/system-principals/backup/rotation-policy`,
      dto,
      { headers: { "x-idempotency-key": IDEMPOTENCY_KEY } },
    );
  });

  it("fails closed when a backup mutation returns another system principal", async () => {
    patchMock.mockResolvedValue(
      coreResponse({
        ...backupBinding,
        purpose: "PROVISIONING",
        databasePrincipal: "mutakamel_provisioner",
      }),
    );

    await expect(
      backupDatabaseAccessApi.updateRotationPolicy(
        SERVER_ID,
        {
          expectedCredentialRevision: "4",
          reason: "Verify the fixed backup principal response",
        },
        IDEMPOTENCY_KEY,
      ),
    ).rejects.toThrow("CORE_BACKUP_PRINCIPAL_CONTRACT_MISMATCH");
  });

  it("regenerates and reconciles only the fixed backup credential", async () => {
    const receipt = {
      databaseServerId: SERVER_ID,
      purpose: "BACKUP",
      databasePrincipal: "mutakamel_backup",
      credentialRevision: "5",
      status: "READY",
    };
    postMock.mockResolvedValue(coreResponse(receipt));
    const dto = {
      expectedCredentialRevision: "4",
      reason: "Rotate the fixed backup service credential",
    };

    await backupDatabaseAccessApi.regenerateCredential(
      SERVER_ID,
      dto,
      IDEMPOTENCY_KEY,
    );
    await backupDatabaseAccessApi.reconcileCredential(
      SERVER_ID,
      dto,
      IDEMPOTENCY_KEY,
    );

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/core/v1/database-servers/${SERVER_ID}/system-principals/backup/credential/regenerate`,
      dto,
      { headers: { "x-idempotency-key": IDEMPOTENCY_KEY } },
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/core/v1/database-servers/${SERVER_ID}/system-principals/backup/credential/reconcile`,
      dto,
      { headers: { "x-idempotency-key": IDEMPOTENCY_KEY } },
    );
    expect(JSON.stringify(receipt)).not.toMatch(/password|credentialsRef|secret/i);
  });

  it("fails closed when a credential receipt identifies another principal", async () => {
    postMock.mockResolvedValue(
      coreResponse({
        databaseServerId: SERVER_ID,
        purpose: "PROVISIONING",
        databasePrincipal: "mutakamel_provisioner",
        credentialRevision: "5",
        status: "READY",
      }),
    );

    await expect(
      backupDatabaseAccessApi.regenerateCredential(
        SERVER_ID,
        {
          expectedCredentialRevision: "4",
          reason: "Verify the fixed backup credential receipt",
        },
        IDEMPOTENCY_KEY,
      ),
    ).rejects.toThrow("CORE_BACKUP_PRINCIPAL_CONTRACT_MISMATCH");
  });
});

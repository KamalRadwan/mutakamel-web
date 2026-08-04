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

vi.mock("@/shared/api/core-envelope", () => ({
  extractCoreData: (response: { data: { data: unknown } }) => response.data.data,
  extractCoreMeta: (response: { data: { meta?: unknown } }) => response.data.meta,
}));

import { databaseServersApi } from "./database-servers.api";

const receiptEnvelope = (data: unknown) => ({
  data: {
    success: true as const,
    data,
    correlationId: "019f0000-0000-7000-8000-000000000001",
    timestamp: "2026-08-02T12:00:00.000Z",
  },
});

describe("database server application credential API", () => {
  beforeEach(() => {
    deleteMock.mockReset();
    getMock.mockReset();
    patchMock.mockReset();
    postMock.mockReset();
  });

  it("does not expose a purpose-selectable system credential write API", () => {
    expect(databaseServersApi).not.toHaveProperty("updateSystemRotationPolicy");
    expect(databaseServersApi).not.toHaveProperty("regenerateSystemPrincipal");
    expect(databaseServersApi).not.toHaveProperty("reconcileSystemPrincipal");
    expect(databaseServersApi).toHaveProperty("updateProvisioningRotationPolicy");
    expect(databaseServersApi).toHaveProperty("regenerateProvisioningPrincipal");
    expect(databaseServersApi).toHaveProperty("reconcileProvisioningPrincipal");
  });

  it("filters the Backup principal out of the Database Servers feature projection", async () => {
    const serverId = "019f0000-0000-7000-8000-000000000010";
    getMock.mockResolvedValue(
      receiptEnvelope({
        id: serverId,
        name: "Primary",
        hasBackupCredentials: true,
        systemPrincipals: [
          {
            purpose: "PROVISIONING",
            databasePrincipal: "mutakamel_provisioner",
            status: "READY",
            credentialRevision: "2",
          },
          {
            purpose: "BACKUP",
            databasePrincipal: "mutakamel_backup",
            status: "READY",
            credentialRevision: "4",
          },
        ],
      }),
    );

    const server = await databaseServersApi.get(serverId);

    expect(server.hasBackupCredentials).toBe(true);
    expect(server.systemPrincipals).toEqual([
      expect.objectContaining({
        purpose: "PROVISIONING",
        databasePrincipal: "mutakamel_provisioner",
      }),
    ]);
    expect(JSON.stringify(server.systemPrincipals)).not.toContain("BACKUP");
    expect(JSON.stringify(server.systemPrincipals)).not.toContain("mutakamel_backup");
    expect(server.deletedAt).toBeNull();
  });

  it("requests only deleted servers through the documented list filter", async () => {
    const deletedAt = "2026-08-04T12:00:00.000Z";
    getMock.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: "019f0000-0000-7000-8000-000000000010",
            name: "Deleted primary",
            deletedAt,
            status: "OFFLINE",
            systemPrincipals: [],
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      },
    });

    const result = await databaseServersApi.list({
      page: 1,
      limit: 20,
      deleted: true,
    });

    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/database-servers?page=1&limit=20&deleted=true",
    );
    expect(result.data[0]?.deletedAt).toBe(deletedAt);
  });

  it("soft deletes through the existing critical DELETE contract", async () => {
    const serverId = "019f0000-0000-7000-8000-000000000010";
    deleteMock.mockResolvedValue({ status: 204 });

    await databaseServersApi.delete(
      serverId,
      "019f0000-0000-7000-8000-000000000020",
    );

    expect(deleteMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/database-servers/${serverId}`,
      {
        headers: {
          "x-idempotency-key": "019f0000-0000-7000-8000-000000000020",
        },
      },
    );
  });

  it("permanently destroys through the dedicated hard-delete contract", async () => {
    const serverId = "019f0000-0000-7000-8000-000000000010";
    const idempotencyKey = "019f0000-0000-7000-8000-000000000021";
    deleteMock.mockResolvedValue({ status: 204 });

    await databaseServersApi.destroy(serverId, idempotencyKey);

    expect(deleteMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/database-servers/${serverId}/destroy`,
      {
        headers: {
          "x-idempotency-key": idempotencyKey,
        },
      },
    );
  });

  it("retries generated credential assembly through the secret-free endpoint", async () => {
    const server = {
      id: "019f0000-0000-7000-8000-000000000010",
      deletedAt: null,
      credentialBootstrap: { status: "READY", totalPrincipals: 6, readyPrincipals: 6 },
      systemPrincipals: [],
    };
    postMock.mockResolvedValue(receiptEnvelope(server));

    const result = await databaseServersApi.retryBootstrap(
      server.id,
      { reason: "Initial least-privilege application bootstrap" },
      "019f0000-0000-7000-8000-000000000030",
    );

    expect(postMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/database-servers/${server.id}/credential-bootstrap/retry`,
      { reason: "Initial least-privilege application bootstrap" },
      {
        headers: {
          "x-idempotency-key": "019f0000-0000-7000-8000-000000000030",
        },
      },
    );
    expect(result).toEqual(server);
    expect(JSON.stringify(result)).not.toMatch(/password|secret|download|file/i);
  });

  it("regenerates one application password without invoking an export route", async () => {
    const receipt = {
      databaseServerId: "019f0000-0000-7000-8000-000000000010",
      applicationKey: "crm",
      databasePrincipal: "app_crm",
      previousCredentialRevision: "4",
      credentialRevision: "5",
      status: "READY",
      invalidatedTenantCount: 12,
    };
    postMock.mockResolvedValue(receiptEnvelope(receipt));

    const result = await databaseServersApi.regenerateApplication(
      receipt.databaseServerId,
      "crm/injected",
      {
        expectedCredentialRevision: "4",
        reason: "Scheduled operational rotation",
      },
      "019f0000-0000-7000-8000-000000000040",
    );

    const calledUrl = postMock.mock.calls[0]?.[0];
    expect(calledUrl).toBe(
      `/api/admin/core/v1/database-servers/${receipt.databaseServerId}/applications/crm%2Finjected/credential/regenerate`,
    );
    expect(calledUrl).not.toContain("export");
    expect(result).toEqual(receipt);
    expect(JSON.stringify(result)).not.toMatch(/password|secret|download|file/i);
  });

  it("updates only the provisioning rotation policy with a fenced revision", async () => {
    const serverId = "019f0000-0000-7000-8000-000000000010";
    const binding = {
      purpose: "PROVISIONING",
      databasePrincipal: "mutakamel_provisioner",
      credentialRevision: "3",
      rotationEnabled: true,
      rotationIntervalHours: 720,
      maintenanceWindowStartUtc: 2,
      maintenanceWindowHours: 1,
      status: "READY",
    };
    patchMock.mockResolvedValue(receiptEnvelope(binding));

    await databaseServersApi.updateProvisioningRotationPolicy(
      serverId,
      {
        expectedCredentialRevision: "3",
        rotationEnabled: true,
        rotationIntervalHours: 720,
        maintenanceWindowStartUtc: 2,
        maintenanceWindowHours: 1,
        reason: "Keep provisioning rotation inside the maintenance window",
      },
      "019f0000-0000-7000-8000-000000000060",
    );

    expect(patchMock.mock.calls[0]?.[0]).toBe(
      `/api/admin/core/v1/database-servers/${serverId}/system-principals/provisioning/rotation-policy`,
    );
    expect(patchMock.mock.calls[0]?.[2]).toEqual({
      headers: {
        "x-idempotency-key": "019f0000-0000-7000-8000-000000000060",
      },
    });
  });

  it("regenerates a fixed system principal without an export or password field", async () => {
    const receipt = {
      databaseServerId: "019f0000-0000-7000-8000-000000000010",
      purpose: "PROVISIONING",
      databasePrincipal: "mutakamel_provisioner",
      credentialRevision: "5",
      status: "READY",
    };
    postMock.mockResolvedValue(receiptEnvelope(receipt));

    const result = await databaseServersApi.regenerateProvisioningPrincipal(
      receipt.databaseServerId,
      {
        expectedCredentialRevision: "4",
        reason: "Scheduled provisioner rotation",
      },
      "019f0000-0000-7000-8000-000000000070",
    );

    const calledUrl = postMock.mock.calls[0]?.[0];
    expect(calledUrl).toBe(
      `/api/admin/core/v1/database-servers/${receipt.databaseServerId}/system-principals/provisioning/credential/regenerate`,
    );
    expect(calledUrl).not.toContain("export");
    expect(result).toEqual(receipt);
    expect(JSON.stringify(result)).not.toMatch(/password|credentialsRef|secret/i);
  });

  it("reconciles the stored candidate revision through the existing safe route", async () => {
    const receipt = {
      databaseServerId: "019f0000-0000-7000-8000-000000000010",
      applicationKey: "trade",
      databasePrincipal: "app_trade",
      previousCredentialRevision: "8",
      credentialRevision: "9",
      status: "READY",
      invalidatedTenantCount: 3,
    };
    postMock.mockResolvedValue(receiptEnvelope(receipt));

    await databaseServersApi.reconcileApplication(
      receipt.databaseServerId,
      receipt.applicationKey,
      {
        expectedCredentialRevision: "8",
        reason: "Resume an interrupted rotation",
      },
      "019f0000-0000-7000-8000-000000000050",
    );

    expect(postMock.mock.calls[0]?.[0]).toBe(
      `/api/admin/core/v1/database-servers/${receipt.databaseServerId}/applications/trade/credential/reconcile`,
    );
  });

  it("reconciles only the exact staged provisioning candidate", async () => {
    const receipt = {
      databaseServerId: "019f0000-0000-7000-8000-000000000010",
      purpose: "PROVISIONING",
      databasePrincipal: "mutakamel_provisioner",
      credentialRevision: "9",
      status: "READY",
    };
    postMock.mockResolvedValue(receiptEnvelope(receipt));

    await databaseServersApi.reconcileProvisioningPrincipal(
      receipt.databaseServerId,
      {
        expectedCredentialRevision: "8",
        reason: "Resume the exact provisioning credential candidate",
      },
      "019f0000-0000-7000-8000-000000000080",
    );

    expect(postMock.mock.calls[0]?.[0]).toBe(
      `/api/admin/core/v1/database-servers/${receipt.databaseServerId}/system-principals/provisioning/credential/reconcile`,
    );
  });
});

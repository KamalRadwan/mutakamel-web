import { beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: client,
  unwrapCoreData: <T>(payload: { data: T }) => payload.data,
}));

import { storageServersApi } from "./storage-servers.api";

const serverId = "019f0000-0000-7000-8000-000000000051";
const runId = "019f0000-0000-7000-8000-000000000061";
const correlationId = "019f0000-0000-7000-8000-000000000071";
const server = {
  id: serverId,
  code: "storage-1",
  name: "Primary Garage",
  provider: "GARAGE",
  placementRole: "GENERAL",
  internalEndpoint: "http://192.168.222.51:3900",
  publicEndpoint: "https://s3-storage-1.mutakamel.ai",
  region: "garage",
  forcePathStyle: true,
  configRevision: 1,
  bindingRevision: 1,
  readinessRevision: 1,
  status: "DRAFT",
  availabilityClass: "DEGRADED_SINGLE_NODE",
  healthStatus: "UNKNOWN",
  maxTenants: 100,
  currentTenants: 0,
  retainedTenants: 0,
  reservedTenants: 0,
  desiredNodeCount: 3,
  desiredZoneCount: 3,
  requiredReplicationFactor: 3,
  observedNodeCount: 1,
  observedZoneCount: 1,
  observedReplicationFactor: 1,
  usableCapacityBytes: "1099511627776",
  usedCapacityBytes: "0",
  allocatableCapacityBytes: "1099511627776",
  activeReservedCapacityBytes: "0",
  warningPercent: 70,
  criticalPercent: 85,
  createdAt: "2026-07-29T10:00:00.000Z",
  updatedAt: "2026-07-29T10:00:00.000Z",
};

describe("storage servers API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the canonical Gateway list and detail paths", async () => {
    client.get
      .mockResolvedValueOnce({ data: { data: { items: [], total: 0 } } })
      .mockResolvedValueOnce({ data: { data: server } });

    await storageServersApi.list();
    await storageServersApi.get(serverId);

    expect(client.get).toHaveBeenNthCalledWith(
      1,
      "/api/admin/core/v1/storage-servers",
    );
    expect(client.get).toHaveBeenNthCalledWith(
      2,
      `/api/admin/core/v1/storage-servers/${serverId}`,
    );
  });

  it("forwards the exact caller-owned UUIDv7 key on mutations", async () => {
    client.post.mockResolvedValue({ data: { data: server } });
    const key = "019f0000-0000-7000-8000-000000000099";

    await storageServersApi.activate(serverId, key);

    expect(client.post).toHaveBeenCalledWith(
      `/api/admin/core/v1/storage-servers/${serverId}/activate`,
      {},
      { headers: { "x-idempotency-key": key } },
    );
  });

  it("uses the exact create and changed-fields-only update routes", async () => {
    client.post.mockResolvedValueOnce({ data: { data: server } });
    client.patch.mockResolvedValueOnce({
      data: { data: { ...server, maxTenants: 120 } },
    });
    const key = "019f0000-0000-7000-8000-000000000099";
    const createBody = {
      code: server.code,
      name: server.name,
      internalEndpoint: server.internalEndpoint,
      publicEndpoint: server.publicEndpoint,
      region: server.region,
      placementRole: "GENERAL" as const,
      forcePathStyle: true as const,
      desiredNodeCount: server.desiredNodeCount,
      desiredZoneCount: server.desiredZoneCount,
      requiredReplicationFactor: server.requiredReplicationFactor,
      maxTenants: server.maxTenants,
      warningPercent: server.warningPercent,
      criticalPercent: server.criticalPercent,
    };

    await storageServersApi.create(createBody, key);
    await storageServersApi.update(serverId, { maxTenants: 120 }, key);

    expect(client.post).toHaveBeenCalledWith(
      "/api/admin/core/v1/storage-servers",
      createBody,
      { headers: { "x-idempotency-key": key } },
    );
    expect(client.patch).toHaveBeenCalledWith(
      `/api/admin/core/v1/storage-servers/${serverId}`,
      { maxTenants: 120 },
      { headers: { "x-idempotency-key": key } },
    );
  });

  it("uses the exact verification-start and lifecycle routes", async () => {
    const key = "019f0000-0000-7000-8000-000000000099";
    client.post
      .mockResolvedValueOnce({
        data: {
          data: {
            verificationRunId: runId,
            correlationId,
            status: "PENDING",
            expiresAt: "2026-07-29T10:15:00.000Z",
          },
        },
      })
      .mockResolvedValue({ data: { data: server } });

    await storageServersApi.startVerification(serverId, key);
    await storageServersApi.drain(serverId, key);
    await storageServersApi.offline(serverId, key);

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      `/api/admin/core/v1/storage-servers/${serverId}/verification-runs`,
      {},
      { headers: { "x-idempotency-key": key } },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      `/api/admin/core/v1/storage-servers/${serverId}/drain`,
      {},
      { headers: { "x-idempotency-key": key } },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      3,
      `/api/admin/core/v1/storage-servers/${serverId}/offline`,
      {},
      { headers: { "x-idempotency-key": key } },
    );
  });

  it("keeps deletion and history on the documented endpoints", async () => {
    client.get.mockResolvedValue({ data: { data: { items: [], total: 0 } } });
    client.delete.mockResolvedValue({ data: "", status: 204 });
    const key = "019f0000-0000-7000-8000-000000000099";

    await storageServersApi.history(serverId);
    await storageServersApi.remove(serverId, key);

    expect(client.get).toHaveBeenCalledWith(
      `/api/admin/core/v1/storage-servers/${serverId}/history`,
    );
    expect(client.delete).toHaveBeenCalledWith(
      `/api/admin/core/v1/storage-servers/${serverId}`,
      { headers: { "x-idempotency-key": key } },
    );
  });

  it("polls one exact verification run through the read route", async () => {
    client.get.mockResolvedValue({
      data: {
        data: {
          id: runId,
          status: "PASS",
          configRevision: 1,
          bindingRevision: 1,
          readinessRevision: 1,
          probeProfileVersion: 1,
          requestedAt: "2026-07-29T10:00:00.000Z",
          expiresAt: "2026-07-29T10:15:00.000Z",
          completedAt: "2026-07-29T10:01:00.000Z",
          correlationId,
          results: [
            {
              principal: "CORE",
              credentialRole: "OPERATION",
              status: "PASS",
              verifiedAt: "2026-07-29T10:01:00.000Z",
            },
          ],
        },
      },
    });

    await expect(storageServersApi.getVerification(serverId, runId)).resolves
      .toMatchObject({ id: runId, status: "PASS" });
    expect(client.get).toHaveBeenCalledWith(
      `/api/admin/core/v1/storage-servers/${serverId}/verification-runs/${runId}`,
    );
  });

  it("rejects placeholder ids and incomplete server projections before use", async () => {
    await expect(storageServersApi.get("server-1")).rejects.toThrow(
      "INVALID_STORAGE_SERVER_ID",
    );
    expect(client.get).not.toHaveBeenCalled();

    client.get.mockResolvedValue({ data: { data: { id: serverId } } });
    await expect(storageServersApi.get(serverId)).rejects.toThrow(
      "INVALID_STORAGE_SERVER_RESPONSE",
    );
  });

  it("returns only the safe allowlisted detail projection", async () => {
    client.get.mockResolvedValue({
      data: {
        data: {
          ...server,
          accessKeyId: "must-not-reach-ui",
          secretAccessKey: "must-not-reach-ui",
          bucketBindings: [{ bucket: "must-not-reach-ui" }],
        },
      },
    });

    const result = await storageServersApi.get(serverId);

    expect(result).toEqual(server);
    expect(result).not.toHaveProperty("accessKeyId");
    expect(result).not.toHaveProperty("secretAccessKey");
    expect(result).not.toHaveProperty("bucketBindings");
  });

  it("rejects unsafe endpoint projections before they reach UI state", async () => {
    client.get
      .mockResolvedValueOnce({
        data: {
          data: {
            ...server,
            internalEndpoint: "http://storage.example.com:3900",
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: {
            ...server,
            publicEndpoint: "https://s3-storage-1.mutakamel.ai/s3",
          },
        },
      });

    await expect(storageServersApi.get(serverId)).rejects.toThrow(
      "INVALID_STORAGE_SERVER_RESPONSE",
    );
    await expect(storageServersApi.get(serverId)).rejects.toThrow(
      "INVALID_STORAGE_SERVER_RESPONSE",
    );
  });
});

import { describe, expect, it } from "vitest";
import type { StorageServerAdminView } from "@/types/storage-server";
import {
  buildStorageServerUpdate,
  canEditStorageServer,
  formatStorageBytes,
  hasNoVisibleStorageAllocations,
  normalizeStorageApiError,
  storageCapacityPercent,
  validateStorageServerDraft,
} from "./storage-server-utils";
import { generateUUIDv7 } from "../../../lib/utils/uuid";

const server: StorageServerAdminView = {
  id: "019f0000-0000-7000-8000-000000000051",
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
  usedCapacityBytes: "274877906944",
  allocatableCapacityBytes: "824633720832",
  activeReservedCapacityBytes: "0",
  warningPercent: 70,
  criticalPercent: 85,
  createdAt: "2026-07-28T08:00:00.000Z",
  updatedAt: "2026-07-28T08:00:00.000Z",
};

describe("storage server form contract", () => {
  it("rejects credentialed/query endpoints and invalid cross-field values", () => {
    const errors = validateStorageServerDraft(
      {
        name: "Primary Garage",
        internalEndpoint: "http://user:secret@storage.local:3900?debug=1",
        publicEndpoint: "http://storage.example.com/#debug",
        region: "garage",
        placementRole: "BACKUP_ONLY",
        desiredNodeCount: 1,
        desiredZoneCount: 2,
        requiredReplicationFactor: 3,
        maxTenants: 1,
        warningPercent: 90,
        criticalPercent: 85,
      },
      "Invalid_Code",
    );

    expect(errors.code).toBeDefined();
    expect(errors.internalEndpoint).toContain("Credentials");
    expect(errors.publicEndpoint).toContain("HTTPS");
    expect(errors.desiredZoneCount).toBeDefined();
    expect(errors.requiredReplicationFactor).toBeDefined();
    expect(errors.maxTenants).toBeDefined();
    expect(errors.criticalPercent).toBeDefined();
  });

  it("requires origin-only endpoints and a private literal for internal HTTP", () => {
    const baseDraft = {
      name: "Primary Garage",
      internalEndpoint: "http://storage.example.com:3900",
      publicEndpoint: "https://storage.example.com/s3",
      region: "garage",
      placementRole: "GENERAL" as const,
      desiredNodeCount: 3,
      desiredZoneCount: 3,
      requiredReplicationFactor: 3,
      maxTenants: 100,
      warningPercent: 70,
      criticalPercent: 85,
    };

    const errors = validateStorageServerDraft(baseDraft, "storage-1");
    expect(errors.internalEndpoint).toContain("RFC1918");
    expect(errors.publicEndpoint).toContain("paths");

    expect(
      validateStorageServerDraft(
        {
          ...baseDraft,
          internalEndpoint: "https://storage.internal.example:3900",
          publicEndpoint: "https://storage.example.com",
        },
        "storage-1",
      ),
    ).toEqual({});
  });

  it("builds a strict changed-fields-only update", () => {
    const update = buildStorageServerUpdate(server, {
      name: "Primary Garage",
      internalEndpoint: server.internalEndpoint,
      publicEndpoint: server.publicEndpoint,
      region: server.region,
      placementRole: server.placementRole,
      desiredNodeCount: server.desiredNodeCount,
      desiredZoneCount: server.desiredZoneCount,
      requiredReplicationFactor: server.requiredReplicationFactor,
      maxTenants: 120,
      warningPercent: server.warningPercent,
      criticalPercent: server.criticalPercent,
    });

    expect(update).toEqual({ maxTenants: 120 });
    expect(update).not.toHaveProperty("code");
    expect(update).not.toHaveProperty("status");
  });

  it("keeps byte formatting and capacity math BigInt-safe", () => {
    expect(formatStorageBytes("1099511627776")).toBe("1 TiB");
    expect(formatStorageBytes("1536")).toBe("1.5 KiB");
    expect(storageCapacityPercent("274877906944", "1099511627776")).toBe(25);
    expect(formatStorageBytes("not-a-number")).toBe("Unavailable");
  });

  it("enforces the read-only edit gate and preserves support evidence", () => {
    expect(canEditStorageServer(server)).toBe(true);
    expect(canEditStorageServer({ ...server, currentTenants: 1 })).toBe(false);
    expect(canEditStorageServer({ ...server, reservedTenants: 1 })).toBe(false);
    expect(
      canEditStorageServer({
        ...server,
        activeReservedCapacityBytes: "1048576",
      }),
    ).toBe(false);
    expect(canEditStorageServer({ ...server, status: "ACTIVE" })).toBe(false);
    expect(hasNoVisibleStorageAllocations(server)).toBe(true);

    expect(
      normalizeStorageApiError({
        response: {
          status: 422,
          data: {
            errorCode: "STORAGE_SERVER_ENDPOINT_INVALID",
            message: ["Endpoint is invalid"],
            correlationId: "019f0000-0000-7000-8000-000000000099",
            details: { publicEndpoint: ["HTTPS is required"] },
          },
        },
      }),
    ).toMatchObject({
      status: 422,
      code: "STORAGE_SERVER_ENDPOINT_INVALID",
      message: "Endpoint is invalid",
      correlationId: "019f0000-0000-7000-8000-000000000099",
      fieldErrors: { publicEndpoint: "HTTPS is required" },
      ambiguous: false,
    });
  });

  it("generates a canonical UUIDv7 for every storage mutation intent", () => {
    expect(generateUUIDv7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  formatStorageBytes,
  getStoragePlacementState,
  readStoragePlacementOptions,
  sanitizeTenantStoragePlacement,
  type TenantStoragePlacementOption,
} from "./storage-placement";

const option = {
  id: "019f0000-0000-7000-8000-000000000030",
  name: "Primary Garage Cluster",
  provider: "GARAGE",
  region: "garage",
  status: "ACTIVE",
  availabilityClass: "HA_PRODUCTION_READY",
  currentTenants: 10,
  retainedTenants: 1,
  reservedTenants: 2,
  maxTenants: 100,
  capacityPercent: 13,
  allocatableCapacityBytes: "1099511627776",
  availableReservationBytes: "536870912000",
};

describe("tenant storage placement contract", () => {
  it("reads the bounded Core response without accepting a partial row", () => {
    const payloadWithSecrets = {
      ...option,
      internalEndpoint: "http://storage.internal:3900",
      credentialRef: "env:S3_STORAGE_1_CORE_OPERATION",
      secretAccessKey: "must-not-reach-ui",
      bucketBindings: [{ bucket: "must-not-reach-ui" }],
    };
    expect(
      readStoragePlacementOptions({
        success: true,
        data: { items: [payloadWithSecrets], total: 1 },
      }),
    ).toEqual([option]);
    const parsed = readStoragePlacementOptions({
      data: { items: [payloadWithSecrets], total: 1 },
    })[0] as TenantStoragePlacementOption & Record<string, unknown>;
    expect(parsed).not.toHaveProperty("internalEndpoint");
    expect(parsed).not.toHaveProperty("credentialRef");
    expect(parsed).not.toHaveProperty("secretAccessKey");
    expect(parsed).not.toHaveProperty("bucketBindings");

    expect(() =>
      readStoragePlacementOptions({
        success: true,
        data: { items: [{ ...option, region: undefined }], total: 1 },
      }),
    ).toThrow("INVALID_STORAGE_PLACEMENT_OPTIONS_RESPONSE");

    expect(() =>
      readStoragePlacementOptions({
        success: true,
        data: { items: [{ ...option, id: "storage-1" }], total: 1 },
      }),
    ).toThrow("INVALID_STORAGE_PLACEMENT_OPTIONS_RESPONSE");
  });

  it("fails closed when the response total does not match the bounded list", () => {
    expect(() =>
      readStoragePlacementOptions({
        data: { items: [option], total: 2 },
      }),
    ).toThrow("INVALID_STORAGE_PLACEMENT_OPTIONS_RESPONSE");
  });

  it("keeps permission, loading, error, and empty states blocking", () => {
    expect(
      getStoragePlacementState({
        canCreateTenant: false,
        isLoading: true,
        hasError: false,
        optionCount: 0,
      }),
    ).toBe("loading");
    expect(
      getStoragePlacementState({
        canCreateTenant: false,
        isLoading: false,
        hasError: false,
        optionCount: 1,
      }),
    ).toBe("forbidden");
    expect(
      getStoragePlacementState({
        canCreateTenant: true,
        isLoading: true,
        hasError: false,
        optionCount: 1,
      }),
    ).toBe("loading");
    expect(
      getStoragePlacementState({
        canCreateTenant: true,
        isLoading: false,
        hasError: true,
        optionCount: 1,
      }),
    ).toBe("error");
    expect(
      getStoragePlacementState({
        canCreateTenant: true,
        isLoading: false,
        hasError: false,
        optionCount: 0,
      }),
    ).toBe("empty");
  });

  it("formats decimal byte strings without unsafe Number conversion", () => {
    expect(formatStorageBytes("1099511627776")).toBe("1.0 TiB");
    expect(formatStorageBytes("1536")).toBe("1.5 KiB");
    expect(formatStorageBytes("not-a-number")).toBe("Unavailable");
  });

  it("keeps only the safe read-only storage summary on tenant detail", () => {
    const tenant = sanitizeTenantStoragePlacement({
      id: "019f0000-0000-7000-8000-000000000020",
      storageServerId: option.id,
      storageServer: {
        id: option.id,
        name: option.name,
        provider: option.provider,
        region: option.region,
        status: option.status,
        availabilityClass: option.availabilityClass,
        internalEndpoint: "http://storage.internal:3900",
        credentialRef: "env:S3_STORAGE_1_CORE_OPERATION",
        bucketBindings: [{ bucket: "must-not-reach-ui" }],
      },
    });

    expect(tenant.storageServer).toEqual({
      id: option.id,
      name: option.name,
      provider: option.provider,
      region: option.region,
      status: option.status,
      availabilityClass: option.availabilityClass,
    });
    expect(tenant.storageServer).not.toHaveProperty("internalEndpoint");
    expect(tenant.storageServer).not.toHaveProperty("credentialRef");
    expect(tenant.storageServer).not.toHaveProperty("bucketBindings");
    expect(() =>
      sanitizeTenantStoragePlacement({
        storageServerId: option.id,
        storageServer: { ...option, id: "019f0000-0000-7000-8000-000000000099" },
      }),
    ).toThrow("INVALID_TENANT_STORAGE_PLACEMENT_RESPONSE");
  });
});

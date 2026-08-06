import { describe, expect, it } from "vitest";
import {
  getStoragePlacementState,
  readStoragePlacementOptions,
  sanitizeTenantStoragePlacement,
  type TenantStoragePlacementOption,
} from "./storage-placement";

const option = {
  id: "019f0000-0000-7000-8000-000000000030",
  code: "S3-EGYPT-1",
  name: "Primary S3 Storage",
  region: "ME-CAIRO-1",
  status: "ACTIVE",
  maxTenants: 100,
  assignedTenants: 10,
};

describe("tenant storage placement contract", () => {
  it("reads the bounded Core response without accepting a partial row", () => {
    const payloadWithSecrets = {
      ...option,
      internalEndpoint: "http://storage.internal:3900",
      credentialRef: "env:S3_STORAGE_1_CORE_OPERATION",
      secretAccessKey: "must-not-reach-ui",
      bucketName: "must-not-reach-placement-ui",
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
    expect(parsed).not.toHaveProperty("bucketName");

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

  it("keeps only the safe read-only storage summary on tenant detail", () => {
    const tenant = sanitizeTenantStoragePlacement({
      id: "019f0000-0000-7000-8000-000000000020",
      storageServerId: option.id,
      storageServer: {
        id: option.id,
        code: option.code,
        name: option.name,
        region: option.region,
        bucketName: "mutakamel-tenants-1",
        status: option.status,
        internalEndpoint: "http://storage.internal:3900",
        credentialRef: "env:S3_STORAGE_1_CORE_OPERATION",
      },
    });

    expect(tenant.storageServer).toEqual({
      id: option.id,
      code: option.code,
      name: option.name,
      region: option.region,
      bucketName: "mutakamel-tenants-1",
      status: option.status,
    });
    expect(tenant.storageServer).not.toHaveProperty("internalEndpoint");
    expect(tenant.storageServer).not.toHaveProperty("credentialRef");
    expect(() =>
      sanitizeTenantStoragePlacement({
        storageServerId: option.id,
        storageServer: { ...option, id: "019f0000-0000-7000-8000-000000000099" },
      }),
    ).toThrow("INVALID_TENANT_STORAGE_PLACEMENT_RESPONSE");
  });
});

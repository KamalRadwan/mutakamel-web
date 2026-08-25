import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CUSTOM_FQDN_ID,
  OPERATION_ID,
  TENANT_ID,
  UPDATED_AT,
  customFqdnFixture,
  tenantPayload,
} from "../__tests__/fixtures";

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: {
    get: getMock,
    post: postMock,
    patch: patchMock,
    delete: deleteMock,
  },
}));

import { tenantCoreApi } from "./tenant-core.api";

const envelope = (data: unknown) => ({ data: { data } });
const key = "019ff251-9999-7999-8999-999999999999";
const keyed = { headers: { "x-idempotency-key": key } };

describe("tenant core API", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
    deleteMock.mockReset();
  });

  it("loads one tenant-first detail projection with AbortSignal", async () => {
    const controller = new AbortController();
    getMock.mockResolvedValue(envelope(tenantPayload("PROVISIONING")));

    await expect(tenantCoreApi.get(TENANT_ID, controller.signal)).resolves
      .toMatchObject({ id: TENANT_ID, status: "PROVISIONING" });
    expect(getMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/tenants/${TENANT_ID}`,
      { signal: controller.signal },
    );
    expect(getMock.mock.calls.flat().join(" ")).not.toContain("/fqdns");
  });

  it("updates the complete profile draft with optimistic concurrency and key", async () => {
    patchMock.mockResolvedValue(envelope(tenantPayload()));
    const dto = {
      expectedUpdatedAt: UPDATED_AT,
      companyName: "Acme LLC",
      countryName: "Egypt",
      countryIsoCode: "EG",
      industry: null,
      timezone: null,
      phoneCountryCode: null,
      phone: null,
      address: null,
      taxNumber: null,
      commercialRegistrationNumber: null,
    };

    await tenantCoreApi.updateProfile(TENANT_ID, dto, key);
    expect(patchMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/tenants/${TENANT_ID}`,
      dto,
      keyed,
    );
  });

  it("uses exact suspend and activate compatibility routes", async () => {
    postMock
      .mockResolvedValueOnce(envelope(tenantPayload("SUSPENDED")))
      .mockResolvedValueOnce(envelope(tenantPayload("ACTIVE")));

    await tenantCoreApi.suspend(TENANT_ID, key);
    await tenantCoreApi.activate(TENANT_ID, key);
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/core/v1/tenants/${TENANT_ID}/suspend`,
      undefined,
      keyed,
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/core/v1/tenants/${TENANT_ID}/activate`,
      undefined,
      keyed,
    );
  });

  it("uses exact reprovision and cancel routes and reads operation evidence", async () => {
    const command = {
      replayed: false,
      operation: {
        id: OPERATION_ID,
        tenantId: TENANT_ID,
        type: "RETRY",
        status: "QUEUED",
      },
    };
    postMock.mockResolvedValue(envelope(command));

    await expect(tenantCoreApi.reprovision(TENANT_ID, key)).resolves.toEqual(
      command,
    );
    await tenantCoreApi.cancelProvisioning(TENANT_ID, key);
    expect(postMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/core/v1/tenants/${TENANT_ID}/reprovision`,
      undefined,
      keyed,
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/core/v1/tenants/${TENANT_ID}/provisioning/cancel`,
      undefined,
      keyed,
    );
  });

  it("uses exact soft-delete and destroy query contracts", async () => {
    deleteMock.mockResolvedValue({ data: undefined });

    await tenantCoreApi.softDelete(TENANT_ID, key);
    await tenantCoreApi.destroy(TENANT_ID, true, key);
    await tenantCoreApi.destroy(TENANT_ID, false, key);
    expect(deleteMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/core/v1/tenants/${TENANT_ID}`,
      keyed,
    );
    expect(deleteMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/core/v1/tenants/${TENANT_ID}/destroy?destroySubscriptions=true`,
      keyed,
    );
    expect(deleteMock).toHaveBeenNthCalledWith(
      3,
      `/api/admin/core/v1/tenants/${TENANT_ID}/destroy?destroySubscriptions=false`,
      keyed,
    );
  });

  it("preflights through the singular global POST and opts out of auto keys", async () => {
    const controller = new AbortController();
    const evidence = {
      fqdn: "portal.example.com",
      valid: false,
      available: true,
      reason: "DNS_NOT_FOUND",
      message: "DNS pending",
    };
    postMock.mockResolvedValue(envelope(evidence));

    await expect(
      tenantCoreApi.validateFqdn("portal.example.com", controller.signal),
    ).resolves.toEqual(evidence);
    expect(postMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/tenant-fqdns/validate",
      { fqdn: "portal.example.com" },
      { signal: controller.signal, skipAutoIdempotency: true },
    );
  });

  it("adds from POST evidence and reconciles remove/promotion through tenant detail", async () => {
    postMock.mockResolvedValueOnce(envelope(customFqdnFixture()));
    deleteMock.mockResolvedValue({ data: undefined });
    postMock.mockResolvedValueOnce({ data: undefined });

    await expect(
      tenantCoreApi.addFqdn(TENANT_ID, "portal.example.com", key),
    ).resolves.toMatchObject({ id: CUSTOM_FQDN_ID });
    await tenantCoreApi.removeFqdn(TENANT_ID, CUSTOM_FQDN_ID, key);
    await tenantCoreApi.promoteFqdn(TENANT_ID, CUSTOM_FQDN_ID, key);

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      `/api/admin/core/v1/tenants/${TENANT_ID}/fqdns`,
      { fqdn: "portal.example.com" },
      keyed,
    );
    expect(deleteMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/tenants/${TENANT_ID}/fqdns/${CUSTOM_FQDN_ID}`,
      keyed,
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      `/api/admin/core/v1/tenants/${TENANT_ID}/fqdns/${CUSTOM_FQDN_ID}/primary`,
      undefined,
      keyed,
    );
    expect(getMock).not.toHaveBeenCalled();
  });
});

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

vi.mock("@/shared/api/core-envelope", () => ({
  extractCoreData: (response: { data: { data: unknown } }) => response.data.data,
  extractCoreMeta: (response: { data: { meta?: unknown } }) => response.data.meta,
}));

import { applicationsApi } from "./applications.api";

const envelope = (data: unknown) => ({ data: { data } });

describe("Application technical provisioning API", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("reads the fail-closed technical readiness projection", async () => {
    const readiness = {
      contractVersion: 1,
      applicationId: "019f0000-0000-7000-8000-000000000001",
      applicationKey: "hr",
      runtimeTarget: "people-runtime",
      commercialMode: "SUBSCRIPTION",
      catalogueVisibility: "PUBLIC",
      lifecycleStatus: "DRAFT",
      publicationStatus: "UNPUBLISHED",
      technicalDefinitionRevision: "1",
      status: "BLOCKED",
      activationAllowed: false,
      selectionAllowed: false,
      selectionBlockers: ["APPLICATION_LIFECYCLE_NOT_ACTIVE", "APPLICATION_NOT_PUBLISHED"],
      reasons: ["PUBLISHED_RELEASE_REQUIRED"],
      checks: {
        runtimeTarget: true,
        componentBinding: true,
        activeComponents: true,
        publishedReleases: false,
        minimumReleases: true,
        databasePermissionManifest: true,
      },
      components: [],
    };
    getMock.mockResolvedValue(envelope(readiness));

    await expect(applicationsApi.getTechnicalProvisioning("hr/tools")).resolves.toEqual(readiness);
    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/applications/hr%2Ftools/technical-provisioning"
    );
  });

  it("links only controlled component metadata with an idempotency key", async () => {
    const dto = {
      expectedTechnicalDefinitionRevision: "1",
      componentKey: "hr.schema",
      contractVersion: 1,
      reason: "Link the HR runtime component",
    };
    const receipt = {
      contractVersion: 1,
      operation: "UPDATE",
      applicationKey: "hr",
    };
    postMock.mockResolvedValue(envelope(receipt));

    await expect(
      applicationsApi.createPrimaryProvisioningComponent(
        "hr",
        dto,
        "019f0000-0000-7000-8000-000000000001"
      )
    ).resolves.toEqual(receipt);

    expect(postMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/applications/hr/technical-provisioning/primary-component",
      dto,
      {
        headers: {
          "x-idempotency-key": "019f0000-0000-7000-8000-000000000001",
        },
      }
    );
    expect(JSON.stringify(postMock.mock.calls[0]?.[1])).not.toMatch(/sql|password|secret/i);
  });

  it("publishes an exact catalogue revision with a caller-owned idempotency key", async () => {
    const dto = {
      expectedCatalogueRevision: "7",
      expectedPublicationRevision: "3",
      reason: "Signed technical package and catalogue metadata verified",
    };
    const receipt = {
      contractVersion: 1,
      operation: "PUBLISH",
      applicationId: "019f0000-0000-7000-8000-000000000001",
      applicationKey: "hr",
      lifecycleStatus: "DRAFT",
      runtimeTarget: "people-runtime",
      publicationStatus: "PUBLISHED",
      publicationRevision: "4",
      catalogueRevision: "8",
      policyRevision: "1",
      deleted: false,
    };
    const idempotencyKey = "019f0000-0000-7000-8000-000000000099";
    postMock.mockResolvedValue(envelope(receipt));

    await expect(
      applicationsApi.publish("hr/tools", dto, idempotencyKey)
    ).resolves.toEqual(receipt);

    expect(postMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/applications/hr%2Ftools/publish",
      dto,
      { headers: { "x-idempotency-key": idempotencyKey } }
    );
  });

  it("serializes the publication status list filter", async () => {
    getMock.mockResolvedValue(envelope([]));

    await applicationsApi.list({ publicationStatus: "PUBLISHED" });

    expect(getMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/applications?publicationStatus=PUBLISHED"
    );
  });
});

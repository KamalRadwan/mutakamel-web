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
      runtimeTarget: null,
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

  it("adopts the deterministic technical identity with an idempotency key", async () => {
    const dto = {
      expectedTechnicalDefinitionRevision: "1",
      reason: "Adopt the signed HR package identity",
    };
    const receipt = {
      contractVersion: 1,
      operation: "ADOPT_TECHNICAL_PACKAGE",
      applicationKey: "hr",
      technicalIdentity: {
        runtimeTarget: "hr-app",
        primaryComponentKey: "app.hr",
        databasePrincipal: "mutakamel_hr_app",
        contractVersion: 1,
      },
    };
    postMock.mockResolvedValue(envelope(receipt));

    await expect(
      applicationsApi.adoptTechnicalPackage(
        "hr",
        dto,
        "019f0000-0000-7000-8000-000000000001",
      ),
    ).resolves.toEqual(receipt);
    expect(postMock).toHaveBeenCalledWith(
      "/api/admin/core/v1/applications/hr/technical-provisioning/adopt",
      dto,
      {
        headers: {
          "x-idempotency-key": "019f0000-0000-7000-8000-000000000001",
        },
      },
    );
    expect(JSON.stringify(postMock.mock.calls[0]?.[1])).not.toMatch(/sql|password|secret/i);
  });

  it("links only the revision and audit reason with an idempotency key", async () => {
    const dto = {
      expectedTechnicalDefinitionRevision: "2",
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
      runtimeTarget: "hr-app",
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

  it("never auto-keys or replays non-idempotent tier and feature creates", async () => {
    const tier = { id: "tier-1", key: "business", name: "Business" };
    const feature = { id: "feature-1", key: "crm.email", name: "Email" };
    postMock
      .mockResolvedValueOnce(envelope(tier))
      .mockResolvedValueOnce(envelope(feature));

    await applicationsApi.createTier("application-1", {
      key: "business",
      name: "Business",
      color: "#3b82f6",
      isActive: true,
    });
    await applicationsApi.createFeature("application-1", {
      key: "crm.email",
      name: "Email",
      isActive: true,
      rank: 0,
    });

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      "/api/admin/core/v1/applications/application-1/tiers",
      expect.any(Object),
      { skipAutoIdempotency: true, nonReplayable: true },
    );
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      "/api/admin/core/v1/applications/application-1/features",
      expect.any(Object),
      { skipAutoIdempotency: true, nonReplayable: true },
    );
  });
});

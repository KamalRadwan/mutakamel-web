import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
}));
vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, post: postMock, patch: patchMock },
}));

import { provisioningReleasesApi } from "./provisioning-releases-api";

const DRAFT_ID = "019f0000-0000-7000-8000-000000000001";
const RELEASE_ID = "019f0000-0000-7000-8000-000000000002";
const COMPONENT_ID = "019f0000-0000-7000-8000-000000000003";
const KEY_ID = "019f0000-0000-7000-8000-000000000004";
const COMMAND_ID = "019f0000-0000-7000-8000-000000000005";
const TIMESTAMP = "2026-08-12T08:00:00.000Z";
const SHA = "a".repeat(64);
const SIGNATURE = `${"A".repeat(86)}==`;

const definition = {
  componentId: COMPONENT_ID,
  releaseVersion: "2.1.0",
  manifestVersion: 2,
  contractVersion: 1,
  runtimeBuildSha: "abcdef1",
  schemaTarget: "core_v2",
  schemaChecksum: null,
  manifestChecksum: SHA,
  manifestPayload: {
    componentKey: "core.foundation",
    contractVersion: 1,
    schemaTarget: "core_v2",
    seedPacks: [],
  },
  compatibility: { contractVersion: 1, requiredComponents: {} },
  riskLevel: "LOW",
  selfServiceAllowed: false,
  requiresBackup: true,
  requiresMaintenance: false,
};
const draft = {
  draftId: DRAFT_ID,
  ...definition,
  revision: 1,
  status: "DRAFT",
  publisherKeyId: null,
  signingDigest: null,
  validatedAt: null,
  publishedReleaseId: null,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
};
const release = {
  releaseId: RELEASE_ID,
  ...definition,
  status: "PUBLISHED",
  publicationSource: "SIGNED_API",
  publisherKeyId: KEY_ID,
  signatureAlgorithm: "Ed25519",
  signatureBase64: SIGNATURE,
  signedPayloadDigest: SHA,
  publishedAt: TIMESTAMP,
  retiredAt: null,
  retirementReasonCode: null,
};

function response(data: unknown) {
  return {
    data: { success: true, data, correlationId: "corr-release", timestamp: TIMESTAMP },
  };
}

describe("provisioningReleasesApi", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    patchMock.mockReset();
  });

  it("calls all four exact no-store read routes", async () => {
    const signal = new AbortController().signal;
    getMock
      .mockResolvedValueOnce(response([draft]))
      .mockResolvedValueOnce(response(draft))
      .mockResolvedValueOnce(response([release]))
      .mockResolvedValueOnce(response(release));

    await provisioningReleasesApi.listDrafts(signal);
    await provisioningReleasesApi.getDraft(DRAFT_ID, signal);
    await provisioningReleasesApi.listReleases(signal);
    await provisioningReleasesApi.getRelease(RELEASE_ID, signal);

    expect(getMock.mock.calls).toEqual([
      ["/api/admin/core/v1/provisioning/release-drafts", { cache: "no-store", signal }],
      [`/api/admin/core/v1/provisioning/release-drafts/${DRAFT_ID}`, { cache: "no-store", signal }],
      ["/api/admin/core/v1/provisioning/releases", { cache: "no-store", signal }],
      [`/api/admin/core/v1/provisioning/releases/${RELEASE_ID}`, { cache: "no-store", signal }],
    ]);
  });

  it("calls all five exact write-sensitive routes with a caller-owned UUIDv7", async () => {
    const config = { headers: { "x-idempotency-key": COMMAND_ID } };
    const createDto = {
      componentId: COMPONENT_ID,
      releaseVersion: "2.1.0",
      manifestVersion: 2,
      contractVersion: 1,
      runtimeBuildSha: "abcdef1",
      schemaTarget: "core_v2",
      manifestPayload: definition.manifestPayload,
      compatibility: definition.compatibility,
      riskLevel: "LOW" as const,
      selfServiceAllowed: false,
      requiresBackup: true,
      requiresMaintenance: false,
    };
    const updateDto = { ...createDto, expectedRevision: 1 };
    const validateDto = {
      expectedRevision: 1,
      expectedManifestChecksum: SHA,
      publisherKeyId: KEY_ID,
    };
    const publishDto = {
      ...validateDto,
      expectedSigningDigest: SHA,
      signatureAlgorithm: "Ed25519" as const,
      signatureBase64: SIGNATURE,
    };
    const retireDto = {
      expectedManifestChecksum: SHA,
      reasonCode: "SUPERSEDED_RELEASE",
    };
    postMock
      .mockResolvedValueOnce(response(draft))
      .mockResolvedValueOnce(
        response({
          publisherKeyId: KEY_ID,
          draftId: DRAFT_ID,
          revision: 2,
          manifestChecksum: SHA,
          signingDigest: SHA,
          payloadBase64: "e30=",
          algorithm: "Ed25519",
        }),
      )
      .mockResolvedValueOnce(response(release))
      .mockResolvedValueOnce(response({ ...release, status: "RETIRED", retiredAt: TIMESTAMP, retirementReasonCode: "SUPERSEDED_RELEASE" }));
    patchMock.mockResolvedValue(response(draft));

    await provisioningReleasesApi.createDraft(createDto, COMMAND_ID);
    await provisioningReleasesApi.updateDraft(DRAFT_ID, updateDto, COMMAND_ID);
    await provisioningReleasesApi.validateDraft(DRAFT_ID, validateDto, COMMAND_ID);
    await provisioningReleasesApi.publishDraft(DRAFT_ID, publishDto, COMMAND_ID);
    await provisioningReleasesApi.retireRelease(RELEASE_ID, retireDto, COMMAND_ID);

    expect(patchMock).toHaveBeenCalledWith(
      `/api/admin/core/v1/provisioning/release-drafts/${DRAFT_ID}`,
      updateDto,
      config,
    );
    expect(postMock.mock.calls).toEqual([
      ["/api/admin/core/v1/provisioning/release-drafts", createDto, config],
      [`/api/admin/core/v1/provisioning/release-drafts/${DRAFT_ID}/validate`, validateDto, config],
      [`/api/admin/core/v1/provisioning/release-drafts/${DRAFT_ID}/publish`, publishDto, config],
      [`/api/admin/core/v1/provisioning/releases/${RELEASE_ID}/retire`, retireDto, config],
    ]);
  });

  it("fails before transport for invalid resource and command identities", async () => {
    await expect(provisioningReleasesApi.getDraft("bad-id")).rejects.toThrow(
      "INVALID_PROVISIONING_RELEASE_ID",
    );
    await expect(
      provisioningReleasesApi.createDraft(
        {
          componentId: COMPONENT_ID,
          releaseVersion: "1",
          manifestVersion: 1,
          contractVersion: 1,
          runtimeBuildSha: "abcdef1",
          schemaTarget: "core",
          manifestPayload: {},
          compatibility: {},
          riskLevel: "LOW",
          selfServiceAllowed: false,
          requiresBackup: false,
          requiresMaintenance: false,
        },
        "bad-key",
      ),
    ).rejects.toThrow("INVALID_PROVISIONING_RELEASE_IDEMPOTENCY_KEY");
    expect(getMock).not.toHaveBeenCalled();
    expect(postMock).not.toHaveBeenCalled();
  });
});

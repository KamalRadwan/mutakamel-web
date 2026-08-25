// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CoreSnapshot,
  ProvisioningRelease,
  ReleaseDraft,
  ReleaseValidation,
} from "../types/provisioning-releases";

const {
  authMock,
  listDraftsMock,
  listReleasesMock,
  getDraftMock,
  updateDraftMock,
  validateDraftMock,
  publishDraftMock,
  getReleaseMock,
  retireReleaseMock,
} = vi.hoisted(() => ({
  authMock: {
    user: {
      isSuperAdmin: false,
      permissions: [
        "admin.provisioning.releases.read",
        "admin.provisioning.releases.publish",
        "admin.provisioning.releases.retire",
        "admin.provisioning.critical",
      ],
    } as { isSuperAdmin: boolean; permissions: string[] } | null,
    isLoading: false,
  },
  listDraftsMock: vi.fn(),
  listReleasesMock: vi.fn(),
  getDraftMock: vi.fn(),
  updateDraftMock: vi.fn(),
  validateDraftMock: vi.fn(),
  publishDraftMock: vi.fn(),
  getReleaseMock: vi.fn(),
  retireReleaseMock: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("../api/provisioning-releases-api", () => ({
  provisioningReleasesApi: {
    listDrafts: listDraftsMock,
    listReleases: listReleasesMock,
    getDraft: getDraftMock,
    updateDraft: updateDraftMock,
    validateDraft: validateDraftMock,
    publishDraft: publishDraftMock,
    getRelease: getReleaseMock,
    retireRelease: retireReleaseMock,
  },
}));

import { useReleaseDraftDetail } from "./use-release-draft-detail";
import { useReleaseDetail } from "./use-release-detail";
import { useReleaseIndex } from "./use-release-index";

const DRAFT_ID = "019f0000-0000-7000-8000-000000000001";
const RELEASE_ID = "019f0000-0000-7000-8000-000000000002";
const COMPONENT_ID = "019f0000-0000-7000-8000-000000000003";
const PUBLISHER_ID = "019f0000-0000-7000-8000-000000000004";
const TIMESTAMP = "2026-08-12T08:00:00.000Z";
const SHA = "a".repeat(64);
const SIGNATURE = `${"A".repeat(86)}==`;

function snapshot<T>(data: T, correlationId = "corr-release"): CoreSnapshot<T> {
  return { data, correlationId, responseTimestamp: TIMESTAMP };
}

function releaseDraft(status: ReleaseDraft["status"] = "DRAFT"): ReleaseDraft {
  return {
    draftId: DRAFT_ID,
    componentId: COMPONENT_ID,
    releaseVersion: "2.0.0",
    manifestVersion: 2,
    contractVersion: 1,
    runtimeBuildSha: "abcdef1",
    schemaTarget: "core:v2",
    schemaChecksum: null,
    manifestChecksum: SHA,
    manifestPayload: {
      componentKey: "core.foundation",
      contractVersion: 1,
      schemaTarget: "core:v2",
      seedPacks: [],
    },
    compatibility: { contractVersion: 1, requiredComponents: {} },
    riskLevel: "LOW",
    selfServiceAllowed: false,
    requiresBackup: true,
    requiresMaintenance: false,
    revision: status === "DRAFT" ? 1 : status === "VALIDATED" ? 2 : 3,
    status,
    publisherKeyId: status === "DRAFT" ? null : PUBLISHER_ID,
    signingDigest: status === "DRAFT" ? null : SHA,
    validatedAt: status === "DRAFT" ? null : TIMESTAMP,
    publishedReleaseId: status === "PUBLISHED" ? RELEASE_ID : null,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function release(status: ProvisioningRelease["status"] = "PUBLISHED"): ProvisioningRelease {
  return {
    releaseId: RELEASE_ID,
    componentId: COMPONENT_ID,
    releaseVersion: "2.0.0",
    manifestVersion: 2,
    contractVersion: 1,
    runtimeBuildSha: "abcdef1",
    schemaTarget: "core:v2",
    schemaChecksum: null,
    manifestChecksum: SHA,
    manifestPayload: releaseDraft().manifestPayload,
    compatibility: releaseDraft().compatibility,
    riskLevel: "LOW",
    selfServiceAllowed: false,
    requiresBackup: true,
    requiresMaintenance: false,
    status,
    publicationSource: "SIGNED_API",
    publisherKeyId: PUBLISHER_ID,
    signatureAlgorithm: "Ed25519",
    signatureBase64: SIGNATURE,
    signedPayloadDigest: SHA,
    publishedAt: TIMESTAMP,
    retiredAt: status === "RETIRED" ? TIMESTAMP : null,
    retirementReasonCode: status === "RETIRED" ? "SUPERSEDED_RELEASE" : null,
  };
}

describe("release-governance hooks", () => {
  beforeEach(() => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: [
        "admin.provisioning.releases.read",
        "admin.provisioning.releases.publish",
        "admin.provisioning.releases.retire",
        "admin.provisioning.critical",
      ],
    };
    authMock.isLoading = false;
    listDraftsMock.mockReset().mockResolvedValue(snapshot([]));
    listReleasesMock.mockReset().mockResolvedValue(snapshot([]));
    getDraftMock.mockReset().mockResolvedValue(snapshot(releaseDraft()));
    updateDraftMock.mockReset();
    validateDraftMock.mockReset();
    publishDraftMock.mockReset();
    getReleaseMock.mockReset().mockResolvedValue(snapshot(release()));
    retireReleaseMock.mockReset();
  });

  it("fails closed at the list permission gate without either read call", async () => {
    authMock.user = { isSuperAdmin: false, permissions: [] };
    const { result } = renderHook(() => useReleaseIndex());
    await waitFor(() => expect(result.current.state).toBe("FORBIDDEN"));
    expect(listDraftsMock).not.toHaveBeenCalled();
    expect(listReleasesMock).not.toHaveBeenCalled();
  });

  it("validates, exposes Core signing evidence, and reuses publish identity after an ambiguous failure", async () => {
    const validation: ReleaseValidation = {
      publisherKeyId: PUBLISHER_ID,
      draftId: DRAFT_ID,
      revision: 2,
      manifestChecksum: SHA,
      signingDigest: SHA,
      payloadBase64: "e30=",
      algorithm: "Ed25519",
    };
    validateDraftMock.mockResolvedValue(snapshot(validation, "corr-validation"));
    getDraftMock
      .mockResolvedValueOnce(snapshot(releaseDraft("DRAFT")))
      .mockResolvedValue(snapshot(releaseDraft("VALIDATED")));
    publishDraftMock
      .mockRejectedValueOnce({
        isNormalized: true,
        httpStatus: 503,
        errorCode: "CORE_UPSTREAM_UNAVAILABLE",
        message: "Outcome unknown",
        correlationId: "corr-ambiguous",
      })
      .mockResolvedValueOnce(snapshot(release(), "corr-published"));
    const { result } = renderHook(() => useReleaseDraftDetail(DRAFT_ID));
    await waitFor(() => expect(result.current.state).toBe("READY"));

    act(() => result.current.setPublisherKeyId(PUBLISHER_ID));
    await act(async () => {
      await result.current.validateDraft();
    });
    await waitFor(() => expect(result.current.signingEvidence.phase).toBe("VERIFIED"));
    expect(validateDraftMock.mock.calls[0][1]).toEqual({
      expectedRevision: 1,
      expectedManifestChecksum: SHA,
      publisherKeyId: PUBLISHER_ID,
    });
    expect(validateDraftMock.mock.calls[0][2]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    act(() => {
      result.current.updatePublishDraft("signatureBase64", SIGNATURE);
      result.current.updatePublishDraft("confirmed", true);
    });
    await act(async () => {
      await result.current.publish();
    });
    await waitFor(() => expect(result.current.mutation.phase).toBe("UNAVAILABLE"));
    await act(async () => {
      await result.current.publish();
    });
    await waitFor(() => expect(result.current.published?.data.releaseId).toBe(RELEASE_ID));

    expect(publishDraftMock).toHaveBeenCalledTimes(2);
    expect(publishDraftMock.mock.calls[0][1]).toEqual({
      expectedRevision: 2,
      expectedManifestChecksum: SHA,
      publisherKeyId: PUBLISHER_ID,
      expectedSigningDigest: SHA,
      signatureAlgorithm: "Ed25519",
      signatureBase64: SIGNATURE,
    });
    expect(publishDraftMock.mock.calls[1][2]).toBe(publishDraftMock.mock.calls[0][2]);
  });

  it("keeps critical publish unavailable with only the non-critical publish permission", async () => {
    authMock.user = {
      isSuperAdmin: false,
      permissions: [
        "admin.provisioning.releases.read",
        "admin.provisioning.releases.publish",
      ],
    };
    getDraftMock.mockResolvedValue(snapshot(releaseDraft("VALIDATED")));
    const { result } = renderHook(() => useReleaseDraftDetail(DRAFT_ID));
    await waitFor(() => expect(result.current.state).toBe("READY"));
    expect(result.current.permissions.canManageDrafts).toBe(true);
    expect(result.current.permissions.canPublishCritical).toBe(false);
    expect(result.current.canPublish).toBe(false);
  });

  it("keeps edited definition fields local and blocks validation until they are saved", async () => {
    getDraftMock.mockResolvedValue(snapshot(releaseDraft("DRAFT")));
    const { result } = renderHook(() => useReleaseDraftDetail(DRAFT_ID));
    await waitFor(() => expect(result.current.state).toBe("READY"));

    act(() => {
      result.current.updateDefinition("releaseVersion", "2.0.1");
      result.current.setPublisherKeyId(PUBLISHER_ID);
    });
    expect(result.current.definitionDirty).toBe(true);
    expect(result.current.canValidate).toBe(false);

    await act(async () => {
      await result.current.validateDraft();
    });
    expect(validateDraftMock).not.toHaveBeenCalled();

    act(() => result.current.refresh());
    await waitFor(() => expect(getDraftMock).toHaveBeenCalledTimes(2));
    expect(result.current.definition.releaseVersion).toBe("2.0.1");
    expect(result.current.definitionDirty).toBe(true);
  });

  it("retires with exact checksum/reason fences and reuses identity after 503", async () => {
    retireReleaseMock
      .mockRejectedValueOnce({
        isNormalized: true,
        httpStatus: 503,
        errorCode: "CORE_DOWN",
        message: "Unknown outcome",
      })
      .mockResolvedValueOnce(snapshot(release("RETIRED")));
    const { result } = renderHook(() => useReleaseDetail(RELEASE_ID));
    await waitFor(() => expect(result.current.state).toBe("READY"));
    act(() => {
      result.current.updateRetireDraft("reasonCode", "SUPERSEDED_RELEASE");
      result.current.updateRetireDraft("confirmed", true);
    });
    await act(async () => {
      await result.current.retire();
    });
    await waitFor(() => expect(result.current.mutation.phase).toBe("UNAVAILABLE"));
    await act(async () => {
      await result.current.retire();
    });
    expect(retireReleaseMock.mock.calls[0][1]).toEqual({
      expectedManifestChecksum: SHA,
      reasonCode: "SUPERSEDED_RELEASE",
    });
    expect(retireReleaseMock.mock.calls[1][2]).toBe(retireReleaseMock.mock.calls[0][2]);
    await waitFor(() => expect(result.current.snapshot?.data.status).toBe("RETIRED"));
  });
});

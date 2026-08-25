import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock("@/lib/api/axiosClient", () => ({
  axiosClient: { get: getMock, post: postMock },
}));

import { provisioningFleetApi } from "./api";

const ROOT = "/api/admin/core/v1/provisioning";
const PREVIEW_ID = "019f0000-0000-7000-8000-000000000001";
const ROLLOUT_ID = "019f0000-0000-7000-8000-000000000002";
const KEY = "019f0000-0000-7000-8000-000000000003";
const DIGEST = "a".repeat(64);

describe("provisioning fleet API", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("makes every one of the six exact read routes", async () => {
    getMock
      .mockResolvedValueOnce({ data: envelope([]) })
      .mockResolvedValueOnce({ data: envelope(previewFixture()) })
      .mockResolvedValueOnce({ data: envelope({ data: [], meta: { page: 1, limit: 50, total: 0 } }) })
      .mockResolvedValueOnce({ data: envelope(rolloutFixture()) })
      .mockResolvedValueOnce({ data: envelope({ data: [], meta: { page: 1, limit: 50, total: 0 } }) })
      .mockResolvedValueOnce({ data: envelope(reportFixture()) });
    const signal = new AbortController().signal;

    await provisioningFleetApi.listRollouts(signal);
    await provisioningFleetApi.getPreview(PREVIEW_ID, signal);
    await provisioningFleetApi.listPreviewTenants(PREVIEW_ID, 1, 50, signal);
    await provisioningFleetApi.getRollout(ROLLOUT_ID, signal);
    await provisioningFleetApi.listRolloutTenants(ROLLOUT_ID, 1, 50, signal);
    await provisioningFleetApi.getReport(ROLLOUT_ID, signal);

    expect(getMock.mock.calls.map(([url]) => url)).toEqual([
      `${ROOT}/fleet-rollouts`,
      `${ROOT}/fleet-rollout-previews/${PREVIEW_ID}`,
      `${ROOT}/fleet-rollout-previews/${PREVIEW_ID}/tenants?page=1&limit=50`,
      `${ROOT}/fleet-rollouts/${ROLLOUT_ID}`,
      `${ROOT}/fleet-rollouts/${ROLLOUT_ID}/tenants?page=1&limit=50`,
      `${ROOT}/fleet-rollouts/${ROLLOUT_ID}/report`,
    ]);
    for (const [, config] of getMock.mock.calls) {
      expect(config).toEqual({ cache: "no-store", signal });
    }
  });

  it("makes all six exact sensitive write routes with caller-owned keys and no transport retry", async () => {
    postMock.mockImplementation((url: string) => Promise.resolve({
      data: envelope(url.endsWith("/report/attest") ? reportFixture() : url.includes("fleet-rollout-previews") ? previewFixture() : rolloutFixture()),
    }));
    const previewCommand = {
      operationType: "UPDATE" as const,
      targetSelection: [targetFixture()],
      selectionFilter: { tenantIds: [PREVIEW_ID] },
    };
    const rolloutCommand = {
      previewId: PREVIEW_ID,
      expectedSelectionDigest: DIGEST,
      canarySize: 1,
      batchSize: 5,
      maxParallel: 1,
      failureThreshold: 1,
    };
    const manageCommand = { expectedRevision: 2, reasonCode: "OPS.CHANGE" };

    await provisioningFleetApi.createPreview(previewCommand, KEY);
    await provisioningFleetApi.createRollout(rolloutCommand, KEY);
    await provisioningFleetApi.manageRollout(ROLLOUT_ID, "pause", manageCommand, KEY);
    await provisioningFleetApi.manageRollout(ROLLOUT_ID, "resume", manageCommand, KEY);
    await provisioningFleetApi.manageRollout(ROLLOUT_ID, "cancel", manageCommand, KEY);
    await provisioningFleetApi.attestReport(ROLLOUT_ID, {
      expectedRevision: 3,
      publisherKeyId: PREVIEW_ID,
      signatureAlgorithm: "Ed25519",
      signatureBase64: `${"A".repeat(86)}==`,
    }, KEY);

    expect(postMock.mock.calls.map(([url]) => url)).toEqual([
      `${ROOT}/fleet-rollout-previews`,
      `${ROOT}/fleet-rollouts`,
      `${ROOT}/fleet-rollouts/${ROLLOUT_ID}/pause`,
      `${ROOT}/fleet-rollouts/${ROLLOUT_ID}/resume`,
      `${ROOT}/fleet-rollouts/${ROLLOUT_ID}/cancel`,
      `${ROOT}/fleet-rollouts/${ROLLOUT_ID}/report/attest`,
    ]);
    for (const [, , config] of postMock.mock.calls) {
      expect(config).toEqual({
        cache: "no-store",
        headers: { "x-idempotency-key": KEY },
        replayAfterRefresh: true,
        skipAutoIdempotency: true,
      });
    }
  });

  it("rejects invalid route ids and pages before transport", async () => {
    await expect(provisioningFleetApi.getPreview("bad-id")).rejects.toThrow(
      "INVALID_FLEET_PREVIEW_ID",
    );
    await expect(
      provisioningFleetApi.listRolloutTenants(ROLLOUT_ID, 0, 201),
    ).rejects.toThrow("INVALID_FLEET_PAGE_QUERY");
    expect(getMock).not.toHaveBeenCalled();
  });
});

function targetFixture() {
  return {
    componentKey: "accounts",
    componentId: PREVIEW_ID,
    targetReleaseId: KEY,
    targetReleaseVersion: "1.2.3",
    targetManifestChecksum: DIGEST,
    expectedCurrentReleaseId: ROLLOUT_ID,
    expectedCurrentManifestChecksum: DIGEST,
  };
}

function previewFixture() {
  return {
    previewId: PREVIEW_ID,
    operationType: "UPDATE",
    operationCommand: {},
    targetSelection: [targetFixture()],
    targetSelectionDigest: DIGEST,
    selectionFilter: { tenantIds: [PREVIEW_ID] },
    selectionDigest: DIGEST,
    eligibleCount: 5,
    ineligibleCount: 0,
    expiresAt: "2026-08-12T10:30:00.000Z",
    createdAt: "2026-08-12T10:00:00.000Z",
  };
}

function rolloutFixture() {
  return {
    rolloutId: ROLLOUT_ID,
    previewId: PREVIEW_ID,
    operationType: "UPDATE",
    operationCommand: {},
    targetSelection: [targetFixture()],
    targetSelectionDigest: DIGEST,
    selectionDigest: DIGEST,
    status: "RUNNING",
    canarySize: 1,
    batchSize: 5,
    maxParallel: 1,
    failureThreshold: 1,
    totalCount: 5,
    completedCount: 0,
    failedCount: 0,
    currentBatch: 1,
    revision: 2,
    safeReasonCode: null,
    startedAt: "2026-08-12T10:01:00.000Z",
    pausedAt: null,
    completedAt: null,
    createdAt: "2026-08-12T10:00:00.000Z",
  };
}

function reportFixture() {
  return {
    rolloutId: ROLLOUT_ID,
    revision: 3,
    status: "READY_FOR_ATTESTATION",
    payloadBase64: "YWJj",
    signingDigest: DIGEST,
    reportDigest: DIGEST,
    generatedAt: "2026-08-12T11:00:00.000Z",
    publisherKeyId: null,
    signatureAlgorithm: null,
    signatureBase64: null,
    attestedAt: null,
    attestedByActorRef: null,
  };
}

function envelope(data: unknown) {
  return {
    success: true,
    data,
    correlationId: "fleet-api-test",
    timestamp: "2026-08-12T10:00:00.000Z",
  };
}


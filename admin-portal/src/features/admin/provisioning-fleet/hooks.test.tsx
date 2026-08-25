// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, authMock, uuidMock } = vi.hoisted(() => ({
  apiMock: {
    listRollouts: vi.fn(),
    createPreview: vi.fn(),
    getPreview: vi.fn(),
    listPreviewTenants: vi.fn(),
    createRollout: vi.fn(),
    getRollout: vi.fn(),
    listRolloutTenants: vi.fn(),
    manageRollout: vi.fn(),
    getReport: vi.fn(),
    attestReport: vi.fn(),
  },
  authMock: {
    user: {
      id: "019f0000-0000-7000-8000-000000000010",
      isSuperAdmin: false,
      permissions: [
        "admin.provisioning.rollouts.read",
        "admin.provisioning.rollouts.create",
        "admin.provisioning.rollouts.manage",
        "admin.provisioning.rollouts.report",
        "admin.provisioning.critical",
      ],
    } as { id: string; isSuperAdmin: boolean; permissions: string[] } | null,
    isLoading: false,
  },
  uuidMock: vi.fn(() => "019f0000-0000-7000-8000-000000000099"),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => authMock }));
vi.mock("@/lib/utils/uuid", () => ({ generateUUIDv7: uuidMock }));
vi.mock("./api", () => ({ provisioningFleetApi: apiMock }));

import {
  useFleetDirectory,
  useFleetPreview,
  useFleetRollout,
} from "./hooks";

const PREVIEW_ID = "019f0000-0000-7000-8000-000000000001";
const ROLLOUT_ID = "019f0000-0000-7000-8000-000000000002";
const DIGEST = "a".repeat(64);

describe("provisioning fleet hooks", () => {
  beforeEach(() => {
    authMock.user = fullActor();
    authMock.isLoading = false;
    uuidMock.mockClear();
    for (const fn of Object.values(apiMock)) fn.mockReset();
    apiMock.listRollouts.mockResolvedValue(result([]));
    apiMock.getPreview.mockResolvedValue(result(previewFixture()));
    apiMock.listPreviewTenants.mockResolvedValue(pageResult([]));
    apiMock.getRollout.mockResolvedValue(result(rolloutFixture()));
    apiMock.listRolloutTenants.mockResolvedValue(pageResult([]));
    apiMock.getReport.mockResolvedValue(result(reportFixture()));
    apiMock.createPreview.mockResolvedValue(result(previewFixture()));
    apiMock.createRollout.mockResolvedValue(result(rolloutFixture()));
    apiMock.manageRollout.mockResolvedValue(result({ ...rolloutFixture(), status: "PAUSED", pausedAt: "2026-08-12T10:10:00.000Z", revision: 3 }));
    apiMock.attestReport.mockResolvedValue(result({ ...reportFixture(), status: "ATTESTED" }));
  });

  it("fails closed and makes no fleet call without read permission", async () => {
    authMock.user = { ...fullActor(), permissions: [] };
    const { result: directory } = renderHook(() => useFleetDirectory());
    const { result: preview } = renderHook(() => useFleetPreview(PREVIEW_ID));

    await waitFor(() => expect(directory.current.rollouts.state).toBe("FORBIDDEN"));
    await waitFor(() => expect(preview.current.preview.state).toBe("FORBIDDEN"));
    expect(apiMock.listRollouts).not.toHaveBeenCalled();
    expect(apiMock.getPreview).not.toHaveBeenCalled();

    await act(async () => {
      await directory.current.createPreview(previewCommand());
    });
    expect(apiMock.createPreview).not.toHaveBeenCalled();
    expect(directory.current.previewCommand.state).toBe("FORBIDDEN");
  });

  it("loads preview detail and paged tenant evidence with canonical query ownership", async () => {
    const { result: hook } = renderHook(() => useFleetPreview(PREVIEW_ID));

    await waitFor(() => expect(hook.current.preview.state).toBe("READY"));
    expect(apiMock.getPreview).toHaveBeenCalledWith(PREVIEW_ID, expect.any(AbortSignal));
    expect(apiMock.listPreviewTenants).toHaveBeenCalledWith(
      PREVIEW_ID,
      1,
      50,
      expect.any(AbortSignal),
    );
    expect(hook.current.tenants.state).toBe("EMPTY");
  });

  it("retries an ambiguous preview command with the exact frozen body and UUIDv7 key", async () => {
    apiMock.createPreview
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(result(previewFixture()));
    const { result: hook } = renderHook(() => useFleetDirectory());
    await waitFor(() => expect(hook.current.rollouts.state).toBe("EMPTY"));
    const command = previewCommand();

    await act(async () => {
      await hook.current.createPreview(command);
    });
    expect(hook.current.previewCommand.state).toBe("AMBIGUOUS");
    expect(hook.current.previewCommand.exactRetryAvailable).toBe(true);
    command.selectionFilter.tenantIds[0] = ROLLOUT_ID;

    await act(async () => {
      await hook.current.retryPreviewExact();
    });
    expect(apiMock.createPreview).toHaveBeenCalledTimes(2);
    expect(apiMock.createPreview.mock.calls[0]).toEqual(apiMock.createPreview.mock.calls[1]);
    expect(apiMock.createPreview.mock.calls[1][0].selectionFilter.tenantIds).toEqual([PREVIEW_ID]);
    expect(uuidMock).toHaveBeenCalledTimes(1);
  });

  it("preflights ALL critical permissions and only exposes lifecycle routes valid for state", async () => {
    authMock.user = {
      ...fullActor(),
      permissions: [
        "admin.provisioning.rollouts.read",
        "admin.provisioning.rollouts.manage",
        "admin.provisioning.rollouts.report",
      ],
    };
    const { result: hook } = renderHook(() => useFleetRollout(ROLLOUT_ID));
    await waitFor(() => expect(hook.current.rollout.state).toBe("READY"));

    await act(async () => {
      await hook.current.manage("pause", {
        expectedRevision: 2,
        reasonCode: "OPS.CHANGE",
      });
      await hook.current.attest({
        expectedRevision: 3,
        publisherKeyId: PREVIEW_ID,
        signatureAlgorithm: "Ed25519",
        signatureBase64: `${"A".repeat(86)}==`,
      });
    });
    expect(apiMock.manageRollout).not.toHaveBeenCalled();
    expect(apiMock.attestReport).not.toHaveBeenCalled();
    expect(hook.current.permissions.canManage).toBe(false);
    expect(hook.current.permissions.canAttest).toBe(false);
  });

  it("keeps report access independent from rollout-read permission", async () => {
    authMock.user = {
      ...fullActor(),
      permissions: ["admin.provisioning.rollouts.report"],
    };
    const { result: hook } = renderHook(() => useFleetRollout(ROLLOUT_ID));

    await waitFor(() => expect(hook.current.rollout.state).toBe("FORBIDDEN"));
    await waitFor(() => expect(hook.current.report.state).toBe("READY"));
    expect(apiMock.getRollout).not.toHaveBeenCalled();
    expect(apiMock.getReport).toHaveBeenCalledWith(
      ROLLOUT_ID,
      expect.any(AbortSignal),
    );
  });

  it("uses each lifecycle endpoint with the authoritative revision command", async () => {
    const { result: hook } = renderHook(() => useFleetRollout(ROLLOUT_ID));
    await waitFor(() => expect(hook.current.rollout.state).toBe("READY"));

    await act(async () => {
      await hook.current.manage("pause", {
        expectedRevision: 2,
        reasonCode: "OPS.CHANGE",
      });
    });
    expect(apiMock.manageRollout).toHaveBeenCalledWith(
      ROLLOUT_ID,
      "pause",
      { expectedRevision: 2, reasonCode: "OPS.CHANGE" },
      "019f0000-0000-7000-8000-000000000099",
    );
  });
});

function fullActor() {
  return {
    id: "019f0000-0000-7000-8000-000000000010",
    isSuperAdmin: false,
    permissions: [
      "admin.provisioning.rollouts.read",
      "admin.provisioning.rollouts.create",
      "admin.provisioning.rollouts.manage",
      "admin.provisioning.rollouts.report",
      "admin.provisioning.critical",
    ],
  };
}

function previewCommand() {
  return {
    operationType: "UPDATE" as const,
    targetSelection: [targetFixture()],
    selectionFilter: { tenantIds: [PREVIEW_ID] },
  };
}

function targetFixture() {
  return {
    componentKey: "accounts",
    componentId: PREVIEW_ID,
    targetReleaseId: ROLLOUT_ID,
    targetReleaseVersion: "1.2.3",
    targetManifestChecksum: DIGEST,
    expectedCurrentReleaseId: PREVIEW_ID,
    expectedCurrentManifestChecksum: DIGEST,
  };
}

function previewFixture() {
  return {
    previewId: PREVIEW_ID,
    operationType: "UPDATE" as const,
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
    operationType: "UPDATE" as const,
    operationCommand: {},
    targetSelection: [targetFixture()],
    targetSelectionDigest: DIGEST,
    selectionDigest: DIGEST,
    status: "RUNNING" as const,
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
    status: "READY_FOR_ATTESTATION" as const,
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

function result<T>(data: T) {
  return {
    data,
    correlationId: "fleet-hook-test",
    timestamp: "2026-08-12T10:00:00.000Z",
  };
}

function pageResult<T>(items: T[]) {
  return {
    items,
    page: 1,
    limit: 50,
    total: items.length,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrev: false,
    correlationId: "fleet-page-test",
    timestamp: "2026-08-12T10:00:00.000Z",
  };
}

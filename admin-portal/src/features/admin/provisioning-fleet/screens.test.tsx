// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { directoryMock, previewMock, rolloutMock } = vi.hoisted(() => ({
  directoryMock: vi.fn(),
  previewMock: vi.fn(),
  rolloutMock: vi.fn(),
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ lang: "en", dir: "ltr" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./hooks", () => ({
  useFleetDirectory: directoryMock,
  useFleetPreview: previewMock,
  useFleetRollout: rolloutMock,
}));

import { FleetDirectoryScreen } from "./FleetDirectoryScreen";
import { FleetPreviewScreen } from "./FleetPreviewScreen";
import { FleetRolloutScreen } from "./FleetRolloutScreen";
import { getProvisioningFleetCopy } from "./copy";

const PREVIEW_ID = "019f0000-0000-7000-8000-000000000001";
const ROLLOUT_ID = "019f0000-0000-7000-8000-000000000002";
const KEY_ID = "019f0000-0000-7000-8000-000000000003";
const DIGEST = "a".repeat(64);

describe("provisioning fleet screens", () => {
  beforeEach(() => {
    directoryMock.mockReset().mockReturnValue(directoryView());
    previewMock.mockReset().mockReturnValue(previewView());
    rolloutMock.mockReset().mockReturnValue(rolloutView());
  });

  it("makes every decommission preview field and broad-selection confirmation reachable", async () => {
    const view = directoryView();
    directoryMock.mockReturnValue(view);
    render(<FleetDirectoryScreen />);

    // Radix Select opens on click (its onClick handler runs handleOpen()
    // whenever the pointer type wasn't tracked as "mouse", which is always
    // true for a plain fireEvent.click) and its portaled options render
    // with role="option" - fireEvent.change against a native <select> no
    // longer applies now that this field is a design-system Select.
    fireEvent.click(screen.getByRole("combobox", { name: "Operation type" }));
    fireEvent.click(screen.getByRole("option", { name: "Decommission component" }));
    fireEvent.change(screen.getByLabelText("Component key"), {
      target: { value: "voice.media" },
    });
    fireEvent.click(screen.getByLabelText(/retained tenant data/i));
    fireEvent.click(screen.getByLabelText("All eligible tenants"));
    fireEvent.click(screen.getByLabelText(/broad selection may affect/i));
    fireEvent.click(screen.getByRole("button", { name: "Create preview" }));

    expect(screen.getByRole("alertdialog", {
      name: "Create this immutable preview?",
    })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(view.createPreview).toHaveBeenCalledWith({
      operationType: "DECOMMISSION",
      componentKey: "voice.media",
      retentionAcknowledged: true,
      selectionFilter: {
        allEligibleTenantsAcknowledged: true,
        tenantStatuses: ["ACTIVE", "SUSPENDED"],
      },
    }));
  });

  it("renders frozen evidence and confirmation-gates the exact rollout DTO", async () => {
    const view = previewView();
    previewMock.mockReturnValue(view);
    render(<FleetPreviewScreen previewId={PREVIEW_ID} />);

    expect(screen.getAllByText(PREVIEW_ID).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Tenant evidence" })).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Fleet preview tenant evidence" }),
    ).toHaveAttribute("tabindex", "0");
    fireEvent.click(screen.getByRole("button", { name: "Launch rollout" }));
    expect(screen.getByRole("alertdialog", {
      name: "Launch this critical rollout?",
    })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(view.createRollout).toHaveBeenCalledWith({
      previewId: PREVIEW_ID,
      expectedSelectionDigest: DIGEST,
      canarySize: 1,
      batchSize: 1,
      maxParallel: 1,
      failureThreshold: 1,
    }));
  });

  it("makes lifecycle and external attestation flows reachable behind confirmations", async () => {
    const view = rolloutView();
    rolloutMock.mockReturnValue(view);
    render(<FleetRolloutScreen rolloutId={ROLLOUT_ID} />);

    expect(
      screen.getByRole("region", { name: "Fleet rollout tenant evidence" }),
    ).toHaveAttribute("tabindex", "0");

    fireEvent.change(screen.getByLabelText("Stable reason code"), {
      target: { value: "OPS.MAINTENANCE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pause rollout" }));
    expect(screen.getByRole("alertdialog", {
      name: "Pause this rollout?",
    })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(view.manage).toHaveBeenCalledWith("pause", {
      expectedRevision: 2,
      reasonCode: "OPS.MAINTENANCE",
    }));

    fireEvent.change(screen.getByLabelText("Active publisher-key UUIDv7"), {
      target: { value: KEY_ID },
    });
    fireEvent.change(screen.getByLabelText(/^Ed25519 signature \(Base64\)/), {
      target: { value: `${"A".repeat(86)}==` },
    });
    fireEvent.click(screen.getByRole("button", { name: "Attest report" }));
    expect(screen.getByRole("alertdialog", {
      name: "Submit this external signature?",
    })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(view.attest).toHaveBeenCalledWith({
      expectedRevision: 3,
      publisherKeyId: KEY_ID,
      signatureAlgorithm: "Ed25519",
      signatureBase64: `${"A".repeat(86)}==`,
    }));
  });

  it("renders Arabic RTL solely from the feature-local bilingual dictionary", () => {
    const arabic = getProvisioningFleetCopy("ar");
    expect(arabic.title).toBe("أسطول التهيئة");
    expect(arabic.confirmAttestTitle).toContain("التوقيع");
    expect(arabic.validation.signature).toContain("Ed25519");
  });
});

function directoryView() {
  return {
    authLoading: false,
    permissions: {
      canRead: true,
      canCreatePreview: true,
      canCreateRollout: true,
      canManage: true,
      canReadReport: true,
      canAttest: true,
    },
    rollouts: {
      state: "READY",
      data: result([rolloutFixture()]),
      error: null,
      isRefreshing: false,
    },
    previewCommand: commandView(),
    createPreview: vi.fn().mockResolvedValue(result(previewFixture())),
    retryPreviewExact: vi.fn(),
    clearPreviewCommand: vi.fn(),
    refresh: vi.fn(),
  };
}

function previewView() {
  return {
    authLoading: false,
    routeValid: true,
    permissions: {
      canRead: true,
      canCreatePreview: true,
      canCreateRollout: true,
      canManage: true,
      canReadReport: true,
      canAttest: true,
    },
    preview: {
      state: "READY",
      data: result(previewFixture()),
      error: null,
      isRefreshing: false,
    },
    tenants: pageResult([previewTenantFixture()]),
    page: 1,
    setPage: vi.fn(),
    rolloutCommand: commandView(),
    createRollout: vi.fn().mockResolvedValue(result(rolloutFixture())),
    retryRolloutExact: vi.fn(),
    clearRolloutCommand: vi.fn(),
    refresh: vi.fn(),
  };
}

function rolloutView() {
  return {
    authLoading: false,
    routeValid: true,
    permissions: {
      canRead: true,
      canCreatePreview: true,
      canCreateRollout: true,
      canManage: true,
      canReadReport: true,
      canAttest: true,
    },
    rollout: {
      state: "READY",
      data: result(rolloutFixture()),
      error: null,
      isRefreshing: false,
    },
    tenants: pageResult([rolloutTenantFixture()]),
    report: {
      state: "READY",
      data: result(reportFixture()),
      error: null,
      isRefreshing: false,
    },
    page: 1,
    setPage: vi.fn(),
    manageCommand: commandView(),
    attestCommand: commandView(),
    manage: vi.fn().mockResolvedValue(result(rolloutFixture())),
    retryManageExact: vi.fn(),
    clearManageCommand: vi.fn(),
    attest: vi.fn().mockResolvedValue(result(reportFixture())),
    retryAttestExact: vi.fn(),
    clearAttestCommand: vi.fn(),
    refresh: vi.fn(),
  };
}

function commandView() {
  return {
    state: "IDLE",
    result: null,
    error: null,
    exactRetryAvailable: false,
    idempotencyKey: null,
  };
}

function targetFixture() {
  return {
    componentKey: "accounts",
    componentId: PREVIEW_ID,
    targetReleaseId: KEY_ID,
    targetReleaseVersion: "1.2.3",
    targetManifestChecksum: DIGEST,
    expectedCurrentReleaseId: ROLLOUT_ID,
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
    expiresAt: "2027-08-12T10:30:00.000Z",
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
    completedCount: 1,
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

function previewTenantFixture() {
  return {
    tenantId: PREVIEW_ID,
    eligible: true,
    deterministicRank: 1,
    safeReasonCode: null,
    eligibilityDigest: DIGEST,
  };
}

function rolloutTenantFixture() {
  return {
    tenantId: PREVIEW_ID,
    deterministicRank: 1,
    batchNumber: 1,
    status: "PENDING" as const,
    operationId: null,
    eligibilityDigest: DIGEST,
    evidenceDigest: null,
    safeReasonCode: null,
    dispatchedAt: null,
    completedAt: null,
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
    correlationId: "fleet-screen-test",
    timestamp: "2026-08-12T10:00:00.000Z",
  };
}

function pageResult<T>(items: T[]) {
  return {
    state: items.length ? "READY" : "EMPTY",
    data: {
      items,
      page: 1,
      limit: 50,
      total: items.length,
      totalPages: items.length ? 1 : 0,
      hasNext: false,
      hasPrev: false,
      correlationId: "fleet-screen-page-test",
      timestamp: "2026-08-12T10:00:00.000Z",
    },
    error: null,
    isRefreshing: false,
  };
}

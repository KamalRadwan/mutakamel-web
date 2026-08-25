import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAttestationCommand,
  buildManageCommand,
  buildPreviewCommand,
  buildRolloutCommand,
  initialPreviewDraft,
  ProvisioningFleetContractError,
  readPreviewEnvelope,
  readPreviewTenantPage,
  readReportEnvelope,
  readRolloutEnvelope,
} from "./contracts";

const ID = "019f0000-0000-7000-8000-000000000001";
const ID_2 = "019f0000-0000-7000-8000-000000000002";
const ID_3 = "019f0000-0000-7000-8000-000000000003";
const DIGEST = "a".repeat(64);
const NOW = "2026-08-12T10:00:00.000Z";

describe("provisioning fleet contracts", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("normalizes and sorts the exact UPDATE preview command", () => {
    const draft = initialPreviewDraft();
    draft.tenantIdsText = `${ID_2}\n${ID}`;
    draft.targets = [target("voice", ID_2), target("accounts", ID)];

    const result = buildPreviewCommand(draft);

    expect(result.errors).toEqual({});
    expect(result.command).toEqual({
      operationType: "UPDATE",
      targetSelection: [targetCommand("accounts", ID), targetCommand("voice", ID_2)],
      selectionFilter: {
        tenantIds: [ID, ID_2],
        tenantStatuses: ["ACTIVE", "SUSPENDED"],
      },
    });
  });

  it("enforces operation-specific payload and broad-selection acknowledgements", () => {
    const decommission = initialPreviewDraft();
    decommission.operationType = "DECOMMISSION";
    decommission.targets = [];
    decommission.componentKey = "voice.media";
    decommission.broadSelection = true;
    decommission.allEligibleTenantsAcknowledged = false;
    decommission.retentionAcknowledged = false;

    expect(buildPreviewCommand(decommission).errors).toMatchObject({
      retentionAcknowledged: "required",
      allEligibleTenantsAcknowledged: "required",
    });

    decommission.retentionAcknowledged = true;
    decommission.allEligibleTenantsAcknowledged = true;
    expect(buildPreviewCommand(decommission).command).toEqual({
      operationType: "DECOMMISSION",
      componentKey: "voice.media",
      retentionAcknowledged: true,
      selectionFilter: {
        allEligibleTenantsAcknowledged: true,
        tenantStatuses: ["ACTIVE", "SUSPENDED"],
      },
    });
  });

  it("enforces canary, eligible, parallel, revision, reason, and signature constraints", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T10:05:00.000Z"));
    const preview = previewFixture();
    expect(buildRolloutCommand(preview, {
      canarySize: "6",
      batchSize: "2",
      maxParallel: "3",
      failureThreshold: "6",
    }).errors).toMatchObject({
      canarySize: "eligibleBound",
      failureThreshold: "eligibleBound",
      maxParallel: "parallelBound",
    });
    expect(buildManageCommand({ expectedRevision: "0", reasonCode: "bad reason" }).errors)
      .toMatchObject({ expectedRevision: "range", reasonCode: "safeCode" });
    expect(buildAttestationCommand({
      expectedRevision: "4",
      publisherKeyId: ID_3,
      signatureBase64: "bad",
    }).errors.signatureBase64).toBe("signature");
    expect(buildAttestationCommand({
      expectedRevision: "4",
      publisherKeyId: ID_3,
      signatureBase64: `${"A".repeat(86)}==`,
    }).command).toEqual({
      expectedRevision: 4,
      publisherKeyId: ID_3,
      signatureAlgorithm: "Ed25519",
      signatureBase64: `${"A".repeat(86)}==`,
    });
  });

  it("strictly reads canonical preview, page, rollout, and report envelopes", () => {
    expect(readPreviewEnvelope(envelope(previewFixture())).data.previewId).toBe(ID);
    expect(readPreviewTenantPage(envelope({
      data: [{
        tenantId: ID,
        eligible: true,
        deterministicRank: 1,
        safeReasonCode: null,
        eligibilityDigest: DIGEST,
      }],
      meta: { page: 1, limit: 50, total: 1 },
    })).items).toHaveLength(1);
    expect(readRolloutEnvelope(envelope(rolloutFixture())).data.status).toBe("RUNNING");
    expect(readReportEnvelope(envelope(reportFixture())).data.status)
      .toBe("READY_FOR_ATTESTATION");
  });

  it("rejects unknown fields and impossible evidence invariants", () => {
    expect(() => readPreviewEnvelope(envelope({
      ...previewFixture(),
      unknown: true,
    }))).toThrow(ProvisioningFleetContractError);

    expect(() => readReportEnvelope(envelope({
      ...reportFixture(),
      status: "NOT_READY",
    }))).toThrow(ProvisioningFleetContractError);

    expect(() => readRolloutEnvelope(envelope({
      ...rolloutFixture(),
      status: "SUCCEEDED",
      completedAt: null,
    }))).toThrow(ProvisioningFleetContractError);
  });
});

function target(componentKey: string, componentId: string) {
  return {
    componentKey,
    componentId,
    targetReleaseId: ID_3,
    targetReleaseVersion: "1.2.3",
    targetManifestChecksum: DIGEST,
    expectedCurrentReleaseId: ID_2,
    expectedCurrentManifestChecksum: DIGEST,
  };
}

function targetCommand(componentKey: string, componentId: string) {
  return target(componentKey, componentId);
}

function previewFixture() {
  return {
    previewId: ID,
    operationType: "UPDATE" as const,
    operationCommand: {},
    targetSelection: [targetCommand("accounts", ID)],
    targetSelectionDigest: DIGEST,
    selectionFilter: {
      tenantIds: [ID],
      tenantStatuses: ["ACTIVE"] as ("ACTIVE" | "SUSPENDED")[],
    },
    selectionDigest: DIGEST,
    eligibleCount: 5,
    ineligibleCount: 1,
    expiresAt: "2026-08-12T10:30:00.000Z",
    createdAt: NOW,
  };
}

function rolloutFixture() {
  return {
    rolloutId: ID_2,
    previewId: ID,
    operationType: "UPDATE",
    operationCommand: {},
    targetSelection: [targetCommand("accounts", ID)],
    targetSelectionDigest: DIGEST,
    selectionDigest: DIGEST,
    status: "RUNNING",
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
    createdAt: NOW,
  };
}

function reportFixture() {
  return {
    rolloutId: ID_2,
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
    correlationId: "fleet-test-correlation",
    timestamp: NOW,
  };
}

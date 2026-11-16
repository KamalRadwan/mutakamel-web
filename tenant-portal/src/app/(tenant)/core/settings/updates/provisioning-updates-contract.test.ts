import { afterEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { resetWireLabelWarnings } from "@/lib/format/wire-label";
import {
  MAX_PROVISIONING_UPDATE_SELECTIONS,
  PROVISIONING_UPDATES_APPLY_PATH,
  PROVISIONING_UPDATES_PAGE_SIZE,
  PROVISIONING_UPDATES_PATH,
  TENANT_OPERATION_STATUSES,
  buildApplyProvisioningUpdatesRequest,
  buildProvisioningUpdatesQuery,
  canSelectAvailableUpdate,
  classifyUpdateEligibility,
  isTerminalOperationStatus,
  isValidComponentKeyFilter,
  provisioningOperationPath,
  type TenantAvailableUpdate,
} from "./provisioning-updates-contract";
import {
  extractAcceptedResponseOperationId,
  parseApplyProvisioningUpdatesResponse,
  parseProvisioningOperationView,
  parseProvisioningUpdatesPage,
} from "./provisioning-updates-parsers";
import {
  createApplyAttemptSnapshot,
  doesDiscoveryMatchSnapshotItem,
  doesDiscoveryReconcileAcceptedAttempt,
  hasSnapshotDiverged,
  isStaleApplyConflictError,
} from "./provisioning-updates-snapshot";
import {
  classifyOperationSurface,
  formatOperationGuidance,
  formatOperationPhaseLabel,
  formatOperationStatusLabel,
  formatOwnerAppLabel,
  formatRiskLabel,
  formatUpdateEligibility,
  operationTone,
} from "./updates-labels";

const CHECKSUM_A = "a".repeat(64);
const CHECKSUM_B = "b".repeat(64);

const sampleItem = {
  lastOperationId: "01902001-3000-7000-8000-000000000099",
  componentId: "01902001-3000-7000-8000-000000000010",
  componentKey: "core.workspace",
  ownerApp: "core",
  installationState: "OUTDATED",
  current: {
    releaseId: "01902001-3000-7000-8000-000000000011",
    releaseVersion: "1.14.0",
    schemaVersion: "2026.08",
    manifestChecksum: CHECKSUM_A,
  },
  desiredReleaseId: null,
  updateAlreadyPlanned: false,
  availableRelease: {
    id: "01902001-3000-7000-8000-000000000012",
    releaseVersion: "1.15.0",
    manifestVersion: 2,
    schemaTarget: "2026.09",
    manifestChecksum: CHECKSUM_B,
    schemaChecksum: null,
    riskLevel: "LOW",
    selfServiceAllowed: true,
    requiresBackup: false,
    requiresMaintenance: false,
    publishedAt: "2026-10-30T10:00:00.000Z",
    compatibilityContractVersion: 1,
  },
};

function makeEligibleUpdate(index: number): TenantAvailableUpdate {
  const parsed = parseProvisioningUpdatesPage({
    data: [sampleItem],
    meta: { page: 1, limit: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
  }).items[0]!;
  const suffix = String(index).padStart(12, "0");
  return {
    ...parsed,
    componentId: `01902001-3000-7000-8000-${suffix}`,
    componentKey: `comp.mod${String(index).padStart(3, "0")}`,
  };
}

afterEach(() => {
  resetWireLabelWarnings();
  vi.restoreAllMocks();
});

describe("Core provisioning updates contract", () => {
  it("uses exact Gateway paths, 25-row page size, and 100-item selection cap", () => {
    expect(PROVISIONING_UPDATES_PATH).toBe("/api/tenant/core/v1/provisioning/updates");
    expect(PROVISIONING_UPDATES_APPLY_PATH).toBe(
      "/api/tenant/core/v1/provisioning/updates/apply",
    );
    expect(PROVISIONING_UPDATES_PAGE_SIZE).toBe(25);
    expect(MAX_PROVISIONING_UPDATE_SELECTIONS).toBe(100);
    expect(provisioningOperationPath("01902001-3000-7000-8000-000000000099")).toBe(
      "/api/tenant/core/v1/provisioning/operations/01902001-3000-7000-8000-000000000099",
    );
  });

  it("validates componentKey filters and builds deterministic discovery queries with documented DTO fields only", () => {
    expect(isValidComponentKeyFilter("")).toBe(true);
    expect(isValidComponentKeyFilter("core.workspace")).toBe(true);
    expect(isValidComponentKeyFilter("crm.lead_stages-v2")).toBe(true);
    expect(isValidComponentKeyFilter("123-invalid")).toBe(false);
    expect(isValidComponentKeyFilter("core..bad")).toBe(false);

    const defaultQuery = buildProvisioningUpdatesQuery(
      {
        componentKey: " CRM.Core ",
        riskLevel: "MEDIUM",
        requiresBackup: "true",
        requiresMaintenance: "false",
      },
      2,
      25,
    );
    expect(defaultQuery).toBe(
      "page=2&limit=25&sortBy=publishedAt&sortDir=DESC&componentKey=crm.core&riskLevel=MEDIUM&requiresBackup=true&requiresMaintenance=false",
    );

    const sortedQuery = buildProvisioningUpdatesQuery(
      { componentKey: "", riskLevel: "", requiresBackup: "", requiresMaintenance: "" },
      1,
      25,
      { sortBy: "componentKey", sortDir: "ASC" },
    );
    expect(sortedQuery).toBe("page=1&limit=25&sortBy=componentKey&sortDir=ASC");
  });

  it("classifies derived eligibility states, deduplicates selections, and enforces the 1..100 cap", () => {
    const parsedPage = parseProvisioningUpdatesPage({
      data: [sampleItem],
      meta: { page: 1, limit: 25, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    });

    expect("checkedAt" in parsedPage).toBe(false);
    const first = parsedPage.items[0]!;
    expect(classifyUpdateEligibility(first)).toBe("ELIGIBLE");
    expect(canSelectAvailableUpdate(first)).toBe(true);

    const planned = { ...first, updateAlreadyPlanned: true };
    expect(classifyUpdateEligibility(planned)).toBe("PLANNED");
    expect(canSelectAvailableUpdate(planned)).toBe(false);
    expect(formatUpdateEligibility("PLANNED", en).reason).toBe(en.coreSettings.updatesUi.reasonPlanned);

    const adminManaged = {
      ...first,
      availableRelease: { ...first.availableRelease, selfServiceAllowed: false },
    };
    expect(classifyUpdateEligibility(adminManaged)).toBe("ADMIN_MANAGED");
    expect(canSelectAvailableUpdate(adminManaged)).toBe(false);
    expect(formatUpdateEligibility("ADMIN_MANAGED", ar).reason).toBe(
      ar.coreSettings.updatesUi.reasonAdminManaged,
    );

    const incomplete = {
      ...first,
      current: { ...first.current, manifestChecksum: null },
    };
    expect(classifyUpdateEligibility(incomplete)).toBe("INCOMPLETE_EVIDENCE");
    expect(canSelectAvailableUpdate(incomplete)).toBe(false);
    expect(formatUpdateEligibility("INCOMPLETE_EVIDENCE", en).reason).toBe(
      en.coreSettings.updatesUi.reasonIncompleteEvidence,
    );

    const manyWithDuplicates = [
      first,
      first,
      planned,
      adminManaged,
      incomplete,
      ...Array.from({ length: 105 }, (_, idx) => makeEligibleUpdate(idx + 1)),
    ];
    const built = buildApplyProvisioningUpdatesRequest(manyWithDuplicates);
    expect(built.selections).toHaveLength(100);
    expect(new Set(built.selections.map((s) => s.componentKey)).size).toBe(100);
    expect(built.selections[0]).toEqual({
      componentKey: "core.workspace",
      targetReleaseId: "01902001-3000-7000-8000-000000000012",
      targetReleaseVersion: "1.15.0",
      targetManifestChecksum: CHECKSUM_B,
      currentAppliedReleaseId: "01902001-3000-7000-8000-000000000011",
      currentAppliedManifestChecksum: CHECKSUM_A,
    });
  });

  it("freezes immutable apply snapshots and detects version, risk, backup, maintenance, and eligibility drift", () => {
    const first = makeEligibleUpdate(1);
    const snapshot = createApplyAttemptSnapshot(
      "01902001-3000-7000-8000-000000000555",
      [first],
    );
    expect(snapshot).not.toBeNull();

    // Mutating the original object must not mutate the frozen snapshot.
    first.availableRelease.releaseVersion = "9.9.9";
    expect(snapshot!.items[0]!.availableRelease.releaseVersion).toBe("1.15.0");
    expect(snapshot!.requestBody.selections[0]!.targetReleaseVersion).toBe("1.15.0");

    const baseItem = snapshot!.items[0]!;
    expect(doesDiscoveryMatchSnapshotItem(baseItem, { ...baseItem })).toBe(true);
    expect(
      hasSnapshotDiverged([baseItem], [
        {
          ...baseItem,
          availableRelease: { ...baseItem.availableRelease, requiresMaintenance: true },
        },
      ]),
    ).toBe(true);
    expect(
      hasSnapshotDiverged([baseItem], [
        {
          ...baseItem,
          availableRelease: { ...baseItem.availableRelease, requiresBackup: true },
        },
      ]),
    ).toBe(true);
    expect(
      hasSnapshotDiverged([baseItem], [
        {
          ...baseItem,
          availableRelease: { ...baseItem.availableRelease, riskLevel: "HIGH" },
        },
      ]),
    ).toBe(true);
    expect(hasSnapshotDiverged([baseItem], [{ ...baseItem, updateAlreadyPlanned: true }])).toBe(
      true,
    );
    expect(hasSnapshotDiverged([baseItem], [])).toBe(true);

    expect(
      isStaleApplyConflictError({
        status: 409,
        code: "TENANT_PROVISIONING_UPDATE_SELECTION_STALE",
        message: "Selection changed",
      }),
    ).toBe(true);
    expect(
      isStaleApplyConflictError({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Bad request",
      }),
    ).toBe(false);
  });

  it("rejects legacy unwrapped shapes and duplicate componentKey rows", () => {
    expect(() =>
      parseProvisioningUpdatesPage({
        data: { items: [sampleItem], total: 1, page: 1, limit: 25 },
        meta: undefined,
      }),
    ).toThrow();

    expect(() =>
      parseProvisioningUpdatesPage({
        data: [sampleItem, sampleItem],
        meta: { page: 1, limit: 25, total: 2, totalPages: 1, hasNext: false, hasPrev: false },
      }),
    ).toThrow(/Duplicate componentKey/u);
  });

  it("strictly validates only the 10 canonical TenantOperationStatusEnum values at the parser boundary and never leaks raw wire codes in labels", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});

    for (const status of TENANT_OPERATION_STATUSES) {
      const result = parseApplyProvisioningUpdatesResponse({
        replayed: false,
        operation: {
          id: "01902001-3000-7000-8000-000000000099",
          status,
          type: "TENANT_COMPONENT_UPDATE",
          currentPhase: "PRECHECK",
          safeError: {
            code: "PREREQUISITE_BACKUP_REQUIRED",
            message: "Workspace backup must finish first.",
          },
          updatedAt: "2026-10-30T12:05:00.000Z",
        },
      });
      expect(result.operation.status).toBe(status);
      expect(formatOperationStatusLabel(status, en)).toBe(
        en.coreSettings.updatesUi.operationStatus[status],
      );
      expect(formatOperationStatusLabel(status, ar)).toBe(
        ar.coreSettings.updatesUi.operationStatus[status],
      );
    }

    expect(formatRiskLabel("LOW", en)).toBe(en.trade.riskClass_LOW);
    expect(formatRiskLabel("HIGH", ar)).toBe(ar.trade.riskClass_HIGH);
    expect(formatOwnerAppLabel("core", en)).toBe(en.audit.ledger.apps.CORE);
    expect(formatOwnerAppLabel("crm", ar)).toBe(ar.audit.ledger.apps.CRM);

    expect(formatOperationStatusLabel("CANCEL_REQUESTED", en)).not.toBe(
      formatOperationStatusLabel("CANCELLED", en),
    );
    expect(formatOperationStatusLabel("CANCEL_REQUESTED", ar)).not.toBe(
      formatOperationStatusLabel("CANCELLED", ar),
    );
    expect(operationTone("CANCEL_REQUESTED")).toBe("caution");
    expect(operationTone("CANCELLED")).toBe("neutral");
    expect(operationTone("SUCCEEDED")).toBe("positive");
    expect(operationTone("FAILED_RETRYABLE")).toBe("negative");
    expect(operationTone("RUNNING")).toBe("brand");

    for (const nonCanonical of [
      "COMPLETED",
      "IN_PROGRESS",
      "RETRYING",
      "FAILED",
      "BLOCKED",
      "ABORTED",
      "queued",
      "FUTURE_BACKEND_STATE",
    ]) {
      expect(() =>
        parseProvisioningOperationView({
          id: "01902001-3000-7000-8000-000000000099",
          status: nonCanonical,
        }),
      ).toThrow();

      const enLabel = formatOperationStatusLabel(nonCanonical, en);
      const arLabel = formatOperationStatusLabel(nonCanonical, ar);
      expect(enLabel).toBe(en.coreSettings.updatesUi.operationStatusUnknown);
      expect(arLabel).toBe(ar.coreSettings.updatesUi.operationStatusUnknown);
      expect(enLabel).not.toContain(nonCanonical);
      expect(arLabel).not.toContain(nonCanonical);
      expect(operationTone(nonCanonical)).toBe("neutral");
    }
  });

  it("reconciles accepted-unreadable attempts only from correlated target/operation evidence and never from key presence or arbitrary operations", () => {
    const itemA: TenantAvailableUpdate = {
      ...makeEligibleUpdate(1),
      componentKey: "core.workspace",
      componentId: "01902001-3000-7000-8000-000000000101",
      lastOperationId: "01902001-3000-7000-8000-000000000500",
    };
    const baseB = makeEligibleUpdate(2);
    const itemB: TenantAvailableUpdate = {
      ...baseB,
      componentKey: "crm.core",
      componentId: "01902001-3000-7000-8000-000000000102",
      availableRelease: {
        ...baseB.availableRelease,
        id: "01902001-3000-7000-8000-000000000202",
        manifestChecksum: "d".repeat(64),
      },
    };
    const snapshot = createApplyAttemptSnapshot(
      "01902001-3000-7000-8000-000000000900",
      [itemA, itemB],
    )!;
    const attempt = { snapshot, responseOperationId: null };

    expect(extractAcceptedResponseOperationId({ unexpectedAcknowledgement: true })).toBeNull();
    expect(extractAcceptedResponseOperationId({ operation: { id: "not-a-uuid" } })).toBeNull();
    expect(
      extractAcceptedResponseOperationId({
        operation: { id: "01902001-3000-7000-8000-000000000777", status: "FUTURE_STATE" },
      }),
    ).toBe("01902001-3000-7000-8000-000000000777");

    // Empty discovery or unchanged eligible rows do NOT reconcile.
    expect(doesDiscoveryReconcileAcceptedAttempt(attempt, [])).toEqual({
      resolved: false,
      correlatedOperationId: null,
    });
    expect(doesDiscoveryReconcileAcceptedAttempt(attempt, [itemA, itemB])).toEqual({
      resolved: false,
      correlatedOperationId: null,
    });

    // Arbitrary new lastOperationId while updateAlreadyPlanned is still false does NOT reconcile.
    expect(
      doesDiscoveryReconcileAcceptedAttempt(attempt, [
        { ...itemA, lastOperationId: "01902001-3000-7000-8000-000000000777" },
        { ...itemB, lastOperationId: "01902001-3000-7000-8000-000000000777" },
      ]),
    ).toEqual({ resolved: false, correlatedOperationId: null });

    // Pre-existing lastOperationId or mismatched desiredReleaseId / checksum does NOT reconcile.
    expect(
      doesDiscoveryReconcileAcceptedAttempt(attempt, [
        {
          ...itemA,
          updateAlreadyPlanned: true,
          desiredReleaseId: itemA.availableRelease.id,
          lastOperationId: itemA.lastOperationId,
        },
        {
          ...itemB,
          updateAlreadyPlanned: true,
          desiredReleaseId: itemB.availableRelease.id,
          lastOperationId: "01902001-3000-7000-8000-000000000777",
        },
      ]),
    ).toEqual({ resolved: false, correlatedOperationId: null });

    // Genuine planned target correlation across all accepted items with one shared new operationId resolves.
    const newOpId = "01902001-3000-7000-8000-000000000777";
    expect(
      doesDiscoveryReconcileAcceptedAttempt(attempt, [
        {
          ...itemA,
          updateAlreadyPlanned: true,
          desiredReleaseId: itemA.availableRelease.id,
          lastOperationId: newOpId,
        },
        {
          ...itemB,
          updateAlreadyPlanned: true,
          desiredReleaseId: itemB.availableRelease.id,
          lastOperationId: newOpId,
        },
      ]),
    ).toEqual({ resolved: true, correlatedOperationId: newOpId });

    // Genuine applied-to-current target release + checksum correlation also resolves.
    expect(
      doesDiscoveryReconcileAcceptedAttempt(attempt, [
        {
          ...itemA,
          current: {
            ...itemA.current,
            releaseId: itemA.availableRelease.id,
            manifestChecksum: itemA.availableRelease.manifestChecksum,
          },
        },
        {
          ...itemB,
          current: {
            ...itemB.current,
            releaseId: itemB.availableRelease.id,
            manifestChecksum: itemB.availableRelease.manifestChecksum,
          },
        },
      ]),
    ).toEqual({ resolved: true, correlatedOperationId: null });
  });

  it("enforces requested operationId identity at the parser boundary and classifies terminal statuses, localized guidance, and whitelisted prerequisite phases", () => {
    const requestedId = "01902001-3000-7000-8000-000000000099";
    const mismatchedId = "01902001-3000-7000-8000-000000000100";

    const validMatched = parseProvisioningOperationView(
      {
        id: requestedId,
        status: "RUNNING",
        currentPhase: "AWAITING_PREREQUISITES",
        updatedAt: "2026-10-30T12:05:00.000Z",
      },
      requestedId,
    );
    expect(validMatched.id).toBe(requestedId);

    expect(() =>
      parseProvisioningOperationView(
        {
          id: mismatchedId,
          status: "SUCCEEDED",
          updatedAt: "2026-10-30T12:06:00.000Z",
        },
        requestedId,
      ),
    ).toThrow(/Invalid Core provisioning operation response/u);

    expect(TENANT_OPERATION_STATUSES.filter((s) => !isTerminalOperationStatus(s))).toEqual([
      "REQUESTED",
      "PLANNING",
      "QUEUED",
      "RUNNING",
      "WAITING_RETRY",
      "CANCEL_REQUESTED",
    ]);
    expect(TENANT_OPERATION_STATUSES.filter((s) => isTerminalOperationStatus(s))).toEqual([
      "SUCCEEDED",
      "FAILED_RETRYABLE",
      "MANUAL_RECOVERY_REQUIRED",
      "CANCELLED",
    ]);

    for (const status of TENANT_OPERATION_STATUSES) {
      const enGuidance = formatOperationGuidance(status, en);
      const arGuidance = formatOperationGuidance(status, ar);
      expect(enGuidance.length).toBeGreaterThan(0);
      expect(arGuidance.length).toBeGreaterThan(0);
      expect(enGuidance).not.toContain(status);
      expect(arGuidance).not.toContain(status);
      expect(classifyOperationSurface(status)).toBeTruthy();
    }

    expect(formatOperationGuidance("QUEUED", en)).toBe("Queued for execution.");
    expect(formatOperationGuidance("SUCCEEDED", en)).toBe("Update completed.");

    // Only the 3 Core prerequisite phase tokens map to localized labels; all others suppress to null.
    expect(formatOperationPhaseLabel("AWAITING_PREREQUISITES", en, "QUEUED")).toBe(
      en.coreSettings.updatesUi.operationPhaseAwaitingPrerequisites,
    );
    expect(formatOperationPhaseLabel("PREREQUISITE_FAILED", ar, "FAILED_RETRYABLE")).toBe(
      ar.coreSettings.updatesUi.operationPhasePrerequisiteFailed,
    );
    expect(formatOperationPhaseLabel("PREREQUISITE_EXPIRED", en, "WAITING_RETRY")).toBe(
      en.coreSettings.updatesUi.operationPhasePrerequisiteExpired,
    );
    expect(formatOperationPhaseLabel("AWAITING_PREREQUISITES", en, "SUCCEEDED")).toBeNull();
    expect(formatOperationPhaseLabel("AWAITING_PREREQUISITES", ar, "CANCELLED")).toBeNull();

    for (const suppressedPhase of [
      null,
      "",
      "QUEUED",
      "RUNNING",
      "FAILED",
      "CANCELLED",
      "CLOSED",
      "CANCEL_REQUESTED",
      "PRECHECK",
      "APPLYING",
      "FINALIZING",
      "crm.schema",
      "core.foundation.seed.core.organization",
    ]) {
      expect(formatOperationPhaseLabel(suppressedPhase, en, "RUNNING")).toBeNull();
      expect(formatOperationPhaseLabel(suppressedPhase, ar, "RUNNING")).toBeNull();
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  canResolveSeedConflict,
  isOperationTerminal,
  readManagedProvisioningOperation,
  readProvisioningPage,
  readSeedConflictResolution,
  readTenantAvailableUpdate,
  readTenantComponentInstallation,
  readTenantOperationDetail,
  readTenantOperationSummary,
  readTenantOperationTimelineEvent,
  readTenantPrerequisiteEvidenceRecord,
  readTenantProvisioningCommandResult,
  readTenantSeedState,
} from "./readers";
import {
  META,
  SHA_A,
  availableUpdate,
  componentInstallation,
  managedOperation,
  operationDetail,
  operationSummary,
  prerequisiteEvidenceRecord,
  seedResolution,
  seedState,
  timelineEvent,
} from "../test/fixtures";

describe("tenant provisioning wire readers", () => {
  it("accepts only the current six operation types and rejects stale reconcile/add-module contracts", () => {
    expect(readTenantOperationSummary(operationSummary()).type).toBe(
      "INITIAL_PROVISION",
    );
    expect(() =>
      readTenantOperationSummary(operationSummary({ type: "RECONCILE" })),
    ).toThrow("INVALID_TENANT_OPERATION_RESPONSE");
    expect(() =>
      readTenantOperationSummary(operationSummary({ type: "ADD_MODULE" })),
    ).toThrow("INVALID_TENANT_OPERATION_RESPONSE");
  });

  it("reads detail progress, bounded safe steps, and append-only timeline sequence strings", () => {
    const detail = readTenantOperationDetail(operationDetail());
    const event = readTenantOperationTimelineEvent(timelineEvent());

    expect(detail.progress).toEqual(
      expect.objectContaining({ percent: 50, totalSteps: 2 }),
    );
    expect(detail.steps[0]).toEqual(
      expect.objectContaining({ kind: "SCHEMA", componentKey: "core.foundation" }),
    );
    expect(event.sequence).toBe("1");
    expect(JSON.stringify({ detail, event })).not.toMatch(/stack|metadata|storageKey/i);
  });

  it("rejects malformed progress, checksums, identifiers, and pagination metadata", () => {
    expect(() =>
      readTenantOperationDetail(
        operationDetail({
          progress: {
            totalSteps: 1,
            completedSteps: 1,
            failedSteps: 0,
            totalWeight: 1,
            completedWeight: 1,
            percent: 101,
          },
        }),
      ),
    ).toThrow("INVALID_TENANT_OPERATION_DETAIL_RESPONSE");
    expect(() =>
      readTenantOperationSummary(operationSummary({ planDigest: "bad" })),
    ).toThrow("INVALID_TENANT_OPERATION_RESPONSE");
    expect(() =>
      readProvisioningPage([operationSummary()], { ...META, total: -1 }, readTenantOperationSummary),
    ).toThrow("INVALID_PROVISIONING_PAGE_RESPONSE");
  });

  it("reads no-store update evidence and installation desired/applied pins", () => {
    const update = readTenantAvailableUpdate(availableUpdate());
    const component = readTenantComponentInstallation(componentInstallation());

    expect(update.availableRelease).toEqual(
      expect.objectContaining({
        compatibilityContractVersion: 1,
        requiresBackup: true,
      }),
    );
    expect(component.desired.manifestChecksum).toBe(SHA_A);
    expect(component.applied.releaseVersion).toBe("1.0.0");
  });

  it("fails closed on the currently omitted seed revision and enables exact conflict evidence only when present", () => {
    const currentBackendShape = readTenantSeedState(seedState());
    const futureSafeShape = readTenantSeedState(seedState({ revision: 3 }));

    expect(currentBackendShape.revision).toBeNull();
    expect(canResolveSeedConflict(currentBackendShape)).toBe(false);
    expect(canResolveSeedConflict(futureSafeShape)).toBe(true);
  });

  it("allowlists prerequisite evidence and preserves uint64 byte evidence as a string", () => {
    const record = readTenantPrerequisiteEvidenceRecord(
      prerequisiteEvidenceRecord(),
    );

    expect(record.maintenanceFence?.status).toBe("ACTIVE");
    expect(record.evidence[0]?.backupEvidence?.sizeBytes).toBe(
      "9223372036854775807",
    );
    expect(JSON.stringify(record)).not.toContain("must-not-survive");
    expect(JSON.stringify(record)).not.toContain("storageKey");
  });

  it("reads command, managed-operation, and conflict-resolution receipts", () => {
    expect(
      readTenantProvisioningCommandResult({
        replayed: false,
        operation: operationDetail(),
      }).operation.progress.percent,
    ).toBe(50);
    expect(readManagedProvisioningOperation(managedOperation()).type).toBe(
      "REPAIR",
    );
    expect(
      readSeedConflictResolution(seedResolution()).expectedConflictRevision,
    ).toBe(3);
    expect(() =>
      readManagedProvisioningOperation(
        managedOperation({ type: "INITIAL_PROVISION" }),
      ),
    ).toThrow("INVALID_MANAGED_PROVISIONING_OPERATION_RESPONSE");
  });

  it("uses the exact four terminal operation states", () => {
    expect(isOperationTerminal("SUCCEEDED")).toBe(true);
    expect(isOperationTerminal("FAILED_RETRYABLE")).toBe(true);
    expect(isOperationTerminal("MANUAL_RECOVERY_REQUIRED")).toBe(true);
    expect(isOperationTerminal("CANCELLED")).toBe(true);
    expect(isOperationTerminal("CANCEL_REQUESTED")).toBe(false);
    expect(isOperationTerminal("RUNNING")).toBe(false);
  });
});

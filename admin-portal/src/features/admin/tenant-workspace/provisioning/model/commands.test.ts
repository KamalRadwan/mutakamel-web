import { describe, expect, it } from "vitest";
import {
  buildApplyUpdatesDto,
  buildDecommissionOperationDto,
  buildRepairOperationDto,
  buildResolveSeedConflictDto,
  canonicalProvisioningIntent,
  validateAddApplicationInput,
} from "./commands";
import {
  readTenantAvailableUpdate,
  readTenantComponentInstallation,
  readTenantSeedState,
} from "./readers";
import {
  COMPONENT_ID,
  RELEASE_ID,
  SHA_A,
  SHA_B,
  TARGET_RELEASE_ID,
  availableUpdate,
  componentInstallation,
  seedState,
} from "../test/fixtures";

describe("tenant provisioning command builders", () => {
  it("builds a fully pinned update command from the no-store update projection", () => {
    const dto = buildApplyUpdatesDto([
      readTenantAvailableUpdate(availableUpdate()),
    ]);

    expect(dto).toEqual({
      selections: [
        {
          componentKey: "core.foundation",
          targetReleaseId: TARGET_RELEASE_ID,
          targetReleaseVersion: "1.1.0",
          targetManifestChecksum: SHA_B,
          currentAppliedReleaseId: RELEASE_ID,
          currentAppliedManifestChecksum: SHA_A,
        },
      ],
    });
  });

  it("rejects empty, duplicate, and missing-current-evidence update selections", () => {
    const update = readTenantAvailableUpdate(availableUpdate());
    expect(() => buildApplyUpdatesDto([])).toThrow(
      "TENANT_UPDATE_SELECTION_REQUIRED",
    );
    expect(() => buildApplyUpdatesDto([update, update])).toThrow(
      "TENANT_UPDATE_SELECTION_DUPLICATE",
    );
    const missing = readTenantAvailableUpdate(
      availableUpdate({
        current: {
          releaseId: RELEASE_ID,
          releaseVersion: "1.0.0",
          schemaVersion: "1.0.0",
          manifestChecksum: null,
        },
      }),
    );
    expect(() => buildApplyUpdatesDto([missing])).toThrow(
      "TENANT_UPDATE_CURRENT_EVIDENCE_MISSING",
    );
  });

  it("pins repair to desired state and never widens it into an upgrade", () => {
    const component = readTenantComponentInstallation(componentInstallation());
    const dto = buildRepairOperationDto(component, "ADMIN.REPAIR");

    expect(dto.targetReleaseId).toBe(dto.currentDesiredReleaseId);
    expect(dto.targetManifestChecksum).toBe(
      dto.currentDesiredManifestChecksum,
    );
    expect(dto.currentAppliedReleaseId).toBe(RELEASE_ID);
  });

  it("requires retained-data acknowledgement and complete applied evidence for decommission", () => {
    const component = readTenantComponentInstallation(componentInstallation());
    expect(() =>
      buildDecommissionOperationDto(component, "ADMIN.DECOMMISSION", false),
    ).toThrow("TENANT_DECOMMISSION_RETENTION_ACK_REQUIRED");
    expect(
      buildDecommissionOperationDto(component, "ADMIN.DECOMMISSION", true),
    ).toEqual(
      expect.objectContaining({
        retentionAcknowledged: true,
        currentAppliedReleaseId: RELEASE_ID,
      }),
    );
  });

  it("never fabricates the hidden seed conflict revision", () => {
    const hiddenRevision = readTenantSeedState(seedState());
    expect(() =>
      buildResolveSeedConflictDto(
        hiddenRevision,
        "KEEP_TENANT_VALUE",
        "ADMIN.SEED_CONFLICT",
      ),
    ).toThrow("TENANT_SEED_CONFLICT_REVISION_UNAVAILABLE");

    const exposedRevision = readTenantSeedState(seedState({ revision: 3 }));
    expect(
      buildResolveSeedConflictDto(
        exposedRevision,
        "KEEP_TENANT_VALUE",
        "ADMIN.SEED_CONFLICT",
      ),
    ).toEqual(
      expect.objectContaining({
        expectedConflictRevision: 3,
        expectedStatus: "CONFLICT",
        expectedAppliedChecksum: SHA_A,
        expectedDesiredChecksum: SHA_B,
      }),
    );
  });

  it("canonicalizes object key order for stable exact-intent UUID ownership", () => {
    expect(canonicalProvisioningIntent({ b: 2, a: { d: 4, c: 3 } })).toBe(
      canonicalProvisioningIntent({ a: { c: 3, d: 4 }, b: 2 }),
    );
    expect(canonicalProvisioningIntent({ values: [2, 1] })).not.toBe(
      canonicalProvisioningIntent({ values: [1, 2] }),
    );
  });

  it("accepts only add-Application exact target pins and rejects stale current-pin fields", () => {
    const dto = {
      applicationKey: "crm",
      expectedAccessPolicyRevision: 2,
      targetSelection: [
        {
          componentKey: "crm.main",
          componentId: COMPONENT_ID,
          targetReleaseId: TARGET_RELEASE_ID,
          targetReleaseVersion: "1.1.0",
          targetManifestChecksum: SHA_B,
        },
      ],
      reasonCode: "ADMIN.ADD_APPLICATION",
    };
    expect(() => validateAddApplicationInput(dto)).not.toThrow();
    expect(() =>
      validateAddApplicationInput({
        ...dto,
        targetSelection: [
          {
            ...dto.targetSelection[0],
            expectedCurrentReleaseId: RELEASE_ID,
          },
        ],
      } as unknown as Parameters<typeof validateAddApplicationInput>[0]),
    ).toThrow("INVALID_ADD_APPLICATION_TARGET_SELECTION");
  });
});

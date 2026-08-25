import { describe, expect, it } from "vitest";
import {
  PROVISIONING_PERMISSION_REQUIREMENTS,
  deriveProvisioningPermissions,
} from "./permissions";

describe("tenant provisioning permissions", () => {
  it("uses the exact Gateway/Core ALL requirements for every command", () => {
    expect(PROVISIONING_PERMISSION_REQUIREMENTS.retryOrCancel).toEqual([
      "admin.tenants.read",
      "admin.tenants.reprovision",
      "admin.tenants.critical",
    ]);
    expect(PROVISIONING_PERMISSION_REQUIREMENTS.applyUpdates).toEqual([
      "admin.tenants.reprovision",
      "admin.tenants.critical",
      "admin.provisioning.critical",
    ]);
    expect(PROVISIONING_PERMISSION_REQUIREMENTS.addApplication).toEqual([
      "admin.provisioning.add-application",
      "admin.provisioning.critical",
    ]);
    expect(PROVISIONING_PERMISSION_REQUIREMENTS.resolveConflicts).toEqual([
      "admin.provisioning.conflicts.resolve",
      "admin.provisioning.critical",
    ]);
  });

  it("does not treat tenant read as nested prerequisite or command authority", () => {
    const permissions = deriveProvisioningPermissions({
      isSuperAdmin: false,
      permissions: ["admin.tenants.read"],
    });
    expect(permissions.canReadOperations).toBe(true);
    expect(permissions.canRetryOrCancel).toBe(false);
    expect(permissions.canReadPrerequisites).toBe(false);
    expect(permissions.canRepair).toBe(false);
  });

  it("requires the critical pair and honors super-admin authority", () => {
    expect(
      deriveProvisioningPermissions({
        isSuperAdmin: false,
        permissions: ["admin.provisioning.repair"],
      }).canRepair,
    ).toBe(false);
    expect(
      deriveProvisioningPermissions({
        isSuperAdmin: true,
        permissions: [],
      }),
    ).toEqual(
      expect.objectContaining({
        canReadOperations: true,
        canRepair: true,
        canDecommission: true,
        canResolveConflicts: true,
      }),
    );
  });
});

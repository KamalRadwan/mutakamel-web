import { describe, expect, it } from "vitest";
import {
  classifyFleetCommandFailure,
  deriveProvisioningFleetPermissions,
  isFleetActionAllowed,
  shouldRetainFleetIntent,
} from "./model";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";

describe("provisioning fleet operator policy", () => {
  it("requires ALL critical permissions for rollout, lifecycle, and attestation writes", () => {
    const user = {
      id: "operator",
      email: "operator@example.test",
      firstName: "Fleet",
      lastName: "Operator",
      isSuperAdmin: false,
      role: { id: "role", name: "operator" },
      status: "ACTIVE",
      permissions: [
        "admin.provisioning.rollouts.read",
        "admin.provisioning.rollouts.create",
        "admin.provisioning.rollouts.manage",
        "admin.provisioning.rollouts.report",
      ],
    };

    expect(deriveProvisioningFleetPermissions(user)).toEqual({
      canRead: true,
      canCreatePreview: true,
      canCreateRollout: false,
      canManage: false,
      canReadReport: true,
      canAttest: false,
    });
  });

  it("routes stale evidence separately from validation and conflicts", () => {
    expect(classifyFleetCommandFailure(error(
      422,
      "PROVISIONING_FLEET_TENANT_FILTER_STALE",
    ))).toBe("STALE");
    expect(classifyFleetCommandFailure(error(
      422,
      "PROVISIONING_FLEET_REPORT_SIGNATURE_INVALID",
    ))).toBe("VALIDATION");
    expect(classifyFleetCommandFailure(error(
      409,
      "PROVISIONING_FLEET_STATE_CONFLICT",
    ))).toBe("CONFLICT");
  });

  it("retains exact intent only for ambiguous outcomes", () => {
    expect(shouldRetainFleetIntent(error(503, "CORE_UNAVAILABLE"))).toBe(true);
    expect(shouldRetainFleetIntent(error(429, "GW.RATE_LIMIT"))).toBe(true);
    expect(shouldRetainFleetIntent(error(409, "GW.IDEM.IN_FLIGHT"))).toBe(true);
    expect(shouldRetainFleetIntent(error(409, "PROVISIONING_FLEET_STATE_CONFLICT")))
      .toBe(false);
  });

  it("allows only lifecycle transitions supported by the authoritative state", () => {
    expect(isFleetActionAllowed("RUNNING", "pause")).toBe(true);
    expect(isFleetActionAllowed("RUNNING", "cancel")).toBe(true);
    expect(isFleetActionAllowed("RUNNING", "resume")).toBe(false);
    expect(isFleetActionAllowed("PAUSED", "resume")).toBe(true);
    expect(isFleetActionAllowed("SUCCEEDED", "cancel")).toBe(false);
  });
});

function error(httpStatus: number, errorCode: string): NormalizedApiError {
  return {
    isNormalized: true,
    httpStatus,
    errorCode,
    message: errorCode,
  };
}


import { describe, expect, it } from "vitest";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { ApplicationTechnicalReadinessView } from "../types";
import {
  classifyTechnicalProvisioningError,
  getActivationReadinessState,
  shouldReconcileTechnicalProvisioning,
} from "./technical-provisioning-state";

function error(
  errorCode: string,
  httpStatus = 409,
): NormalizedApiError {
  return {
    isNormalized: true,
    errorCode,
    httpStatus,
    message: errorCode,
  };
}

const readiness = (activationAllowed: boolean): ApplicationTechnicalReadinessView => ({
  contractVersion: 1,
  applicationKey: "crm",
  lifecycleStatus: "DRAFT",
  technicalDefinitionRevision: "2",
  status: activationAllowed ? "READY" : "BLOCKED",
  activationAllowed,
  selectionAllowed: activationAllowed,
  reasons: activationAllowed ? [] : ["PUBLISHED_RELEASE_REQUIRED"],
  checks: {
    componentBinding: true,
    activeComponents: true,
    publishedReleases: activationAllowed,
    databasePermissionManifest: true,
  },
  components: [],
});

describe("technical provisioning command recovery", () => {
  it("refetches stale, in-flight, and ambiguous outcomes", () => {
    const stale = classifyTechnicalProvisioningError(
      error("APPLICATION_TECHNICAL_DEFINITION_REVISION_STALE"),
    );
    const inFlight = classifyTechnicalProvisioningError(
      error("GW.IDEM.IN_FLIGHT", 409),
    );
    const ambiguous = classifyTechnicalProvisioningError(
      error("GW.UPSTREAM.UNAVAILABLE", 503),
    );

    expect(stale).toBe("STALE");
    expect(inFlight).toBe("IN_FLIGHT");
    expect(ambiguous).toBe("AMBIGUOUS");
    expect([stale, inFlight, ambiguous].every(shouldReconcileTechnicalProvisioning)).toBe(true);
  });

  it("keeps forbidden and terminal validation failures out of automatic reconciliation", () => {
    const forbidden = classifyTechnicalProvisioningError(
      error("GW.AUTH.FORBIDDEN", 403),
    );
    const terminal = classifyTechnicalProvisioningError(
      error("APPLICATION_COMPONENT_KEY_TAKEN", 409),
    );

    expect(forbidden).toBe("FORBIDDEN");
    expect(terminal).toBe("TERMINAL");
    expect(shouldReconcileTechnicalProvisioning(forbidden)).toBe(false);
    expect(shouldReconcileTechnicalProvisioning(terminal)).toBe(false);
  });
});

describe("activation readiness", () => {
  it("fails closed while loading, unavailable, or blocked", () => {
    expect(getActivationReadinessState(null, true, false)).toBe("LOADING");
    expect(getActivationReadinessState(null, false, true)).toBe("UNAVAILABLE");
    expect(getActivationReadinessState(readiness(false), false, false)).toBe("BLOCKED");
  });

  it("allows activation only from an authoritative allowed projection", () => {
    expect(getActivationReadinessState(readiness(true), false, false)).toBe("ALLOWED");
    expect(getActivationReadinessState(readiness(true), false, true)).toBe("UNAVAILABLE");
  });
});


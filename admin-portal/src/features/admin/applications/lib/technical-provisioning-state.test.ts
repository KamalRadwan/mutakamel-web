import { describe, expect, it } from "vitest";
import type { NormalizedApiError } from "@/shared/api/normalized-api-error";
import type { ApplicationTechnicalReadinessView } from "../types";
import {
  classifyTechnicalProvisioningError,
  getActivationReadinessState,
  shouldReconcileTechnicalProvisioning,
  type ApplicationPublicationEvidence,
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
  applicationId: "019f0000-0000-7000-8000-000000000001",
  applicationKey: "crm",
  runtimeTarget: "crm-app",
  commercialMode: "SUBSCRIPTION",
  catalogueVisibility: "PUBLIC",
  lifecycleStatus: "DRAFT",
  publicationStatus: "PUBLISHED",
  technicalDefinitionRevision: "2",
  status: activationAllowed ? "READY" : "BLOCKED",
  activationAllowed,
  selectionAllowed: false,
  selectionBlockers: ["APPLICATION_LIFECYCLE_NOT_ACTIVE"],
  reasons: activationAllowed ? [] : ["PUBLISHED_RELEASE_REQUIRED"],
  checks: {
    runtimeTarget: true,
    componentBinding: true,
    activeComponents: true,
    publishedReleases: activationAllowed,
    minimumReleases: true,
    databasePermissionManifest: true,
  },
  components: [],
});

const publication = (
  overrides: Partial<ApplicationPublicationEvidence> = {},
): ApplicationPublicationEvidence => ({
  publicationStatus: "PUBLISHED",
  publishedAt: "2026-08-05T10:00:00.000Z",
  publishedBy: "019f0000-0000-7000-8000-000000000002",
  ...overrides,
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
    expect(getActivationReadinessState(null, true, false, null)).toBe("LOADING");
    expect(getActivationReadinessState(null, false, true, publication())).toBe("UNAVAILABLE");
    expect(getActivationReadinessState(readiness(false), false, false, publication())).toBe("BLOCKED");
  });

  it("requires an attributable published revision as well as technical readiness", () => {
    expect(getActivationReadinessState(readiness(true), false, false, publication())).toBe("ALLOWED");
    expect(
      getActivationReadinessState(
        { ...readiness(true), publicationStatus: "UNPUBLISHED" },
        false,
        false,
        publication(),
      ),
    ).toBe("BLOCKED");
    expect(
      getActivationReadinessState(
        readiness(true),
        false,
        false,
        publication({ publicationStatus: "UNPUBLISHED", publishedAt: null, publishedBy: null }),
      ),
    ).toBe("BLOCKED");
    expect(
      getActivationReadinessState(
        readiness(true),
        false,
        false,
        publication({ publishedBy: null }),
      ),
    ).toBe("BLOCKED");
    expect(getActivationReadinessState(readiness(true), false, true, publication())).toBe("UNAVAILABLE");
  });
});


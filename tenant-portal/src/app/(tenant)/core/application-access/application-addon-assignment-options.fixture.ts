import type { ApplicationAddonAssignmentOption } from "./application-addon-assignment-options";

// Test-only diagnostic records, never a runtime fallback.
const id = (suffix: number) => `018ef54e-2222-7777-8888-${String(suffix).padStart(12, "0")}`;
const historical = "b4ce3816-3469-4039-9e3b-d020a24d3c9d";
export function createAddonAssignmentOptionsFixture() {
  const data: ApplicationAddonAssignmentOption[] = [{  userId: id(1), targetActive: true,
    applicationId: historical, applicationKey: "crm", addonId: id(2), addonKey: "crm.logistics", addonSelectionId: id(3),
    allowanceId: id(4), allowanceRevision: "9223372036854775807", selectedDefinitionVersionId: id(5),
    parentAssignment: { id: historical, revision: "9007199254740993" }, assignment: null,
    localState: { parentReadiness: "READY", addonReadiness: "READY", parentDenied: false, addonDenied: false, adoptionPending: false, capacityChangePending: false },
    observation: "LOCAL_PROJECTION", operationalUse: "NOT_EVALUATED" }];
  return { success: true, data, meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    correlationId: "options-read", timestamp: "2026-09-08T01:00:00.000Z" };
}

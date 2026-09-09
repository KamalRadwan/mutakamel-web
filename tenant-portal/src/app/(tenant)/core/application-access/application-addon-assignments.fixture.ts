import type { ApplicationAddonAssignment } from "./application-addon-assignments";
const id = (suffix: number) => `018ef54e-2222-7777-8888-${String(suffix).padStart(12, "0")}`;
export function createAddonAssignmentsFixture() {
  const data: ApplicationAddonAssignment[] = [{  userId: id(1), assignmentId: id(2), assignmentRevision: "9007199254740993",
    applicationId: id(3), applicationKey: "crm", addonId: id(4), addonKey: "crm.logistics", addonSelectionId: id(5), allowanceRevision: "4",
    parentAssignmentId: "b4ce3816-3469-4039-9e3b-d020a24d3c9d", parentAssignmentRevision: "5", selectedDefinitionVersionId: id(6),
    assignedAt: "2026-09-07T19:00:00.000Z", observation: "LOCAL_PROJECTION", operationalUse: "NOT_EVALUATED" }];
  return { success: true, data, meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrev: false },
    correlationId: "assignment-request", timestamp: "2026-09-07T19:00:00.000Z" };
}

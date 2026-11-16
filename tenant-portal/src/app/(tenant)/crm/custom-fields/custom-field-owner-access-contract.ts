import type { CrmRecordSourceType } from "@/hooks/useCrmRecordOptions";
import { isUUIDv7 } from "@/lib/uuid";
import { crmCapabilityAllowsOwner, crmRecord, parseCrmActionCapability } from "../shared/crm-capabilities";

// Owning controllers expose GET /:id and branch-scoped GET /capabilities.
export const CUSTOM_FIELD_OWNER_RESOURCES = {
  LEAD: { path: "/api/tenant/crm/v1/leads", capability: "leads" },
  CUSTOMER_PROFILE: { path: "/api/tenant/crm/v1/customer-profiles", capability: "customerProfiles" },
  OPPORTUNITY: { path: "/api/tenant/crm/v1/opportunities", capability: "opportunities" },
} as const satisfies Record<CrmRecordSourceType, { path: string; capability: string }>;

// crm-app/packages/common/src/enums/crm.enums.ts: LeadStatusEnum.
const LEAD_STATUSES: readonly string[] = ["OPEN", "CONVERTED", "DISQUALIFIED", "ON_HOLD"];

export function parseCustomFieldOwnerAccess(
  capabilityPayload: unknown,
  ownerPayload: unknown,
  ownerType: CrmRecordSourceType,
  branchId: string,
  ownerId: string,
) {
  const response = crmRecord(capabilityPayload);
  const resource = response && crmRecord(response[CUSTOM_FIELD_OWNER_RESOURCES[ownerType].capability]);
  const owner = crmRecord(ownerPayload);
  if (!response || response.branchId !== branchId || !resource || resource.update === undefined ||
    !owner || owner.id !== ownerId || owner.branchId !== branchId ||
    !(owner.ownerUserId === null || isUUIDv7(owner.ownerUserId)) ||
    (ownerType === "LEAD" && (typeof owner.status !== "string" || !LEAD_STATUSES.includes(owner.status)))) {
    throw new Error("Invalid custom-field owner access response.");
  }
  const capability = parseCrmActionCapability(resource.update, "custom-field owner");
  const converted = ownerType === "LEAD" && owner.status === "CONVERTED";
  return { canEdit: !converted && crmCapabilityAllowsOwner(capability, owner.ownerUserId), converted };
}

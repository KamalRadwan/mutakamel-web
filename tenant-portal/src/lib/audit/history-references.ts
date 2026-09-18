import type { EntityAuditEvent } from "./entity-history-contract";
import { isUUIDv7 } from "@/lib/uuid";

// Core TenantUser/Team, CRM Lead/Party/Activity, and activity-history.changes.ts.
const USER_FIELDS = new Set([
  "ownerUserId", "createdByUserId", "updatedByUserId", "managerId", "leadUserId",
  "assigneeUserId", "activityAssignee",
]);
export const isAuditUserField = (field: string) => USER_FIELDS.has(field);

export function auditUserIds(events: readonly EntityAuditEvent[]): string[] {
  return [...new Set(events.flatMap((event) => event.changes.flatMap((change) =>
    isAuditUserField(change.field) ? [change.before, change.after].flat().filter(isUUIDv7) : [],
  )))];
}

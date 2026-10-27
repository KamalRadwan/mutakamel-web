import { crmActivityState } from "../../../shared/crm-activity-tone";
import type { OpportunityReadFields } from "../../opportunity-read-model";

export function opportunityBoardActivityState(item: Pick<OpportunityReadFields, "nextOpenActivityAt" | "activityState">) {
  return crmActivityState(!item.nextOpenActivityAt && item.activityState === "NO_OPEN" ? null : {
    activityAt: item.nextOpenActivityAt,
    bucket: item.activityState === "NO_OPEN" ? undefined : item.activityState,
  });
}

export function opportunityOwnerInitials(name: string | null) {
  return (name ?? "").split(/\s+/u).filter(Boolean).slice(0, 2)
    .map((part) => (Array.from(part)[0] ?? "").toUpperCase()).join("");
}

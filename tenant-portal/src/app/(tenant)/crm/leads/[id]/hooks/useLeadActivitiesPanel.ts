"use client";

import { useState } from "react";
import type { LeadPlannedActivity } from "../../lead-activity-contract";
import { useLeadActivities } from "../../hooks/useLeadActivities";

export function useLeadActivitiesPanel(leadId: string, readOnly: boolean) {
  const activities = useLeadActivities(leadId);
  const [editing, setEditing] = useState<LeadPlannedActivity | null>(null);
  const [discarding, setDiscarding] = useState<LeadPlannedActivity | null>(null);
  function edit(activity: LeadPlannedActivity) {
    if (!readOnly && activities.canUpdate) setEditing(activity);
  }
  async function complete(activity: LeadPlannedActivity) {
    if (!readOnly) await activities.complete(activity);
  }
  function discard(activity: LeadPlannedActivity) {
    if (!readOnly && activities.canCancel) setDiscarding(activity);
  }
  async function confirmDiscard() {
    if (readOnly || !discarding) return;
    if (await activities.cancel(discarding)) setDiscarding(null);
  }
  return {
    activities, editing, discarding, edit, complete, discard, confirmDiscard,
    closeEdit: () => setEditing(null),
    closeDiscard: () => setDiscarding(null),
  };
}

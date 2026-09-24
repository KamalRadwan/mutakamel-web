"use client";

import { useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useRealtimeResync } from "@/design-system";
import type { Activity, ActivityTargetSelection } from "../activity-contract";
import { canActOnActivity, canCreateActivities, type ActivityAction } from "../activity-presentation";
import type { ActivityModalRequest } from "../ActivityModal";
import { useActivityCommands, type ActivityCommandResult } from "./useActivityCommands";
import { useActivityOutcome } from "./useActivityOutcome";
import { useRecordActivities } from "./useRecordActivities";

/**
 * A record detail page's activity panel: the record's open activities, the
 * template modal it opens, and the quick edit / complete / cancel on each row.
 *
 * `readOnly` is the page's own answer (access mode, or a record that can no
 * longer change) and removes every write the panel offers itself; the modal
 * applies its own admission to whatever it shows.
 */
export function useRecordActivitiesPanel(target: ActivityTargetSelection, readOnly: boolean, onChanged?: () => void) {
  const { user } = useTenantAuth();
  const records = useRecordActivities(target, true);
  const commands = useActivityCommands();
  const [request, setRequest] = useState<ActivityModalRequest | null>(null);

  function settle(result: ActivityCommandResult) {
    // "applied" landed too; only its answer could not be read.
    if (result.kind === "saved" || result.kind === "applied") {
      records.reload();
      onChanged?.();
    } else if (result.kind === "reloaded") {
      records.reload();
    }
  }

  const outcome = useActivityOutcome(commands, settle);
  // Nothing pushes activity changes to the browser; a reconnect or a return
  // from offline is the only signal that this list may be stale.
  useRealtimeResync(records.reload);

  return {
    records,
    commands,
    outcome,
    request,
    canCreate: !readOnly && canCreateActivities(user),
    /** Each row's menu offers only what the actor may do to THAT activity. */
    can: (action: ActivityAction, activity: Activity) => !readOnly && canActOnActivity(user, action, activity),
    openCreate: () => setRequest({ kind: "create", target }),
    openView: (activity: Activity) => setRequest({ kind: "view", activity }),
    openEdit: (activity: Activity) => setRequest({ kind: "edit", activity }),
    closeModal: () => setRequest(null),
    modalChanged: () => {
      records.reload();
      onChanged?.();
    },
    retry: async () => settle(await commands.retry()),
    dismissAmbiguous: () => {
      // The user accepts not knowing; reading again is what shows whether it landed.
      commands.dismissAmbiguous();
      records.reload();
      onChanged?.();
    },
  };
}

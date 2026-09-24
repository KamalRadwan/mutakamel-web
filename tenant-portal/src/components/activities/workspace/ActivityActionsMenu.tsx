"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { Activity } from "../activity-contract";
import type { ActivityRowActions } from "./hooks/useActivityWorkspaceWrites";

export interface ActivityActionsMenuProps {
  activity: Activity;
  actions: ActivityRowActions;
}

// A table row opens its activity on click and on Enter. React events follow
// the component tree, not the DOM, so the menu's portalled items reach the row
// too: both are stopped here, once, around the whole menu.
function keepFromRow(event: MouseEvent | KeyboardEvent) {
  event.stopPropagation();
}

/**
 * One activity's actions — view, edit, start or move back, mark as done,
 * cancel — on a board card and a table row alike. Each entry is present only
 * when the viewer may take it on THIS activity: absent, not disabled.
 */
export function ActivityActionsMenu({ activity, actions }: ActivityActionsMenuProps) {
  const { t } = useI18n();
  const copy = t.activities;
  const label = formatTemplate(copy.actions.menu, { subject: activity.subject });
  const canUpdate = actions.can("update", activity);
  const canComplete = actions.can("complete", activity);
  const canCancel = actions.can("cancel", activity);

  return (
    <div className="contents" onClick={keepFromRow} onKeyDown={keepFromRow}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" className="w-7 px-0" aria-label={label} disabled={actions.busy}>
                <MoreHorizontal className={iconSize({ size: "sm" })} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{copy.workspace.table.actions}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => actions.view(activity)}>{copy.actions.view}</DropdownMenuItem>
          {canUpdate && <DropdownMenuItem onSelect={() => actions.edit(activity)}>{copy.actions.edit}</DropdownMenuItem>}
          {canUpdate && activity.status === "PLANNED" && (
            <DropdownMenuItem onSelect={() => actions.setStatus(activity, "IN_PROGRESS")}>{copy.actions.start}</DropdownMenuItem>
          )}
          {canUpdate && activity.status === "IN_PROGRESS" && (
            <DropdownMenuItem onSelect={() => actions.setStatus(activity, "PLANNED")}>{copy.actions.moveBack}</DropdownMenuItem>
          )}
          {canComplete && (
            <DropdownMenuItem onSelect={() => actions.complete(activity)}>{copy.actions.markDone}</DropdownMenuItem>
          )}
          {canCancel && (
            <>
              <DropdownMenuSeparator />
              {/* Ends the activity, though nothing is deleted — it stays on the record as cancelled. */}
              <DropdownMenuItem variant="destructive" onSelect={() => actions.cancel(activity)}>
                {copy.actions.cancelActivity}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

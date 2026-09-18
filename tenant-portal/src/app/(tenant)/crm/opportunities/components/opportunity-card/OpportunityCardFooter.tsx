"use client";

import { Activity } from "lucide-react";
import { Button, cn, iconSize } from "@/design-system";
import { CrmRating, type CrmRatingLabels } from "../../../shared/components/CrmRating";
import { CRM_ACTIVITY_MARK, type CrmActivityState } from "../../../shared/crm-activity-tone";
import type { OpportunityActivityState } from "../../hooks/pipeline-types";

export interface OpportunityCardFooterLabels extends CrmRatingLabels {
  activity: string;
  owner: string;
}

export interface OpportunityCardFooterProps {
  importance: number;
  onImportanceChange: (next: number) => void;
  isImportanceDisabled?: boolean;
  activityState: OpportunityActivityState;
  onOpenActivities: () => void;
  ownerUserId?: string | null;
  labels: OpportunityCardFooterLabels;
}

function mapOpportunityActivityState(state: OpportunityActivityState): CrmActivityState {
  if (state === "OVERDUE") return "OVERDUE";
  if (state === "TODAY") return "TODAY";
  if (state === "FUTURE") return "FUTURE";
  return "NONE";
}

export function OpportunityCardFooter({
  importance,
  onImportanceChange,
  isImportanceDisabled,
  activityState,
  onOpenActivities,
  ownerUserId,
  labels,
}: OpportunityCardFooterProps) {
  const toneState = mapOpportunityActivityState(activityState);
  const initials = ownerUserId ? ownerUserId.slice(0, 2).toUpperCase() : "";

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <CrmRating
          value={importance}
          onChange={onImportanceChange}
          disabled={isImportanceDisabled}
          labels={labels}
        />

        <Button
          variant="ghost"
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            onOpenActivities();
          }}
          title={labels.activity}
          className="w-6 shrink-0 px-0"
        >
          <Activity
            strokeWidth={2.5}
            className={cn(iconSize({ size: "sm" }), CRM_ACTIVITY_MARK[toneState])}
            aria-hidden="true"
          />
          <span className="sr-only">{labels.activity}</span>
        </Button>
      </div>

      {ownerUserId && (
        <span
          title={labels.owner}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted text-2xs font-medium text-muted-foreground"
        >
          <span aria-hidden="true">{initials}</span>
          <span className="sr-only">{labels.owner}</span>
        </span>
      )}
    </div>
  );
}

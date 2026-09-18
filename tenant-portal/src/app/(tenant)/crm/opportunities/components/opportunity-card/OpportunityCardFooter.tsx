"use client";

import { Activity } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  cn,
  iconSize,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
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
  openActivityCount: number;
  onOpenActivities: () => void;
  ownerDisplayName?: string | null;
  ownerAvatarUrl?: string | null;
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
  openActivityCount,
  onOpenActivities,
  ownerDisplayName,
  ownerAvatarUrl,
  labels,
}: OpportunityCardFooterProps) {
  const { lang } = useI18n();
  const toneState = mapOpportunityActivityState(activityState);
  const initials = ownerDisplayName
    ?.split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (Array.from(part)[0] ?? "").toUpperCase())
    .join("");

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
          className="shrink-0 gap-1 px-1"
        >
          <Activity
            strokeWidth={2.5}
            className={cn(iconSize({ size: "sm" }), CRM_ACTIVITY_MARK[toneState])}
            aria-hidden="true"
          />
          <span className="text-2xs text-muted-foreground" aria-hidden="true">
            {formatNumber(openActivityCount, lang)}
          </span>
          <span className="sr-only">{labels.activity}</span>
        </Button>
      </div>

      {ownerDisplayName && (
        <span
          title={labels.owner}
          className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
        >
          <Avatar className="size-6 shrink-0">
            <AvatarImage src={ownerAvatarUrl ?? undefined} alt="" />
            <AvatarFallback className="text-2xs">{initials}</AvatarFallback>
          </Avatar>
          <span className="max-w-24 truncate" aria-hidden="true">
            {ownerDisplayName}
          </span>
          <span className="sr-only">{labels.owner}</span>
        </span>
      )}
    </div>
  );
}

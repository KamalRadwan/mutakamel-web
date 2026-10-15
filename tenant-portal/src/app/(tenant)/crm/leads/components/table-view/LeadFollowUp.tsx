"use client";

import { Activity } from "lucide-react";
import { Button, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { CrmRating } from "../../../shared/components/CrmRating";
import { leadActivityState } from "../../lead-card-contract";
import type { LeadItem } from "../../hooks/useLeads";
import { LEAD_ACTIVITY_MARK } from "../lead-card/activity-tone";

export interface LeadFollowUpProps {
  lead: LeadItem;
  canRate: boolean;
  onRatingChange: (rating: number) => void;
  onOpenActivities: () => void;
}

/** The lead's star rating and its next-activity mark, which opens the activities. */
export function LeadFollowUp({ lead, canRate, onRatingChange, onOpenActivities }: LeadFollowUpProps) {
  const { t } = useI18n();
  const card = t.crmLeads.card;
  const state = leadActivityState(lead.nextActivity);
  const stateLabel = card.activityStates[state];
  const activityLabel = formatTemplate(card.activityOpen, { state: stateLabel });

  return (
    <span className="flex min-w-0 items-center gap-2 whitespace-nowrap">
      <CrmRating
        value={lead.rating}
        disabled={!canRate}
        onChange={onRatingChange}
        labels={{ group: card.rating, setStars: card.rateStars, clear: card.clearRating }}
      />
      <Button
        variant="ghost"
        size="xs"
        className="min-w-0 gap-1 px-1"
        aria-label={activityLabel}
        title={activityLabel}
        onClick={(event) => {
          event.stopPropagation();
          onOpenActivities();
        }}
      >
        <Activity
          strokeWidth={2.5}
          className={cn(iconSize({ size: "sm" }), LEAD_ACTIVITY_MARK[state])}
          aria-hidden="true"
        />
        <span className="max-w-24 truncate text-muted-foreground">{stateLabel}</span>
      </Button>
    </span>
  );
}

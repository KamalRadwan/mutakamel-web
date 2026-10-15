"use client";

import { Activity } from "lucide-react";
import { Button, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { leadActivityState, leadOwnerInitials } from "../../lead-card-contract";
import type { LeadItem } from "../../hooks/useLeads";
import { LEAD_ACTIVITY_MARK } from "../lead-card/activity-tone";
import { LeadBoardCardDetails } from "./LeadBoardCardDetails";
import { LeadBoardRating } from "./LeadBoardRating";

interface LeadBoardCardFooterProps {
  lead: LeadItem;
  isExpanded: boolean;
  canUpdate: boolean;
  onRatingChange: (rating: number) => void;
  onOpenActivities: () => void;
}

/**
 * The strip under the card face: rating, the next-activity mark, the owner —
 * and, on an expanded card, its contact details. It renders outside the
 * activation surface and the drag handle, so none of it opens the lead.
 */
export function LeadBoardCardFooter({
  lead,
  isExpanded,
  canUpdate,
  onRatingChange,
  onOpenActivities,
}: LeadBoardCardFooterProps) {
  const { t } = useI18n();
  const card = t.crmLeads.card;
  const state = leadActivityState(lead.nextActivity);
  // Names the control and states the bucket at once: the mark's colour is the
  // only thing separating "overdue" from "due today".
  const activityLabel = formatTemplate(card.activityOpen, { state: card.activityStates[state] });
  const initials = lead.owner ? leadOwnerInitials(lead.owner) : "";
  const ownerLabel = formatTemplate(card.owner, {
    name: [lead.owner?.firstName, lead.owner?.lastName].filter(Boolean).join(" "),
  });

  return (
    <div className="flex flex-col gap-2">
      {isExpanded && <LeadBoardCardDetails lead={lead} />}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <LeadBoardRating value={lead.rating} onChange={onRatingChange} disabled={!canUpdate} />
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onOpenActivities}
            title={activityLabel}
            className="w-6 shrink-0 px-0"
          >
            <Activity
              strokeWidth={2.5}
              className={cn(iconSize({ size: "sm" }), LEAD_ACTIVITY_MARK[state])}
              aria-hidden="true"
            />
            <span className="sr-only">{activityLabel}</span>
          </Button>
        </div>
        {/* No owner, or one nobody named: a "?" badge would claim the lead is
            unassigned, which is a different fact. */}
        {initials && (
          <span
            title={ownerLabel}
            className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted text-2xs font-medium text-muted-foreground"
          >
            <span aria-hidden="true">{initials}</span>
            <span className="sr-only">{ownerLabel}</span>
          </span>
        )}
      </div>
    </div>
  );
}

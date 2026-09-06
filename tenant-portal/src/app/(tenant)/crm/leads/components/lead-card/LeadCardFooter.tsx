"use client";

import { Activity } from "lucide-react";
import { Button, cn, iconSize } from "@/design-system";
import {
  leadActivityState,
  leadOwnerInitials,
  type LeadNextActivity,
  type LeadOwner,
} from "../../lead-card-contract";
import { LEAD_ACTIVITY_MARK } from "./activity-tone";
import { LeadRating, type LeadRatingLabels } from "./LeadRating";

export interface LeadCardFooterLabels extends LeadRatingLabels {
  /** Already composed — "Activities — overdue". Names the control AND its state. */
  activity: string;
  /** Already composed — "Owner: Kamal Radwan". */
  owner: string;
}

export interface LeadCardFooterProps {
  nextActivity: LeadNextActivity | null;
  owner: LeadOwner | null;
  rating: number;
  onRatingChange: (next: number) => void;
  isRatingDisabled?: boolean;
  /** Opens this lead's activity dialog — the mark IS the trigger. */
  onOpenActivities: () => void;
  labels: LeadCardFooterLabels;
}

/**
 * The card's control strip: when the next activity falls, how the lead is
 * rated, and whose it is.
 *
 * Every mark here is doubled in text. The pulse glyph's colour is the only
 * thing separating "overdue" from "due today", so the same sentence is the
 * button's own accessible name and its tooltip; the owner badge shows two
 * letters and carries the full name.
 *
 * `Activity` and not `Zap`: these are activities with a due date, and a
 * lightning bolt reads as energy or as something instantaneous — the opposite
 * of scheduled. The pulse line is what the icon vocabulary offers for
 * "activity" (Phosphor names its equivalent `Pulse`), and lucide's `Activity`
 * is the same glyph. It is a stroke icon rather than a filled one, so
 * `fill-current` came off with the bolt and the weight went up instead: at
 * 14px a hairline polyline is not a mark.
 */
export function LeadCardFooter({
  nextActivity,
  owner,
  rating,
  onRatingChange,
  isRatingDisabled,
  onOpenActivities,
  labels,
}: LeadCardFooterProps) {
  const initials = owner ? leadOwnerInitials(owner) : "";

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        {/* A real control, and it renders in WorkspaceCard's footer — outside
            the activation surface and outside @hello-pangea/dnd's drag handle
            — so pressing it neither opens the lead nor starts a drag. Squared
            to the rating stars beside it so the strip's height, and with it
            the windowed column's row estimate, does not move. */}
        <Button
          variant="ghost"
          size="xs"
          onClick={onOpenActivities}
          title={labels.activity}
          className="w-6 shrink-0 px-0"
        >
          {/* `strokeWidth` as a prop rather than a Tailwind arbitrary value:
              `stroke-[2.5]` is ambiguous between a stroke colour and a stroke
              width, and lucide takes the number directly. */}
          <Activity
            strokeWidth={2.5}
            className={cn(
              iconSize({ size: "sm" }),
              LEAD_ACTIVITY_MARK[leadActivityState(nextActivity)],
            )}
            aria-hidden="true"
          />
          <span className="sr-only">{labels.activity}</span>
        </Button>

        <LeadRating
          value={rating}
          onChange={onRatingChange}
          disabled={isRatingDisabled}
          labels={labels}
        />
      </div>

      {/* No owner, or an owner nobody named: a badge reading "?" would claim
          the lead is unassigned, which is a different fact. */}
      {initials && (
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

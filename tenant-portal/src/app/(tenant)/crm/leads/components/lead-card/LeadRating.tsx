"use client";

import { Star } from "lucide-react";
import { Button, cn, iconSize } from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import { MAX_LEAD_RATING } from "../../lead-card-contract";

export interface LeadRatingLabels {
  /** Names the whole control. */
  group: string;
  /** `{count}` of `{max}` — what pressing this star will set. */
  setStars: string;
  /** What pressing the star the lead already has will do. */
  clear: string;
}

export interface LeadRatingProps {
  value: number;
  onChange: (next: number) => void;
  /** No update capability: the stars still say what they say, they just do nothing. */
  disabled?: boolean;
  labels: LeadRatingLabels;
}

/**
 * The card's 0-3 rating, as three real buttons.
 *
 * Three buttons rather than one slider or a radio group, because the fourth
 * value — no rating — is not a fourth option a user should have to find. It is
 * what pressing the star you are already on does, and every star's accessible
 * name says which of the two it is about to do.
 *
 * It renders in `WorkspaceCard`'s footer, which is outside both the activation
 * surface and @hello-pangea/dnd's drag handle. That is the whole reason the
 * footer slot exists: a star inside the handle would open the lead on click
 * and be a control nested in a role="button" besides.
 */
export function LeadRating({ value, onChange, disabled, labels }: LeadRatingProps) {
  return (
    <div role="group" aria-label={labels.group} className="flex items-center">
      {Array.from({ length: MAX_LEAD_RATING }, (_, index) => {
        const stars = index + 1;
        const isFilled = stars <= value;
        const next = value === stars ? 0 : stars;

        return (
          <Button
            key={stars}
            variant="ghost"
            size="xs"
            disabled={disabled}
            aria-pressed={isFilled}
            aria-label={
              next === 0
                ? labels.clear
                : formatTemplate(labels.setStars, { count: stars, max: MAX_LEAD_RATING })
            }
            onClick={() => onChange(next)}
            // Square, so three of them plus the mark and the owner badge fit
            // across a 280px board column without wrapping.
            className="w-6 px-0"
          >
            <Star
              className={cn(
                iconSize({ size: "sm" }),
                isFilled ? "fill-current text-warning-vivid" : "text-muted-foreground/70",
              )}
              aria-hidden="true"
            />
          </Button>
        );
      })}
    </div>
  );
}

"use client";

import { Star } from "lucide-react";
import { Button, cn, iconSize } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { MAX_LEAD_RATING } from "../../lead-card-contract";

interface LeadBoardRatingProps {
  value: number;
  onChange: (next: number) => void;
  /** No update capability: the stars still say what they say, they just do nothing. */
  disabled?: boolean;
}

/**
 * The 0-3 rating as three real buttons. "No rating" is not a fourth option:
 * pressing the star the lead already has clears it, and every star's
 * accessible name says which of the two it is about to do.
 */
export function LeadBoardRating({ value, onChange, disabled }: LeadBoardRatingProps) {
  const { t } = useI18n();
  const card = t.crmLeads.card;

  return (
    <div role="group" aria-label={card.rating} className="flex items-center">
      {Array.from({ length: MAX_LEAD_RATING }, (_, index) => {
        const stars = index + 1;
        const isFilled = stars <= value;
        const isCurrent = value === stars;
        return (
          <Button
            key={stars}
            type="button"
            variant="ghost"
            size="xs"
            disabled={disabled}
            aria-pressed={isFilled}
            aria-label={
              isCurrent
                ? card.clearRating
                : formatTemplate(card.rateStars, { count: stars, max: MAX_LEAD_RATING })
            }
            onClick={() => onChange(isCurrent ? 0 : stars)}
            className="w-6 px-0"
          >
            <Star
              className={cn(
                iconSize({ size: "sm" }),
                isFilled && "fill-current text-warning-vivid",
                !isFilled && "text-muted-foreground/70",
              )}
              aria-hidden="true"
            />
          </Button>
        );
      })}
    </div>
  );
}

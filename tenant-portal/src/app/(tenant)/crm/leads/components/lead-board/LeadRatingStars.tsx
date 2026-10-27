"use client";

import { Star } from "lucide-react";
import { Button, cn, hitTarget } from "@/design-system";
import { useAccessMode } from "@/hooks/useAccessMode";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { CRM_RATING_STARS, MAX_CRM_RATING } from "../../../shared/crm-rating-contract";

interface LeadRatingStarsProps {
  rating: number;
  canUpdate: boolean;
  onRate: (nextRating: number) => void;
}

export function LeadRatingStars({ rating, canUpdate, onRate }: LeadRatingStarsProps) {
  const { t } = useI18n();
  const { canMutate } = useAccessMode();
  const cardDict = t.crmLeads.card;

  if (!canMutate) {
    return (
      <div
        className="flex shrink-0 items-center gap-0.5"
        role="img"
        aria-label={formatTemplate(cardDict.ratingValue, {
          count: String(rating),
          max: String(MAX_CRM_RATING),
        })}
      >
        {CRM_RATING_STARS.map((star) => {
          const filled = star <= rating;
          return (
            <Star
              key={star}
              className={cn(
                "size-[13.5px] shrink-0",
                filled ? "fill-star-filled text-star-filled" : "text-star-empty",
              )}
              aria-hidden="true"
            />
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center gap-0.5"
      role="group"
      aria-label={cardDict.rating}
    >
      {CRM_RATING_STARS.map((star) => {
        const filled = star <= rating;
        return (
          <Button
            key={star}
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canUpdate}
            aria-pressed={rating === star}
            aria-label={formatTemplate(cardDict.rateStars, {
              count: String(star),
              max: String(MAX_CRM_RATING),
            })}
            onClick={() => onRate(rating === star ? 0 : star)}
            className={cn(
              hitTarget,
              "h-6 w-4 p-0 transition-transform not-disabled:hover:scale-110 not-disabled:hover:bg-transparent disabled:cursor-default disabled:opacity-100",
            )}
          >
            <Star
              className={cn(
                "size-[13.5px] shrink-0",
                filled ? "fill-star-filled text-star-filled" : "text-star-empty",
              )}
              aria-hidden="true"
            />
          </Button>
        );
      })}
    </div>
  );
}

"use client";

import { Star } from "lucide-react";
import { Button, cn, hitTarget } from "@/design-system";
import { CRM_RATING_STARS } from "../../crm-rating-contract";

export function CrmRatingStars({
  value,
  onChange,
  ariaLabel,
  starLabel,
  disabled = false,
  className,
}: {
  value: number;
  onChange?: (next: number) => void;
  ariaLabel: string;
  starLabel?: (n: number) => string;
  disabled?: boolean;
  className?: string;
}) {
  if (!onChange) {
    return (
      <div
        className={cn("flex shrink-0 items-center gap-0.5", className)}
        role="img"
        aria-label={ariaLabel}
      >
        {CRM_RATING_STARS.map((star) => {
          const filled = star <= value;
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
      className={cn("flex shrink-0 items-center gap-0.5", className)}
      role="group"
      aria-label={ariaLabel}
    >
      {CRM_RATING_STARS.map((star) => {
        const filled = star <= value;
        return (
          <Button
            key={star}
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-pressed={value === star}
            aria-label={starLabel ? starLabel(star) : String(star)}
            onClick={() => onChange(value === star ? 0 : star)}
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

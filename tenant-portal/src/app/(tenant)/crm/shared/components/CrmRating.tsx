"use client";

import { Star } from "lucide-react";
import { Button, cn, iconSize } from "@/design-system";
import { formatTemplate } from "@/lib/format/template";

export const MAX_CRM_RATING = 3;

export interface CrmRatingLabels {
  group: string;
  setStars: string;
  clear: string;
}

export interface CrmRatingProps {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  labels: CrmRatingLabels;
}

export function CrmRating({ value, onChange, disabled, labels }: CrmRatingProps) {
  return (
    <div role="group" aria-label={labels.group} className="flex items-center">
      {Array.from({ length: MAX_CRM_RATING }, (_, index) => {
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
                : formatTemplate(labels.setStars, { count: stars, max: MAX_CRM_RATING })
            }
            onClick={(e) => {
              e.stopPropagation();
              onChange(next);
            }}
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

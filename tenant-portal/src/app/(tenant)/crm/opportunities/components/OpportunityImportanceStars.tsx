"use client";

import { Star } from "lucide-react";
import { cn } from "@/design-system";

interface OpportunityImportanceStarsProps {
  importance: number;
  onChange?: (next: number) => void;
  label?: string;
  className?: string;
}

// A priority rating, not an outcome — caution is the closest semantic hue
// ("needs attention") without inventing a new raw color for it.
export function OpportunityImportanceStars({ importance, onChange, label, className }: OpportunityImportanceStarsProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} title={label}>
      {[1, 2, 3].map((star) => (
        <button
          key={star}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onChange?.(star === 1 && importance === 1 ? 0 : star);
          }}
          disabled={!onChange}
          className="transition-transform hover:scale-110 disabled:cursor-default disabled:hover:scale-100"
        >
          <Star
            className={cn(
              "size-3.5 transition-colors",
              star <= importance ? "fill-caution-500 text-caution-500" : "text-ink-300 dark:text-ink-700",
            )}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}

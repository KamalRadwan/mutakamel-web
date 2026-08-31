"use client";

import { Star } from "lucide-react";
import { Button, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";

const STAR_LEVELS = [1, 2, 3] as const;

interface OpportunityImportanceStarsProps {
  importance: number;
  onChange?: (next: number) => void;
  label?: string;
  className?: string;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Star
      className={cn(
        "size-3.5 transition-colors",
        filled ? "fill-caution-500 text-caution-500" : "text-ink-300 dark:text-ink-700",
      )}
      aria-hidden="true"
    />
  );
}

// A priority rating, not an outcome — caution is the closest semantic hue
// ("needs attention") without inventing a new raw color for it.
//
// Two genuinely different components share one name. Without `onChange` this
// is a VALUE: three icons and one accessible label, no controls at all.
// Rendering it as three disabled buttons said "temporarily unavailable" about
// something that is simply being displayed, and put three dead tab stops in
// every board card — primitives.md#readonly-is-not-disabled.
export function OpportunityImportanceStars({
  importance,
  onChange,
  label,
  className,
}: OpportunityImportanceStarsProps) {
  const { t } = useI18n();
  const valueLabel = formatTemplate(t.crmOpportunities.importanceValue, { level: importance });

  if (!onChange) {
    return (
      <div
        className={cn("flex items-center gap-0.5", className)}
        role="img"
        aria-label={label ? `${label}: ${valueLabel}` : valueLabel}
      >
        {STAR_LEVELS.map((star) => (
          <StarIcon key={star} filled={star <= importance} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-0.5", className)} title={label}>
      {STAR_LEVELS.map((star) => {
        // Clicking the only lit star clears the rating. That is a different
        // action, so it gets a different accessible name.
        const clears = star === 1 && importance === 1;
        return (
          <Button
            key={star}
            type="button"
            variant="ghost"
            size="xs"
            aria-label={
              clears
                ? t.crmOpportunities.clearImportance
                : formatTemplate(t.crmOpportunities.setImportance, { level: star })
            }
            aria-pressed={star <= importance}
            onClick={(event) => {
              event.stopPropagation();
              onChange(clears ? 0 : star);
            }}
            className="size-5 p-0"
          >
            <StarIcon filled={star <= importance} />
          </Button>
        );
      })}
    </div>
  );
}

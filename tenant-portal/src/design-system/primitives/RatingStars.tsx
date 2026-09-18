import { Star } from "lucide-react";
import { cn } from "../lib/cn";
import { iconSize } from "../lib/icons";

export interface RatingStarsProps {
  value: number;
  max: number;
  label: string;
}

/** A recorded rating is an image, not an editable or disabled control. */
export function RatingStars({ value, max, label }: RatingStarsProps) {
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex shrink-0 items-center gap-0.5">
      {Array.from({ length: max }, (_, index) => (
        <Star key={index} aria-hidden="true" className={cn(
          iconSize({ size: "sm" }), "fill-current",
          index < value ? "text-warning-vivid" : "text-muted-foreground/70",
        )} />
      ))}
    </span>
  );
}

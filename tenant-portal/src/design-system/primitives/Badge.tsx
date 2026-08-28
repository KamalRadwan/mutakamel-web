import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

// Five tones: the four outcome roles plus neutral for categories. There is
// no "info" tone — a value that isn't an outcome takes neutral, never blue.
export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium w-fit",
  {
    variants: {
      tone: {
        brand: "border-brand-200 bg-brand-100 text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-300",
        positive:
          "border-positive-200 bg-positive-100 text-positive-800 dark:border-positive-800 dark:bg-positive-950 dark:text-positive-300",
        caution:
          "border-caution-200 bg-caution-100 text-caution-800 dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300",
        negative:
          "border-negative-200 bg-negative-100 text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300",
        neutral: "border-border bg-secondary text-secondary-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ tone }), className)} {...props} />
  ),
);
Badge.displayName = "Badge";

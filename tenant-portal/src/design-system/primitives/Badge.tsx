"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

// Five tones: the four outcome roles plus neutral for categories. There is
// no "info" tone and no purple/indigo tone — a value that isn't an outcome
// takes neutral, never blue or purple.
//
// Ported from admin-portal/src/design-system/primitives/Badge.tsx. Two things
// changed and both are the same change underneath: the tones now name the
// `*-subtle` SEMANTIC roles instead of raw ramp steps, and the border is gone.
//
// The roles already carry their own dark values (globals.css declares each one
// twice, under :root and under .dark), so eight `dark:` variants and four
// borders collapse into four class pairs that resolve identically in light —
// bg-*-100 with *-800 ink — and slightly better in dark, where the role's
// *-200 label sits above the *-300 this file hardcoded.
//
// Uppercase + tracking is admin's treatment for the default badge size, undone
// under `rtl:`: Arabic has no letter case, and letter-spacing breaks Naskh
// joins. The `sm` size step (v3 24px pill) omits uppercase in both directions.
export const badgeVariants = cva("inline-flex w-fit items-center gap-1 font-semibold", {
  variants: {
    tone: {
      brand: "bg-info-subtle text-info-subtle-foreground",
      positive: "bg-success-subtle text-success-subtle-foreground",
      caution: "bg-warning-subtle text-warning-subtle-foreground",
      negative: "bg-destructive-subtle text-destructive-subtle-foreground",
      neutral: "bg-muted text-muted-foreground",
    },
    size: {
      default:
        "rounded-sm px-1.5 py-0.5 text-xs uppercase tracking-wide rtl:normal-case rtl:tracking-normal",
      sm: "h-6 rounded-md px-2 text-badge",
    },
  },
  defaultVariants: {
    tone: "neutral",
    size: "default",
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, size, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ tone, size }), className)} {...props} />
  ),
);
Badge.displayName = "Badge";

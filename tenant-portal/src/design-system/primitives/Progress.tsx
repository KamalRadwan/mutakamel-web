"use client";

import { forwardRef } from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "../lib/cn";

export interface ProgressProps
  extends Omit<React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>, "value"> {
  /** Omit (or pass `null`) for an indeterminate bar — a job whose size is unknown. */
  value?: number | null;
  max?: number;
  /** Accessible name. Required: a progressbar with no name announces only a number. */
  label: string;
  /** What the number means when read aloud, e.g. "38 of 50 processed". */
  valueText?: string;
}

/**
 * Determinate and indeterminate progress.
 *
 * Radix supplies `role="progressbar"` plus `aria-valuemin`, `aria-valuemax` and
 * `aria-valuenow`, and correctly omits `aria-valuenow` when the value is null,
 * which is what makes the indeterminate case announce as indeterminate rather
 * than as zero.
 */
export const Progress = forwardRef<React.ComponentRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value = null, max = 100, label, valueText, ...props }, ref) => {
    const indeterminate = value === null || value === undefined;
    const percent = indeterminate ? 0 : Math.min(Math.max(value / max, 0), 1) * 100;

    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={indeterminate ? null : value}
        max={max}
        aria-label={label}
        aria-valuetext={valueText}
        className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full rounded-full bg-primary",
            // Width, not translateX: a block box grows from the inline start,
            // so it mirrors under RTL with no direction branch. It is set, not
            // transitioned — motion.md bans transitioning width.
            //
            // Indeterminate pulses opacity, the one animated property the
            // motion budget already permits, and falls back to a solid bar
            // under prefers-reduced-motion so the "working" state survives as
            // information rather than disappearing with the animation.
            indeterminate && "w-full animate-pulse motion-reduce:animate-none motion-reduce:opacity-70",
          )}
          style={indeterminate ? undefined : { width: `${percent}%` }}
        />
      </ProgressPrimitive.Root>
    );
  },
);
Progress.displayName = "Progress";

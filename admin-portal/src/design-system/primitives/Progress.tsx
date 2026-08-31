"use client";

import { forwardRef } from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { useDirection } from "@radix-ui/react-direction";
import { cn } from "../lib/cn";

export interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /** running = neutral + pulse (no fifth hue for "in progress" — matches
   *  StatusBadge's tone-map.ts treatment); succeeded = success; failed = danger. */
  tone?: "running" | "succeeded" | "failed";
}

const TONE_INDICATOR: Record<NonNullable<ProgressProps["tone"]>, string> = {
  running: "bg-muted-foreground animate-pulse motion-reduce:animate-none",
  succeeded: "bg-success",
  failed: "bg-destructive",
};

export const Progress = forwardRef<React.ComponentRef<typeof ProgressPrimitive.Root>, ProgressProps>(
  ({ className, value, tone = "running", ...props }, ref) => {
    // Radix's own translateX(-N%) fill only reads correctly in LTR; in RTL
    // the bar must fill from the opposite (physical-right) edge instead.
    const dir = useDirection();
    const sign = dir === "rtl" ? "" : "-";

    return (
      <ProgressPrimitive.Root
        ref={ref}
        value={value}
        className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full flex-1 rounded-full transition-transform motion-reduce:transition-none",
            TONE_INDICATOR[tone],
          )}
          style={{ transform: `translateX(${sign}${100 - (value ?? 0)}%)` }}
        />
      </ProgressPrimitive.Root>
    );
  },
);
Progress.displayName = "Progress";

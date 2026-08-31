"use client";

import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { focusRing, hitArea } from "../lib/variants";

/**
 * Accessible native range input with the shared focus and coarse-pointer
 * contract. Consumers may visually layer their own semantic track and meter.
 */
export const Range = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="range"
    className={cn(
      "h-6 w-full accent-primary disabled:cursor-not-allowed disabled:opacity-50",
      focusRing,
      hitArea,
      className,
    )}
    {...props}
  />
));
Range.displayName = "Range";

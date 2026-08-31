"use client";

import { forwardRef } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

export interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  /**
   * Accessible name applied to every thumb. A range slider has two thumbs and
   * a single wrapper label does not name either of them, so this is per-thumb
   * on purpose — pass one label per thumb for a range.
   */
  thumbLabels: string[];
}

/**
 * Radix reads direction from the `DirectionProvider` the app already mounts, so
 * the track fills from the inline start and Left/Right arrow keys move the
 * thumb the way the user sees it — no `dir` branch here.
 */
export const Slider = forwardRef<React.ComponentRef<typeof SliderPrimitive.Root>, SliderProps>(
  ({ className, thumbLabels, ...props }, ref) => (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        "data-[orientation=vertical]:h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        "data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5">
        <SliderPrimitive.Range className="absolute h-full bg-primary data-[orientation=vertical]:w-full" />
      </SliderPrimitive.Track>
      {thumbLabels.map((label) => (
        <SliderPrimitive.Thumb
          key={label}
          aria-label={label}
          className={cn(
            "block size-4 cursor-pointer rounded-full border border-primary bg-card shadow-pop",
            "transition-colors data-[disabled]:cursor-not-allowed",
            focusRing,
          )}
        />
      ))}
    </SliderPrimitive.Root>
  ),
);
Slider.displayName = "Slider";

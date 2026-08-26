"use client";

import { forwardRef } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

export const Switch = forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors",
      "bg-ink-200 data-[state=checked]:bg-brand-500 dark:bg-ink-700",
      "disabled:cursor-not-allowed disabled:opacity-50",
      focusRing,
      className,
    )}
    {...props}
  >
    {/* rtl: flips the thumb travel direction so it always moves toward the
        logical "on" (end) side regardless of writing direction — Tailwind's
        translate-x utility is physical and doesn't mirror on its own. */}
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-4 rounded-full bg-white shadow-pop ring-0 transition-transform",
        "translate-x-0.5 rtl:-translate-x-0.5",
        "data-[state=checked]:translate-x-4 data-[state=checked]:rtl:-translate-x-4",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

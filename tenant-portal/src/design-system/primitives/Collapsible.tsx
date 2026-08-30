"use client";

import { forwardRef } from "react";
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

export const Collapsible = CollapsiblePrimitive.Root;

export const CollapsibleTrigger = forwardRef<
  React.ComponentRef<typeof CollapsiblePrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <CollapsiblePrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-sm transition-colors",
      "disabled:pointer-events-none disabled:opacity-50",
      focusRing,
      className,
    )}
    {...props}
  />
));
CollapsibleTrigger.displayName = "CollapsibleTrigger";

// Like Accordion, this does not animate its height — see the note in
// Accordion.tsx. motion.md bans transitioning `height`, and the keyframe
// version of the same transition is the same ban.
export const CollapsibleContent = forwardRef<
  React.ComponentRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ className, ...props }, ref) => (
  <CollapsiblePrimitive.Content ref={ref} className={cn("overflow-hidden", className)} {...props} />
));
CollapsibleContent.displayName = "CollapsibleContent";

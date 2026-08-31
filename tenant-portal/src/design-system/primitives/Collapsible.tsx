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

// The same single height exception Accordion takes, for the same reason and
// under the same rule — docs/design/motion.md#the-one-height-exception. The
// keyframes ship with `tw-animate-css` and read
// `--radix-collapsible-content-height`; nothing is added to globals.css.
export const CollapsibleContent = forwardRef<
  React.ComponentRef<typeof CollapsiblePrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content>
>(({ className, ...props }, ref) => (
  <CollapsiblePrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden ease-(--ease-out-quart)",
      "data-[state=open]:animate-collapsible-down data-[state=open]:duration-150",
      "data-[state=closed]:animate-collapsible-up data-[state=closed]:duration-100",
      className,
    )}
    {...props}
  />
));
CollapsibleContent.displayName = "CollapsibleContent";

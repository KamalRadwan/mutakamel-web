"use client";

import { forwardRef } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b border-border", className)} {...props} />
));
AccordionItem.displayName = "AccordionItem";

export const AccordionTrigger = forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 cursor-pointer items-center justify-between gap-2 py-3 text-start text-sm font-medium",
        "transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
        focusRing,
        className,
      )}
      {...props}
    >
      {children}
      {/* Rotating a vertical chevron is direction-neutral, so this must not
          also carry an RTL mirror. It is a state swap, not a transition —
          motion.md permits transitions on colour and opacity only. */}
      <ChevronDown
        className="size-4 shrink-0 text-muted-foreground data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = "AccordionTrigger";

// No height animation, deliberately.
//
// docs/design/motion.md bans transitioning `height` outright, and the budget it
// declares complete does not list a disclosure animation at all. The usual
// shadcn recipe (`animate-accordion-down`, driven by
// `--radix-accordion-content-height`) is exactly the banned transition wearing
// a keyframe costume, and the alternative `grid-template-rows` trick is the
// same layout animation by another property.
//
// So the panel opens and closes by hard cut. That is also what every dropdown
// in this app already does, which motion.md notes nobody ever remarked on.
// MASTER-PLAN task 1.42 owns extending the budget if that is ever revisited;
// until it does, this stays uninanimated rather than quietly exceeding it.
export const AccordionContent = forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content ref={ref} className="overflow-hidden text-sm" {...props}>
    <div className={cn("pb-3", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = "AccordionContent";

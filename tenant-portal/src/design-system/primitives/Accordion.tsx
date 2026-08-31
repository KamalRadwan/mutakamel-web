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

// The one height animation in the system, added by MASTER-PLAN task 1.42.
//
// motion.md previously banned this outright, and the ban is now narrowed
// rather than dropped — see docs/design/motion.md#the-one-height-exception.
// The general rule still stands: never TRANSITION height, width, or a layout
// transform. What is permitted is a keyframe over a height the LIBRARY has
// already measured, on a disclosure panel, and nowhere else.
//
// It earns the exception on the budget's own first job — explain where
// something came from. Without it a long accordion snaps everything below it
// up or down under the pointer, which is the layout-jump the animation exists
// to prevent.
//
// The keyframes come from `tw-animate-css`, which already ships
// `accordion-down` / `accordion-up` reading `--radix-accordion-content-height`.
// No rule is added to globals.css.
//
// Under `prefers-reduced-motion` the global reset collapses this to a hard
// cut, and — unlike the pending dot and the spinner — **nothing is lost**: the
// open state is carried by `aria-expanded` and by the chevron.
export const AccordionContent = forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden text-sm ease-(--ease-out-quart)",
      "data-[state=open]:animate-accordion-down data-[state=open]:duration-150",
      "data-[state=closed]:animate-accordion-up data-[state=closed]:duration-100",
    )}
    {...props}
  >
    <div className={cn("pb-3", className)}>{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = "AccordionContent";

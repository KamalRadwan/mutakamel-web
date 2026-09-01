"use client";

import { forwardRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "../lib/cn";
import { focusRing, hitArea } from "../lib/variants";

// Ported from admin-portal/src/design-system/primitives/Tabs.tsx.
//
// This was the last structural disagreement between the two portals: tenant
// drew a segmented control (a `bg-muted` track, an active pill lifted with
// `shadow-pop`), admin draws an underline. The Radix API is identical either
// way, so this is a pure restyle — no call site changes.
//
// Underline wins on the merits, not just for parity. The pill spends a filled
// surface and an elevation on navigation that is not a control, and
// `shadow-pop` is reserved for things genuinely floating above the document
// (docs/design/geometry.md#elevation) — a selected tab is not one. The
// underline also survives a long tab label without the track reflowing.
export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    // min-h, not h: the rule underneath has to sit below the tallest trigger,
    // and a fixed height clips a wrapped label instead of growing with it.
    className={cn("inline-flex min-h-(--size-control-md) items-center gap-1 border-b border-border", className)}
    {...props}
  />
));
TabsList.displayName = "TabsList";

export const TabsTrigger = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "relative inline-flex h-(--size-control-md) items-center px-1 text-sm font-medium text-muted-foreground transition-colors motion-reduce:transition-none",
      "hover:text-foreground",
      "data-[state=active]:text-foreground",
      // The underline is always laid out, transparent until active, so
      // selecting a tab changes a colour rather than the box — nothing below
      // the list shifts by a pixel. -bottom-px lands it ON the list's border.
      "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent",
      "data-[state=active]:after:bg-primary",
      // Kept from this portal's own version — admin has no disabled state on
      // a tab, and losing it would be a regression, not parity.
      "disabled:pointer-events-none disabled:opacity-50",
      focusRing,
      hitArea,
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-4", focusRing, className)} {...props} />
));
TabsContent.displayName = "TabsContent";

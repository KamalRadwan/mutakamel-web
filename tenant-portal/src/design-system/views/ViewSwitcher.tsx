"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { CalendarDays, Columns3, LayoutGrid, Rows3, type LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/Tooltip";
import type { WorkspaceView } from "./types";

const VIEW_ICONS: Record<WorkspaceView, LucideIcon> = {
  board: Columns3,
  card: LayoutGrid,
  table: Rows3,
  calendar: CalendarDays,
};

// Generic over the screen's own view set, so a record workspace passes
// board/card/table and Activities calendar/board/table, and `labels` has to
// name exactly the views on offer.
export interface ViewSwitcherProps<V extends WorkspaceView> {
  value: V;
  onChange: (view: V) => void;
  // In the order the switcher draws them.
  available: readonly V[];
  labels: Record<V, string>;
}

// A segmented radiogroup, not three independent buttons — Radix RadioGroup
// gives roving tabindex and arrow-key navigation for free, and every view
// shares one active treatment (bg-gradient-primary) rather than per-view
// rainbow hues (see D10 in docs/build/DEFECTS.md and specs/crm-leads-v3.md §3B).
export function ViewSwitcher<V extends WorkspaceView>({ value, onChange, available, labels }: ViewSwitcherProps<V>) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      // Radix reports a plain string. Matching it against the views on offer
      // keeps the callback typed to the screen's own set without a cast.
      onValueChange={(next) => {
        const view = available.find((candidate) => candidate === next);
        if (view) onChange(view);
      }}
      className="inline-flex h-(--size-toolbar-control) items-center gap-0.5 rounded-lg border border-line-control bg-surface-subtle p-0.5"
    >
      {available.map((view) => {
        const Icon: LucideIcon = VIEW_ICONS[view];
        const isActive = view === value;
        return (
          <Tooltip key={view}>
            <TooltipTrigger asChild>
              <RadioGroupPrimitive.Item
                value={view}
                aria-label={labels[view]}
                className={cn(
                  "flex h-full w-7 cursor-pointer items-center justify-center rounded-md transition-colors",
                  isActive
                    ? "bg-gradient-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                  focusRing,
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </RadioGroupPrimitive.Item>
            </TooltipTrigger>
            <TooltipContent>{labels[view]}</TooltipContent>
          </Tooltip>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}

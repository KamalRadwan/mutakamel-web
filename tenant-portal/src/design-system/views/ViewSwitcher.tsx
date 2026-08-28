import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Columns3, LayoutGrid, Rows3 } from "lucide-react";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";
import { Tooltip, TooltipContent, TooltipTrigger } from "../primitives/Tooltip";

export type WorkspaceView = "board" | "card" | "table";

const VIEW_ICONS: Record<WorkspaceView, typeof Columns3> = {
  board: Columns3,
  card: LayoutGrid,
  table: Rows3,
};

export interface ViewSwitcherProps {
  value: WorkspaceView;
  onChange: (view: WorkspaceView) => void;
  available: WorkspaceView[];
  labels: Record<WorkspaceView, string>;
}

// A segmented radiogroup, not three independent buttons — Radix RadioGroup
// gives roving tabindex and arrow-key navigation for free, and the active
// option is bg-secondary, never a colored fill (that was the hue-coded
// switcher this replaces — three hues for one control; see D10 in
// docs/build/DEFECTS.md).
export function ViewSwitcher({ value, onChange, available, labels }: ViewSwitcherProps) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(next) => onChange(next as WorkspaceView)}
      className="inline-flex items-center gap-0.5 rounded-sm border border-border bg-card p-0.5"
    >
      {available.map((view) => {
        const Icon = VIEW_ICONS[view];
        return (
          <Tooltip key={view}>
            <TooltipTrigger asChild>
              <RadioGroupPrimitive.Item
                value={view}
                aria-label={labels[view]}
                className={cn(
                  "flex size-7 items-center justify-center rounded-xs text-muted-foreground",
                  "data-[state=checked]:bg-secondary data-[state=checked]:text-secondary-foreground",
                  "hover:text-foreground",
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

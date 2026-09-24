"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { iconSize, mirrorInRtl } from "../../lib/icons";
import { Button } from "../../primitives/Button";
import { ToggleGroup, ToggleGroupItem } from "../../primitives/ToggleGroup";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../primitives/Tooltip";
import type { CalendarMode } from "./calendar-range";
import type { CalendarViewLabels } from "./types";

const MODES: readonly CalendarMode[] = ["month", "week", "day"];

interface CalendarToolbarProps {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  title: string;
  titleId: string;
  onStep: (step: 1 | -1) => void;
  onToday: () => void;
  end?: ReactNode;
  labels: CalendarViewLabels;
}

// Icon-only, so named twice: `aria-label` for assistive technology and a
// Tooltip for everyone else — docs/design/accessibility.md.
function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" aria-label={label} onClick={onClick} className="aspect-square px-0">
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// Previous / Today / Next, the range's title, and the Month / Week / Day
// segmented control. The title is a polite live region: stepping through
// periods is announced as the new period, not as nothing.
export function CalendarToolbar({ mode, onModeChange, title, titleId, onStep, onToday, end, labels }: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* The chevrons carry the direction of time, so they mirror under RTL,
          where earlier is to the right — docs/design/icons.md#mirroring. */}
      <div className="flex items-center gap-1">
        <StepButton label={labels.previous} onClick={() => onStep(-1)}>
          <ChevronLeft className={cn(iconSize({ size: "sm" }), mirrorInRtl)} aria-hidden="true" />
        </StepButton>
        <Button variant="outline" size="sm" onClick={onToday}>
          {labels.today}
        </Button>
        <StepButton label={labels.next} onClick={() => onStep(1)}>
          <ChevronRight className={cn(iconSize({ size: "sm" }), mirrorInRtl)} aria-hidden="true" />
        </StepButton>
      </div>

      <h2 id={titleId} aria-live="polite" className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {title}
      </h2>

      {end}

      <ToggleGroup
        type="single"
        size="xs"
        value={mode}
        // Radix reports "" when the pressed item is pressed again; a calendar
        // is always in some mode, so that is ignored rather than passed on.
        onValueChange={(value) => {
          const chosen = MODES.find((candidate) => candidate === value);
          if (chosen) onModeChange(chosen);
        }}
        aria-label={labels.modeLabel}
        className="p-0.5"
      >
        {MODES.map((candidate) => (
          <ToggleGroupItem key={candidate} value={candidate}>
            {labels[candidate]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

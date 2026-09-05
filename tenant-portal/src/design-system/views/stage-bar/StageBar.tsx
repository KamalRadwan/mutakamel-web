"use client";

import { cn } from "../../lib/cn";
import { Button } from "../../primitives/Button";

export interface StageBarStep {
  id: string;
  label: string;
  /** Rows currently in this stage. Omitted while the count is unknown. */
  count?: number;
  /** An outcome stage paints its role; an intermediate one never does. */
  tone?: "positive" | "negative";
}

export interface StageBarProps {
  steps: StageBarStep[];
  /** The chosen stage, or `undefined` for "every stage". */
  value?: string;
  onChange: (next: string | undefined) => void;
  /** Accessible name for the group. */
  label: string;
  /** The leading step that clears the filter. */
  allLabel: string;
  allCount?: number;
  disabled?: boolean;
  className?: string;
}

// The arrow is a clip-path, not a rotated square or a border trick: those two
// leave a seam on a non-integer device pixel ratio, and a border chevron
// cannot take a background. 12px is the depth of the point; the inline padding
// below clears it so a label never runs into the notch.
//
// Three shapes rather than one: the first step has no notch cut out of its
// start edge and the last has no point on its end edge, so the bar reads as
// one object with a beginning and an end instead of a row of loose arrows.
const CHEVRON_FIRST =
  "[clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%)]";
const CHEVRON_MIDDLE =
  "[clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%,12px_50%)]";
const CHEVRON_LAST = "[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,12px_50%)]";

// `not-disabled:hover:` and not a bare `hover:`, on every one of these.
// `Button`'s ghost variant paints `not-disabled:hover:bg-accent`, which is two
// pseudo-classes to a bare `hover:`'s one — so a plain `hover:bg-…` here loses
// on SPECIFICITY however late it appears, and every segment turned grey under
// the pointer whatever state it was in. Matching the variant's own selector
// shape makes them one tailwind-merge group, so the later simply wins.
const TONE_ACTIVE: Record<string, string> = {
  positive: "bg-positive-600 text-white not-disabled:hover:bg-positive-600",
  negative: "bg-negative-600 text-white not-disabled:hover:bg-negative-600",
};

/**
 * The pipeline's stages as one chevron bar, above a card or table view.
 *
 * A board shows its stages as columns; a card or table view has nowhere to put
 * them, and without this the stage a row is in is just another text cell. The
 * bar restores the shape of the pipeline to the two views that lose it, and
 * doubles as the filter — pressing a stage narrows the list to it, pressing it
 * again clears.
 *
 * Selection is conveyed by fill AND by `aria-pressed`, never by colour alone.
 * The outcome stages take their role colour when active; an intermediate stage
 * never takes a hue, which is the same rule the board's columns follow.
 *
 * The chevrons are mirrored under RTL by flipping the button and flipping the
 * label back — the arrow follows the reading direction, the text does not.
 */
export function StageBar({
  steps,
  value,
  onChange,
  label,
  allLabel,
  allCount,
  disabled,
  className,
}: StageBarProps) {
  const entries: StageBarStep[] = [{ id: "", label: allLabel, count: allCount }, ...steps];

  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex w-full min-w-0 items-stretch overflow-x-auto", className)}
    >
      {entries.map((entry, index) => {
        const isAll = entry.id === "";
        const active = isAll ? value === undefined : value === entry.id;
        const shape =
          index === 0 ? CHEVRON_FIRST : index === entries.length - 1 ? CHEVRON_LAST : CHEVRON_MIDDLE;

        return (
          <Button
            key={entry.id || "__all__"}
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(active && !isAll ? undefined : entry.id || undefined)}
            className={cn(
              "min-w-0 shrink-0 justify-center gap-1.5 rounded-none border-0 font-normal",
              "ps-6 pe-5 rtl:-scale-x-100",
              index === 0 && "ps-4",
              index > 0 && "-ms-3",
              shape,
              active
                ? (entry.tone && TONE_ACTIVE[entry.tone]) ||
                  "bg-brand-600 text-white not-disabled:hover:bg-brand-600"
                : "bg-muted text-muted-foreground not-disabled:hover:bg-accent",
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5 rtl:-scale-x-100">
              <span className="truncate">{entry.label}</span>
              {entry.count !== undefined && (
                <span className="shrink-0 font-mono text-2xs tabular-nums opacity-80">
                  {entry.count}
                </span>
              )}
            </span>
          </Button>
        );
      })}
    </div>
  );
}

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
  /**
   * A destination this record may not be moved to — a lead's `CONVERTED`
   * stage, which conversion owns and a stage move is refused for. Disabled
   * rather than hidden: the pipeline still has that stage in it, and a bar
   * missing a step tells a reader the pipeline is shorter than it is.
   */
  disabled?: boolean;
}

/**
 * The bar does three different jobs, and `allLabel` + `onChange` are what say
 * which — there is no `mode` prop to keep in step with them.
 *
 * | `allLabel` | `onChange` | What it is |
 * | --- | --- | --- |
 * | given | given | **A filter.** Steps are toggles: `aria-pressed`, and pressing the active one clears back to "every stage" |
 * | omitted | given | **A stage move.** One record, one current stage: `aria-current="step"`, and pressing the current one does nothing because there is nowhere to go |
 * | omitted | omitted | **A picture.** Nothing is pressable |
 *
 * The "every stage" step is what makes it a filter, so a bar without one is
 * never a toggle group — which is also why the move bar must not report
 * `aria-pressed`: a screen reader would announce "not pressed" on four stages
 * a record simply is not in.
 */
export interface StageBarProps {
  steps: StageBarStep[];
  /** The chosen stage, or `undefined` for "every stage". */
  value?: string;
  /** Omit on a bar that only SHOWS a stage; the steps are then not pressable. */
  onChange?: (next: string | undefined) => void;
  /** Accessible name for the group. */
  label: string;
  /**
   * The leading step that clears the filter. **Omit it on a bar that does not
   * filter**: a detail screen draws the pipeline with one stage marked, and
   * there is nothing there for an "every stage" step to clear.
   */
  allLabel?: string;
  allCount?: number;
  /** The whole bar — a move in flight, or a record nobody may move. */
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
  // See the table on StageBarProps. The "every stage" step is what makes this a
  // filter; without it the bar is one record's own stage, either movable or a
  // picture.
  const isFilter = allLabel !== undefined;
  const readOnly = onChange === undefined;
  const entries: StageBarStep[] = isFilter
    ? [{ id: "", label: allLabel, count: allCount }, ...steps]
    : steps;

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
            // The current step on a move bar is NOT `disabled`. It has nowhere
            // to go, so its click does nothing — but `Button`'s disabled style
            // is 50% opacity, and half-fading the one step that says where the
            // record actually stands made a working bar look switched off.
            // `aria-current` already tells assistive tech it is not a
            // destination; `cursor-default` says the same to a pointer.
            disabled={disabled || readOnly || entry.disabled}
            // Only a filter is a toggle group. On a move bar `aria-pressed`
            // would announce "not pressed" on every stage the record is not in,
            // which is a state it does not have; `aria-current` says the one
            // true thing instead.
            aria-pressed={isFilter ? active : undefined}
            aria-current={!isFilter && active ? "step" : undefined}
            onClick={() => {
              if (!isFilter) {
                // A move, not a toggle: never send `undefined`, which the
                // filter path uses to mean "clear".
                if (!active) onChange?.(entry.id);
                return;
              }
              onChange?.(active && !isAll ? undefined : entry.id || undefined);
            }}
            className={cn(
              "min-w-0 shrink-0 justify-center gap-1.5 rounded-none border-0 font-normal",
              "ps-6 pe-5 rtl:-scale-x-100",
              index === 0 && "ps-4",
              index > 0 && "-ms-3",
              shape,
              active
                ? (entry.tone && TONE_ACTIVE[entry.tone]) ||
                  "bg-brand-600 text-white not-disabled:hover:bg-brand-600"
                : // A step on a MOVE bar is a destination, so it reads as one:
                  // a full-strength label rather than the filter's "not
                  // selected" grey. `text-muted-foreground` is right when the
                  // step is a filter nobody has chosen; on a move bar it made
                  // every stage look switched off.
                  isFilter
                  ? "bg-muted text-muted-foreground not-disabled:hover:bg-accent"
                  : "bg-muted text-foreground not-disabled:hover:bg-accent not-disabled:hover:text-accent-foreground",
              // Nowhere to go from where you already are.
              !isFilter && active && "cursor-default",
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

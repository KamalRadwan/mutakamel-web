"use client";

import type { CSSProperties } from "react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/Button";
import type { CalendarViewProps } from "./types";
import type { CalendarStopProps } from "./useCalendarFocus";

// Neutral by default; `itemClassName` repaints it, and only an outcome or a
// due state may take a hue — a type never does (docs/design/tokens.md).
const SURFACE = {
  // One line: a month day stacks up to three of these.
  month: "h-auto min-h-6 w-full justify-start rounded-sm border border-border bg-muted px-1.5 py-0.5 text-start text-xs font-normal",
  // Absolutely placed by the time grid; its height is the duration, so it
  // comes from `style`, never from a class.
  timed:
    "absolute h-auto flex-col items-stretch justify-start overflow-hidden whitespace-normal rounded-sm border border-border bg-muted p-1 text-start text-xs font-normal",
} as const;

const CONTENT = {
  month: "block min-w-0 flex-1 truncate",
  timed: "block min-h-0 w-full overflow-hidden",
} as const;

interface CalendarItemProps<T> {
  view: CalendarViewProps<T>;
  item: T;
  layout: "month" | "timed";
  stop: CalendarStopProps;
  style?: CSSProperties;
  className?: string;
}

// The activation surface the view owns around the caller's content: a real
// Button, so focus, Enter and Space come from the primitive. Its accessible
// name is `itemLabel`, because the content is a picture of the item whose time
// the grid conveys by position alone.
export function CalendarItem<T>({ view, item, layout, stop, style, className }: CalendarItemProps<T>) {
  const surface = cn(SURFACE[layout], view.itemClassName?.(item), className);
  const content = view.renderItem(item, layout);
  const activate = view.onItemActivate;

  if (!activate) {
    // Nothing to open, so nothing to focus — the grid leaves it out of its
    // stops — but it still needs its name, which the content may not spell out.
    return (
      <div style={style} className={cn("flex", surface)}>
        <span className="sr-only">{view.itemLabel(item)}</span>
        <span aria-hidden="true" className={CONTENT[layout]}>
          {content}
        </span>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      style={style}
      className={surface}
      aria-label={view.itemLabel(item)}
      onClick={() => activate(item)}
      {...stop}
    >
      <span className={CONTENT[layout]}>{content}</span>
    </Button>
  );
}

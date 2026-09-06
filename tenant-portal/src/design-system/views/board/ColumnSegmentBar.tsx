"use client";

import { cn } from "../../lib/cn";
import type { BoardColumnSegment } from "./types";

// The four tones as fills. `*-vivid` and not the filled `--destructive` /
// `--warning` / `--success` roles: a 6px bar is a non-text graphic that a
// label already names, so it answers to the 3:1 bar and the dark -700/-800
// steps would read as four muddy greys at this height. `neutral` takes
// `--border`, which is the same "present but not a hue" step an intermediate
// stage column uses.
const SEGMENT_FILL: Record<BoardColumnSegment["tone"], string> = {
  negative: "bg-destructive-vivid",
  caution: "bg-warning-vivid",
  positive: "bg-success-vivid",
  neutral: "bg-border",
};

export interface ColumnSegmentBarProps {
  segments: BoardColumnSegment[];
  /** Names the whole bar, and prefixes the per-segment counts read out with it. */
  label: string;
  className?: string;
}

/**
 * A column's distribution as one horizontal bar, sized by each slice's share.
 *
 * `role="img"` with the counts spelled into `aria-label` is the text
 * equivalent WCAG 1.1.1 asks of a graphic, and it is the reason this renders a
 * label at all rather than four coloured divs: the colours are the only thing
 * separating the segments visually, and a bar whose whole content is colour is
 * unreadable to anyone who cannot see it. The same string is on each slice's
 * `title` so a pointer can read one segment without the whole bar.
 *
 * Proportions come from `flex-grow`, not computed percentages — the browser
 * does the division, so four counts can never round to 101%.
 */
export function ColumnSegmentBar({ segments, label, className }: ColumnSegmentBarProps) {
  const filled = segments.filter((segment) => segment.value > 0);
  // Nothing to divide. An empty bar is a grey strip that says the column is
  // loaded and uniform, which is a different claim from "there is nothing in
  // this column at all".
  if (filled.length === 0) return null;

  const summary = filled.map((segment) => `${segment.label}: ${segment.value}`).join(" · ");

  return (
    <div
      role="img"
      aria-label={`${label} — ${summary}`}
      className={cn("flex h-1.5 w-full overflow-hidden rounded-xs", className)}
    >
      {filled.map((segment) => (
        <span
          key={segment.id}
          title={`${segment.label}: ${segment.value}`}
          style={{ flexGrow: segment.value }}
          className={cn("h-full basis-0", SEGMENT_FILL[segment.tone])}
        />
      ))}
    </div>
  );
}

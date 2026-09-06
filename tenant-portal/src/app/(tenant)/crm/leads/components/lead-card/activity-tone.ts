// One mapping from "when is this lead's next open activity" to a colour, used
// twice: on the card's pulse mark, and on the bar above the column that
// summarises the same four buckets. Two mappings would drift, and the moment
// they did the bar would stop describing the cards under it.

import type { BoardColumnSegment } from "@/design-system";
import {
  leadActivityState,
  type LeadActivityState,
  type LeadNextActivity,
} from "../../lead-card-contract";

/** Ordered soonest-first, which is also the order the bar reads in. */
const LEAD_ACTIVITY_STATES = ["OVERDUE", "TODAY", "FUTURE", "NONE"] as const;

const LEAD_ACTIVITY_TONE: Record<LeadActivityState, BoardColumnSegment["tone"]> = {
  OVERDUE: "negative",
  TODAY: "caution",
  FUTURE: "positive",
  NONE: "neutral",
};

// The mark is a 14px glyph with a text equivalent beside it, so it answers to
// the 3:1 non-text bar and takes the `-vivid` steps rather than the dark filled
// roles — at this size those read as four greys. "None" is the muted role at
// 70%: light enough to say "nothing due", solid enough to still be a mark
// rather than an empty space. The glyph is a STROKE now (lucide `Activity`),
// so the colour reaches it through the stroke rather than through a fill, and
// the mark carries a heavier `strokeWidth` to stay a mark at 14px — same
// token, same contrast question.
export const LEAD_ACTIVITY_MARK: Record<LeadActivityState, string> = {
  OVERDUE: "text-destructive-vivid",
  TODAY: "text-warning-vivid",
  FUTURE: "text-success-vivid",
  NONE: "text-muted-foreground/70",
};

/**
 * The four buckets of one column, as segments.
 *
 * Counted from the leads handed in — never from a server total — so the bar
 * always describes exactly the cards a reader can see beneath it.
 */
export function leadActivitySegments(
  leads: readonly { nextActivity: LeadNextActivity | null }[],
  labels: Record<LeadActivityState, string>,
): BoardColumnSegment[] {
  const counts: Record<LeadActivityState, number> = {
    OVERDUE: 0,
    TODAY: 0,
    FUTURE: 0,
    NONE: 0,
  };
  for (const lead of leads) counts[leadActivityState(lead.nextActivity)] += 1;

  return LEAD_ACTIVITY_STATES.map((state) => ({
    id: state,
    label: labels[state],
    value: counts[state],
    tone: LEAD_ACTIVITY_TONE[state],
  }));
}

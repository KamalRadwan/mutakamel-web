/**
 * Only an outcome stage takes a hue — the rule the board's columns follow too:
 * position and label carry the stage, colour carries the outcome.
 *
 * Declared here rather than per screen because two now draw the same bar: the
 * list, where it filters, and the detail screen, where it shows where one lead
 * stands. Two copies are two chances for one pipeline to be coloured
 * differently on the two screens a user moves between.
 */
export const LEAD_STAGE_BAR_TONE: Record<string, "positive" | "negative" | undefined> = {
  CONVERTED: "positive",
  DISQUALIFIED: "negative",
};

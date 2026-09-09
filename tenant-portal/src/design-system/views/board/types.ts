// One slice of a column's summary bar. `value` is a count, never a
// percentage: the bar divides the width itself, so a caller cannot hand it
// four numbers that fail to add up.
export interface BoardColumnSegment {
  id: string;
  label: string;
  value: number;
  // The four roles a distribution can carry. `neutral` is the "nothing due"
  // slice — deliberately not a hue, for the same reason an intermediate stage
  // has none.
  tone: "negative" | "caution" | "positive" | "neutral";
}

// The strings a column header's own controls need. Declared here rather than
// in BoardView so the column can type them without importing the view that
// renders it. `BoardViewLabels` extends this, so a screen still fills one
// object.
export interface BoardColumnLabels {
  // Both name the ACTION; the column appends its own label, so a screen reader
  // hears "Collapse column: Qualifying" rather than five identical buttons.
  // Required, because an icon-only control with no accessible name is
  // announced as "button", and collapsing is a property of every board rather
  // than a choice a screen makes.
  collapseColumn: string;
  expandColumn: string;
  // Paired with BoardView's `onAddToColumn`: supply both or neither.
  addToColumn?: string;
}

export interface BoardColumnDef {
  id: string;
  label: string;
  count: number;
  // Set by the caller from its own stage-flag -> role mapping (Leads,
  // Opportunities and Customer Profiles each have a different stage enum —
  // see docs/design/views.md#the-grouping-axis--this-is-not-uniform).
  // Intermediate stages carry no color at all.
  outcomeRole?: "positive" | "negative" | "caution";
  amountLabel?: string;
  overdueCount?: number;
  // A distribution bar under the column heading. Rendered only alongside
  // `segmentsLabel`, which names the whole bar in words — the segments are
  // colour, and colour is never the only carrier.
  segments?: BoardColumnSegment[];
  segmentsLabel?: string;
}

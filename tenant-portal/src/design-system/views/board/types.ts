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
}

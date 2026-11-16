/** Inventory decisions are outcomes; source/lifecycle categories stay neutral. */
export function decisionOutcomeTone(value: string | null): "positive" | "negative" | "caution" | "neutral" {
  if (value === "ALLOW") return "positive";
  if (value === "DENY" || value === "BLOCK") return "negative";
  return value === "PARTIAL" || value === "BACKORDER" ? "caution" : "neutral";
}

"use client";

import { Badge, IdentifierText } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { resolveTradeStatus, type TradeStatusKind } from "../trade-document-status";

export interface TradeStatusBadgeProps {
  value: string;
  kind: TradeStatusKind;
  className?: string;
}

// `pending` is not a fifth hue: it is neutral plus the pulsing dot, exactly as
// `StatusBadge` resolves it. Giving an in-progress state a caution colour would
// say "something is wrong" about a document that is merely working.
const TONE = {
  positive: "positive",
  negative: "negative",
  caution: "caution",
  pending: "neutral",
} as const;

/**
 * The Trade equivalent of the design system's `StatusBadge`.
 *
 * It cannot be `StatusBadge`: that pattern's `StatusKind` is a closed union in
 * `design-system/patterns/status-badge/tone-map.ts`, which Phase 11 does not
 * own, and none of the thirteen Trade axes is in it. Everything else about the
 * contract is kept — a text label always, colour only as reinforcement, a
 * pulsing dot for in-progress, and an unmapped value shown verbatim in a
 * monospace face so a backend addition is visible rather than swallowed.
 */
export function TradeStatusBadge({ value, kind, className }: TradeStatusBadgeProps) {
  const { t } = useI18n();
  const { known, role } = resolveTradeStatus(kind, value);
  const label = t.statusValues[`${kind}.${value}`];

  if (!known || !label) {
    return (
      <Badge tone="neutral" className={className}>
        <IdentifierText>{value}</IdentifierText>
      </Badge>
    );
  }

  return (
    <Badge tone={role === null ? "neutral" : TONE[role]} className={className}>
      {role === "pending" && (
        // `bg-current` rather than a ramp step: feature code may not spend a
        // role-ramp utility (docs/design/enforcement.md's census ratchet), and
        // inheriting the badge's own foreground is correct in both themes.
        <span className="dot-pending size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
      )}
      {label}
    </Badge>
  );
}

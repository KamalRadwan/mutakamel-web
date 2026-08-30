"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Badge, type BadgeProps } from "../../primitives/Badge";
import { resolveStatusRole, type StatusKind } from "./tone-map";

export interface StatusBadgeProps {
  value: string;
  kind: StatusKind;
  className?: string;
}

const ROLE_TO_TONE: Record<string, NonNullable<BadgeProps["tone"]>> = {
  positive: "positive",
  negative: "negative",
  caution: "caution",
  pending: "neutral",
};

// Resolves the wire value through docs/design/tokens.md's exhaustive
// enum -> role table, renders Badge with the translated label, and adds the
// pulsing dot when the role is "ink + motion" (pending). Always renders a
// text label — color is reinforcement, never the only signal. An unmapped
// value renders neutral with the raw value in monospace, so a backend
// addition is visible rather than silently swallowed.
export function StatusBadge({ value, kind, className }: StatusBadgeProps) {
  const { t } = useI18n();
  const role = resolveStatusRole(kind, value);
  const label = t.statusValues[`${kind}.${value}`];

  if (!role) {
    return (
      <Badge tone="neutral" className={className}>
        <span className="font-mono">{value}</span>
      </Badge>
    );
  }

  return (
    <Badge tone={ROLE_TO_TONE[role]} className={className}>
      {role === "pending" && (
        <span className="dot-pending size-1.5 shrink-0 rounded-full bg-ink-400" aria-hidden="true" />
      )}
      {label ?? value}
    </Badge>
  );
}

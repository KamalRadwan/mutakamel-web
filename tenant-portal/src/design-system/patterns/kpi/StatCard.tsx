"use client";

import type { LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { cn } from "../../lib/cn";

// Ported from admin-portal/src/design-system/patterns/kpi/StatCard.tsx.
//
// The two portals drew the same metric two different ways: admin stacks the
// label over the value with the icon trailing on the label's line, tenant laid
// it out horizontally with the icon leading in a filled badge. This adopts
// admin's.
//
// The vertical form is the one that survives a grid. Side by side, a horizontal
// tile puts each value at a different x-offset depending on how wide its icon
// badge and label are, so a row of them has no common edge to scan down — which
// is the entire job of a KPI strip. Stacking pins every value to the same start
// edge.
//
// The API only grew, so no existing call site changes: `tone` and `description`
// are new and optional, and `value` widened from `string` to `string | number`.

export type StatTone = "brand" | "warn" | "danger" | "neutral";

const TONE_ICON: Record<StatTone, string> = {
  brand: "border border-success/30 bg-success-subtle text-success",
  warn: "border border-warning/30 bg-warning-subtle text-warning",
  danger: "border border-destructive/30 bg-destructive-subtle text-destructive",
  neutral: "border border-border bg-muted text-muted-foreground",
};

const TONE_TOP_BORDER: Record<StatTone, string> = {
  brand: "border-t-2 border-t-success",
  warn: "border-t-2 border-t-warning",
  danger: "border-t-2 border-t-destructive",
  neutral: "border-t-2 border-t-border",
};

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>{children}</div>
  );
}

export interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  /** Optional semantic accent (top border + icon badge). Omit for the plain neutral-icon look. */
  tone?: StatTone;
  className?: string;
}

export function StatCard({ label, value, description, icon: Icon, tone, className }: StatCardProps) {
  const { lang } = useI18n();
  // Admin reaches for its own `formatLocaleNumber`; this portal's equivalent is
  // `formatNumber`, which takes the language explicitly. Every current call site
  // already passes a formatted string — including one that needs
  // `style: "percent"`, which no default could infer — so this branch serves the
  // plain-count case rather than taking formatting away from callers.
  const displayValue = typeof value === "number" ? formatNumber(value, lang) : value;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        tone && TONE_TOP_BORDER[tone],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {/* No `truncate`, deliberately, and admin has a test pinning it: a
            clipped label with no title attribute is content that a keyboard or
            zoom user can never reach. It wraps instead. */}
        <span className="min-w-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground rtl:normal-case rtl:tracking-normal">
          {label}
        </span>
        {Icon && (
          <span
            className={cn(
              "inline-flex shrink-0 rounded-lg p-1.5",
              tone ? TONE_ICON[tone] : "text-muted-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>
      {/* tabular-nums without font-mono, as admin has it: the figures still
          align column-wise, but a KPI is display type rather than an
          identifier, and the mono face this portal used made a headline number
          read as a code. `identifierText` remains the mono path. */}
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{displayValue}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

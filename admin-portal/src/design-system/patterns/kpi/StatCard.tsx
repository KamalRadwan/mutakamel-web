"use client";

import type { LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { formatLocaleNumber } from "@/i18n/locale";
import { cn } from "../../lib/cn";

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

export function StatCard({
  label,
  value,
  description,
  icon: Icon,
  tone,
  className,
}: {
  label: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  /** Optional semantic accent (top border + icon badge). Omit for the plain neutral-icon look. */
  tone?: StatTone;
  className?: string;
}) {
  const { lang } = useI18n();
  const displayValue = typeof value === "number" ? formatLocaleNumber(lang, value) : value;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        tone && TONE_TOP_BORDER[tone],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
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
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{displayValue}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export type StatTone = "brand" | "warn" | "danger" | "neutral";

const TONE_ICON: Record<StatTone, string> = {
  brand: "bg-brand-500/15 border border-brand-500/30 text-brand-600 dark:text-brand-400",
  warn: "bg-warn-500/15 border border-warn-500/30 text-warn-600 dark:text-warn-400",
  danger: "bg-danger-500/15 border border-danger-500/30 text-danger-600 dark:text-danger-400",
  neutral: "bg-ink-500/15 border border-ink-500/30 text-muted-foreground",
};

const TONE_TOP_BORDER: Record<StatTone, string> = {
  brand: "border-t-2 border-t-brand-500",
  warn: "border-t-2 border-t-warn-500",
  danger: "border-t-2 border-t-danger-500",
  neutral: "border-t-2 border-t-ink-400",
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
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        tone && TONE_TOP_BORDER[tone],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="max-w-[150px] truncate text-2xs font-semibold uppercase tracking-wide text-muted-foreground" title={label}>
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
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {description && <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export interface StatCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  className?: string;
}

// A single metric tile — rounded-md, border + background step, no shadow,
// no accent bar. Value is the KPI numeral scale (text-2xl/600), the ceiling
// of the entire type scale — see docs/design/typography.md#the-7-step-scale.
export function StatCard({ label, value, icon: Icon, className }: StatCardProps) {
  return (
    <div className={cn("flex items-center gap-3 rounded-md border border-border bg-card p-3", className)}>
      {Icon && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted">
          <Icon className="size-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
}

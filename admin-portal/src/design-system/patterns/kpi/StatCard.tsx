import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

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
  className,
}: {
  label: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden="true" />}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      {description && <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

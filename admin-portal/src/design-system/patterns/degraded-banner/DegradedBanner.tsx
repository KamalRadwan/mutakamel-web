import { AlertTriangle } from "lucide-react";
import { cn } from "../../lib/cn";

/**
 * A persistent condition qualifying the data on screen (partial/stale
 * data, an enrichment that failed) — not a one-time event, so it never
 * becomes a toast; it stays visible as long as the condition holds.
 */
export function DegradedBanner({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border border-warning/30 bg-warning-subtle px-3 py-2 text-sm text-warning-subtle-foreground",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

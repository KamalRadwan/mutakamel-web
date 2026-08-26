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
        "flex items-start gap-2 rounded-md border border-warn-200 bg-warn-50 px-3 py-2 text-sm text-warn-800 dark:border-warn-800/60 dark:bg-warn-950/30 dark:text-warn-300",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

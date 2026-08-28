import { Info } from "lucide-react";
import { cn } from "../../lib/cn";

export interface DegradedBannerProps {
  message: string;
  className?: string;
}

// A persistent condition, not an event — partial or stale data. Sits as a
// single-line strip directly under PageHeader; never a toast, which implies
// something just happened.
export function DegradedBanner({ message, className }: DegradedBannerProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-1.5 rounded-sm border border-caution-200 bg-caution-100 px-2.5 py-1.5 text-xs text-caution-800",
        "dark:border-caution-800 dark:bg-caution-950 dark:text-caution-300",
        className,
      )}
    >
      <Info className="size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </div>
  );
}

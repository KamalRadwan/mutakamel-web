import { AlertTriangle } from "lucide-react";
import { Button } from "../../primitives/Button";

export interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

// In-body load failure with a retry affordance a toast cannot host — see
// docs/design/patterns.md#where-a-result-belongs.
export function ErrorState({ title, description, onRetry, retryLabel, className }: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 px-4 py-12 text-center ${className ?? ""}`}>
      <AlertTriangle className="size-8 text-negative-600 dark:text-negative-400" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

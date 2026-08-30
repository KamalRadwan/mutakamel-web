"use client";

import { cn } from "../../lib/cn";
import { Button } from "../../primitives/Button";

export interface BulkAction {
  id: string;
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface BulkActionBarLabels {
  /** Already formatted by the caller through Intl, e.g. "12 selected". */
  selection: string;
  clear: string;
}

export interface BulkActionBarProps {
  /** Drives visibility. The rendered text comes from labels.selection. */
  selectedCount: number;
  actions: BulkAction[];
  onClear: () => void;
  disabled?: boolean;
  className?: string;
  labels: BulkActionBarLabels;
}

// The bar the DataTable's selection state has had nowhere to go since it was
// built (MASTER-PLAN L2). Renders nothing at zero selection rather than an
// empty strip, so it never occupies layout it is not using.
//
// No `primary` variant here: the one filled action on a screen belongs to
// PageHeader (docs/design/README.md#4-one-filled-action-per-screen), and a
// bulk bar that outshouts it is how a screen ends up with two.
export function BulkActionBar({
  selectedCount,
  actions,
  onClear,
  disabled,
  className,
  labels,
}: BulkActionBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div
      role="toolbar"
      aria-label={labels.selection}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-sm border border-border bg-card px-3 py-2",
        className,
      )}
    >
      <span aria-live="polite" className="text-xs font-medium tabular-nums text-foreground">
        {labels.selection}
      </span>

      <div className="flex flex-wrap items-center gap-2 ms-auto">
        {actions.map((action) => (
          <Button
            key={action.id}
            variant={action.destructive ? "destructive" : "outline"}
            size="sm"
            onClick={action.onSelect}
            disabled={disabled || action.disabled}
          >
            {action.label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={onClear} disabled={disabled}>
          {labels.clear}
        </Button>
      </div>
    </div>
  );
}

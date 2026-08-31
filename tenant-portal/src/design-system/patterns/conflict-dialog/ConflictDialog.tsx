"use client";

import { GitCompareArrows } from "lucide-react";
import { cn } from "../../lib/cn";
import { Button } from "../../primitives/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../primitives/Dialog";

export interface ConflictDialogLabels {
  yourChanges: string;
  theirChanges: string;
  reload: string;
  overwrite: string;
  cancel: string;
}

export interface ConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Optional slot: what this user edited. Rendered verbatim. */
  yourChanges?: React.ReactNode;
  /** Optional slot: what the server holds now. Rendered verbatim. */
  theirChanges?: React.ReactNode;
  onReload: () => void;
  /** Omit entirely when overwriting is not permitted — the button disappears. */
  onOverwrite?: () => void;
  onCancel: () => void;
  loading?: boolean;
  labels: ConflictDialogLabels;
  className?: string;
}

// The 409 / 412 / 428 resolution surface. A write was refused because the
// record moved underneath the user, so the only honest options are: take the
// server's version, force yours over it, or walk away with the edit intact.
//
// Every string arrives as a prop — this pattern never reads the dictionary.
// Dismissing by Escape, backdrop or the close button routes through the same
// onCancel as the Cancel button, so an abandoned conflict is never silently
// different from a declined one.
export function ConflictDialog({
  open,
  onOpenChange,
  title,
  description,
  yourChanges,
  theirChanges,
  onReload,
  onOverwrite,
  onCancel,
  loading,
  labels,
  className,
}: ConflictDialogProps) {
  const hasDiff = yourChanges !== undefined || theirChanges !== undefined;

  function dismiss() {
    if (loading) return;
    onCancel();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : dismiss())}>
      <DialogContent
        size={hasDiff ? "2xl" : "lg"}
        showCloseButton={!loading}
        aria-busy={loading || undefined}
        onEscapeKeyDown={(event) => (loading ? event.preventDefault() : undefined)}
        onPointerDownOutside={(event) => (loading ? event.preventDefault() : undefined)}
        className={className}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompareArrows
              className="size-4 shrink-0 text-caution-600 dark:text-caution-400"
              aria-hidden="true"
            />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {hasDiff && (
          <div className="grid gap-3 sm:grid-cols-2">
            <ConflictPane label={labels.yourChanges} tone="mine">
              {yourChanges}
            </ConflictPane>
            <ConflictPane label={labels.theirChanges} tone="theirs">
              {theirChanges}
            </ConflictPane>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={dismiss} disabled={loading}>
            {labels.cancel}
          </Button>
          {onOverwrite && (
            <Button variant="destructive" onClick={onOverwrite} disabled={loading}>
              {labels.overwrite}
            </Button>
          )}
          <Button variant="primary" onClick={onReload} loading={loading}>
            {labels.reload}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConflictPane({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "mine" | "theirs";
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-sm border p-2.5",
        tone === "mine" ? "border-border bg-muted" : "border-caution-200 bg-caution-100 dark:border-caution-800 dark:bg-caution-950",
      )}
    >
      <h3
        className={cn(
          "text-xs font-medium",
          tone === "mine" ? "text-muted-foreground" : "text-caution-800 dark:text-caution-300",
        )}
      >
        {label}
      </h3>
      {/* Wide content scrolls inside its own container — the dialog never
          grows a horizontal scrollbar of its own. */}
      <div className="overflow-x-auto text-xs text-foreground">{children}</div>
    </section>
  );
}

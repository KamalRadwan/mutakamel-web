"use client";

import { Button } from "../../primitives/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../primitives/Dialog";

export interface BulkConfirmDialogLabels {
  confirm: string;
  cancel: string;
}

export interface BulkConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Already formatted by the caller, e.g. "This will delete 50 leads." */
  description: string;
  /** Optional slot naming the affected records, so the user can see what they picked. */
  summary?: React.ReactNode;
  destructive?: boolean;
  onConfirm: () => void;
  loading?: boolean;
  labels: BulkConfirmDialogLabels;
}

// ConfirmActionModal cannot host a list of affected records — its
// AlertDialog body is title plus one description line. A bulk write is the
// case where the user genuinely needs to see the scope before committing, so
// this takes a summary slot and scrolls it inside its own container.
export function BulkConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  summary,
  destructive = false,
  onConfirm,
  loading,
  labels,
}: BulkConfirmDialogProps) {
  function dismiss() {
    if (loading) return;
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : dismiss())}>
      <DialogContent
        showCloseButton={!loading}
        aria-busy={loading || undefined}
        onEscapeKeyDown={(event) => (loading ? event.preventDefault() : undefined)}
        onPointerDownOutside={(event) => (loading ? event.preventDefault() : undefined)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {summary && (
          <div className="max-h-48 overflow-auto rounded-sm border border-border bg-muted p-2.5 text-xs text-foreground">
            {summary}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={dismiss} disabled={loading}>
            {labels.cancel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {labels.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

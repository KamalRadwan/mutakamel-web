"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../primitives/Button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../../primitives/Sheet";
import { ConfirmActionModal } from "../confirm-action/ConfirmActionModal";

export interface FormDrawerLabels {
  submit: string;
  cancel: string;
  discardTitle: string;
  discardDescription: string;
  discardConfirm: string;
  discardCancel: string;
}

export interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  isDirty: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  error?: string;
  labels: FormDrawerLabels;
  children: React.ReactNode;
}

// Create/edit in a Sheet, not a Dialog — a form long enough to need its own
// scrollbar belongs in a drawer. The dirty guard applies identically to
// backdrop click, Escape, and the close button — see
// docs/design/patterns.md#formdrawer.
export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  isDirty,
  isSubmitting,
  onSubmit,
  error,
  labels,
  children,
}: FormDrawerProps) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  function requestClose() {
    if (isDirty) {
      setConfirmingDiscard(true);
    } else {
      onOpenChange(false);
    }
  }

  function confirmDiscard() {
    setConfirmingDiscard(false);
    onOpenChange(false);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
        <SheetContent
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            requestClose();
          }}
          onPointerDownOutside={(event) => {
            event.preventDefault();
            requestClose();
          }}
          className="flex w-full flex-col sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>

          {error && (
            <div className="flex items-start gap-2 rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto">{children}</div>

          <SheetFooter>
            {/* Deliberately not SheetClose — that closes via Radix's own
                context and would bypass the dirty guard below. */}
            <Button variant="outline" onClick={requestClose} disabled={isSubmitting}>
              {labels.cancel}
            </Button>
            <Button variant="primary" onClick={onSubmit} loading={isSubmitting}>
              {labels.submit}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmActionModal
        open={confirmingDiscard}
        onOpenChange={setConfirmingDiscard}
        title={labels.discardTitle}
        description={labels.discardDescription}
        confirmLabel={labels.discardConfirm}
        cancelLabel={labels.discardCancel}
        onConfirm={confirmDiscard}
      />
    </>
  );
}

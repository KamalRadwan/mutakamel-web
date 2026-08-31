"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "../../lib/cn";
import { proseMeasure } from "../../lib/variants";
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
  /** Blocks submit for a reason other than an in-flight request — an unloaded record, a hard validation stop. */
  submitDisabled?: boolean;
  /**
   * Rendered at the footer's inline start, opposite Cancel and Submit.
   *
   * The slot `EditDrawer` puts its destructive action in. Deliberately not a
   * `destructiveAction` prop: this pattern must not decide that the only thing
   * a footer can carry on that side is a delete.
   */
  footerLeading?: React.ReactNode;
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
  submitDisabled,
  footerLeading,
  labels,
  children,
}: FormDrawerProps) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // B2 (SKILL-AUDIT.md): after a rejected submit, focus lands on the FIRST
  // invalid field, not on the submit button. A sighted user sees the toast;
  // a screen-reader user hears "there are errors" and is then sitting on a
  // button with no route to the field that is actually wrong. Arriving on
  // the field is what makes its aria-describedby error text get read.
  // docs/design/patterns.md#focus-after-a-failed-submit.
  //
  // Keyed on isSubmitting and error as well as the attempt itself: a
  // synchronous validation stop renders its errors in the same commit, while
  // a 422 renders them only once the request settles.
  useEffect(() => {
    if (!submitAttempted || isSubmitting) return;
    const firstInvalid = bodyRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    firstInvalid?.focus();
  }, [submitAttempted, isSubmitting, error]);

  // A reopened drawer starts clean; otherwise the previous attempt's focus
  // rule fires against a fresh form. Adjusted during render rather than in an
  // effect — the setState-in-effect form causes a cascading render, and React
  // documents this exact case:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setSubmitAttempted(false);
  }

  function handleSubmit() {
    setSubmitAttempted(true);
    onSubmit();
  }

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
            <div
              role="alert"
              className={cn(
                "flex items-start gap-2 rounded-sm border border-negative-200 bg-negative-100 p-2.5",
                "text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300",
                proseMeasure,
              )}
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 wrap-anywhere">{error}</span>
            </div>
          )}

          <div ref={bodyRef} className="flex-1 overflow-y-auto">
            {children}
          </div>

          <SheetFooter>
            {footerLeading && <div className="me-auto flex items-center gap-2">{footerLeading}</div>}
            {/* Deliberately not SheetClose — that closes via Radix's own
                context and would bypass the dirty guard below. */}
            <Button variant="outline" onClick={requestClose} disabled={isSubmitting}>
              {labels.cancel}
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={submitDisabled}
            >
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

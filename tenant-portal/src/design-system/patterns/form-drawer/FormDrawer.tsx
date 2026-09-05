"use client";

import { useState } from "react";
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
import { FormErrorSummary } from "../form-shell/FormErrorSummary";
import { useFormShell } from "../form-shell/useFormShell";

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

// Create/edit in a Sheet — the default for a form that is a handful of fields
// on one axis. A record form wide enough to want two columns and its own
// section index takes `FormModal` instead — and so does a CRM *create* however
// short, at `size="card"`; see docs/design/patterns.md#formdrawer. The dirty
// guard applies identically to backdrop click, Escape, and the close button.
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
  // A callback ref into state, not a `useRef`: the sheet's content mounts in a
  // later commit than this component's first effect pass, and only a state
  // change can tell the shell's focus rule that the body finally exists.
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const shell = useFormShell({
    body,
    open,
    isDirty,
    isSubmitting,
    error,
    submitDisabled,
    onSubmit,
    onOpenChange,
  });

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : shell.requestClose())}>
        <SheetContent
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            shell.requestClose();
          }}
          onPointerDownOutside={(event) => {
            event.preventDefault();
            shell.requestClose();
          }}
          className="flex w-full flex-col sm:max-w-md"
        >
          {/*
            A real <form>, not a div with a click handler. Without it Enter from
            a text field does nothing, the fields have no form semantics, and
            assistive tech is given a pile of controls with no container saying
            what they are for.

            noValidate is deliberate. Native constraint validation preempts the
            submit event entirely, so `onSubmit` — which is what reveals this
            app's own field errors and runs the focus rule in useFormShell —
            would never fire, and the user would get a transient browser bubble
            in the BROWSER's language instead of a persistent, programmatically
            associated error in the app's. Errors here are inline and ours:
            docs/design/patterns.md#where-a-result-belongs.
          */}
          <form
            noValidate
            onSubmit={shell.handleSubmit}
            className="flex min-h-0 flex-1 flex-col gap-4"
          >
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
              {description && <SheetDescription>{description}</SheetDescription>}
            </SheetHeader>

            <FormErrorSummary error={error} />

            {/* `relative` for the same reason FormModal needs it: Radix
                Select's hidden native <select> is absolutely positioned, and
                without a positioned ancestor it resolves against the sheet
                and escapes this box's clipping. */}
            <div ref={setBody} className="relative flex-1 overflow-y-auto">
              {children}
            </div>

            <SheetFooter>
              {footerLeading && (
                <div className="me-auto flex items-center gap-2">{footerLeading}</div>
              )}
              {/* Deliberately not SheetClose — that closes via Radix's own
                  context and would bypass the dirty guard. */}
              <Button
                type="button"
                variant="outline"
                onClick={shell.requestClose}
                disabled={isSubmitting}
              >
                {labels.cancel}
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting} disabled={submitDisabled}>
                {labels.submit}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmActionModal
        open={shell.confirmingDiscard}
        onOpenChange={shell.setConfirmingDiscard}
        title={labels.discardTitle}
        description={labels.discardDescription}
        confirmLabel={labels.discardConfirm}
        cancelLabel={labels.discardCancel}
        onConfirm={shell.confirmDiscard}
      />
    </>
  );
}

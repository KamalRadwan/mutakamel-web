"use client";

import { useEffect, useState } from "react";

export interface FormShellOptions {
  /**
   * The element wrapping the fields, once it is in the DOM — the caller holds
   * it in state behind a callback ref rather than in a `useRef`.
   *
   * A ref would be wrong twice over. It is not readable during render, and
   * more importantly a `RefObject` cannot re-run this effect: Radix mounts a
   * dialog's portal content in a LATER commit than the component's first
   * effect pass, so a ref read here is null exactly when the surface first
   * opens, and nothing tells the effect to look again.
   */
  body: HTMLElement | null;
  open: boolean;
  isSubmitting: boolean;
  isDirty: boolean;
  /** Re-runs the focus rule when a rejected write renders its field errors late. */
  error?: string;
  submitDisabled?: boolean;
  onSubmit: () => void;
  onOpenChange: (open: boolean) => void;
}

export interface FormShell {
  confirmingDiscard: boolean;
  setConfirmingDiscard: (confirming: boolean) => void;
  /** `<form onSubmit>`. Runs the implicit-submission guard before delegating. */
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  /** Every dismissal route — Escape, backdrop, close button, Cancel — goes through this. */
  requestClose: () => void;
  confirmDiscard: () => void;
}

/**
 * The behaviour every create/edit surface owes the user, independent of
 * whether it is drawn as a drawer or as a dialog.
 *
 * Extracted from `FormDrawer` when `FormModal` arrived: the dirty guard and the
 * focus rule are the two things a second surface would silently get wrong, and
 * a copy would have drifted the moment either was fixed in one place only.
 */
export function useFormShell({
  body,
  open,
  isSubmitting,
  isDirty,
  error,
  submitDisabled,
  onSubmit,
  onOpenChange,
}: FormShellOptions): FormShell {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // B2 (SKILL-AUDIT.md): after a rejected submit, focus lands on the FIRST
  // invalid field, not on the submit button. A sighted user sees the message;
  // a screen-reader user hears "there are errors" and is then sitting on a
  // button with no route to the field that is actually wrong. Arriving on the
  // field is what makes its aria-describedby error text get read.
  // docs/design/patterns.md#focus-after-a-failed-submit.
  //
  // Keyed on isSubmitting and error as well as the attempt itself: a
  // synchronous validation stop renders its errors in the same commit, while a
  // 422 renders them only once the request settles.
  useEffect(() => {
    if (!submitAttempted || isSubmitting) return;
    const firstInvalid = body?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!firstInvalid) return;
    // `preventScroll` then an explicit `nearest` scroll, rather than letting
    // focus() do both: the browser's own version walks EVERY scrollable
    // ancestor, and on a full-screen dialog that included the dialog box
    // itself. Scrolling the one container that actually holds the fields is
    // the whole of what is wanted.
    firstInvalid.focus({ preventScroll: true });
    firstInvalid.scrollIntoView?.({ block: "nearest" });
  }, [body, submitAttempted, isSubmitting, error]);

  // A reopened surface starts clean; otherwise the previous attempt's focus
  // rule fires against a fresh form. Adjusted during render rather than in an
  // effect — the setState-in-effect form causes a cascading render, and React
  // documents this exact case:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setSubmitAttempted(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Implicit submission reaches here from Enter in any field, and unlike a
    // click it is not gated by the submit button's own disabled state.
    if (isSubmitting || submitDisabled) return;
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

  return {
    confirmingDiscard,
    setConfirmingDiscard,
    handleSubmit,
    requestClose,
    confirmDiscard,
  };
}

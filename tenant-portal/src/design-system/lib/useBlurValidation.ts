"use client";

import { useCallback, useState } from "react";

export interface BlurValidation {
  /** The message to hand `Field`'s `error` prop — `undefined` while silent. */
  error: string | undefined;
  /** True when the current value passes, whether or not the error is showing. */
  isValid: boolean;
  /** Spread onto the control inside `Field`. */
  fieldProps: { onBlur: () => void };
  /** Call from a submit handler so a never-blurred field still reveals its error. */
  reveal: () => void;
  /** Call when the form resets, so a reopened drawer starts silent again. */
  reset: () => void;
}

// B10 (SKILL-AUDIT.md) — validate on blur, never on keystroke.
//
// Validating per keystroke marks an email invalid after its first character:
// the user is told they are wrong before they have had a chance to be right.
// So a field stays silent until it loses focus. Once it HAS shown an error it
// re-evaluates on every change, so the message clears the moment the value
// becomes valid rather than making the user blur again to be told they fixed
// it. docs/design/primitives.md#validate-on-blur-not-on-keystroke.
//
// `validate` runs on every render and must therefore be pure and cheap — it is
// a shape check on one field's value, not a request.
export function useBlurValidation<T>(
  value: T,
  validate: (value: T) => string | undefined,
): BlurValidation {
  const [revealed, setRevealed] = useState(false);
  const message = validate(value);

  const reveal = useCallback(() => setRevealed(true), []);
  const reset = useCallback(() => setRevealed(false), []);
  // Blur only ever *starts* showing errors. A blur on a valid field does not
  // arm the field, which is what keeps a later keystroke silent.
  const handleBlur = useCallback(() => {
    setRevealed((current) => current || validate(value) !== undefined);
    // `validate` is read through the current render's closure on purpose:
    // re-creating the handler when it changes identity would reset nothing
    // and only churn the child.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return {
    error: revealed ? message : undefined,
    isValid: message === undefined,
    fieldProps: { onBlur: handleBlur },
    reveal,
    reset,
  };
}

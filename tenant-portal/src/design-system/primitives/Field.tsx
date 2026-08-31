"use client";

import { cloneElement, isValidElement, useId } from "react";
import { cn } from "../lib/cn";
import { proseMeasure } from "../lib/variants";
import { Label } from "./Label";

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /**
   * The value matters and is readable, it just cannot be changed here — B16.
   * Distinct from `disabled`, which says "not applicable, or temporarily
   * unavailable". Pair it with a `hint` naming where the value IS editable.
   */
  readOnly?: boolean;
  className?: string;
  children: React.ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    "aria-required"?: boolean;
    "aria-readonly"?: boolean;
    readOnly?: boolean;
  }>;
}

// The only correct way to render a labelled input — generates a stable
// htmlFor/id pair and wires aria-describedby to hint and error text so a
// screen-reader user can find the problem. A field error is inline here,
// never a toast: see docs/design/patterns.md#where-a-result-belongs.
export function Field({ label, hint, error, required, readOnly, className, children }: FieldProps) {
  const generatedId = useId();
  const hintId = `${generatedId}-hint`;
  const errorId = `${generatedId}-error`;
  // Only reference an id for text that actually renders below — the hint
  // paragraph is suppressed once there is an error (see JSX below), so
  // hintId must drop out here too or aria-describedby dangles.
  const showHint = Boolean(hint) && !error;
  const describedBy = [showHint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  // readOnly is set BOTH ways on purpose: the native attribute is what makes
  // `readOnlySurface`'s read-only:* variants render and what stops typing,
  // and aria-readonly is what a screen reader announces on a control (Radix
  // Select, MultiSelect) that has no native read-only state. Never mapped to
  // `disabled` — dimming a value to 50% claims it does not apply to the user,
  // which is false. docs/design/primitives.md#readonly-is-not-disabled.
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: generatedId,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error),
        "aria-required": required,
        ...(readOnly ? { readOnly: true, "aria-readonly": true } : {}),
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={generatedId}>
        {label}
        {required && (
          <span className="ms-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {control}
      {showHint && (
        <p id={hintId} className={cn("text-xs text-muted-foreground", proseMeasure)}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={cn("text-xs text-destructive", proseMeasure)}>
          {error}
        </p>
      )}
    </div>
  );
}

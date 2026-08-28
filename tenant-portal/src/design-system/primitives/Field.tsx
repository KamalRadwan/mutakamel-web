"use client";

import { cloneElement, isValidElement, useId } from "react";
import { cn } from "../lib/cn";
import { Label } from "./Label";

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
    "aria-required"?: boolean;
  }>;
}

// The only correct way to render a labelled input — generates a stable
// htmlFor/id pair and wires aria-describedby to hint and error text so a
// screen-reader user can find the problem. A field error is inline here,
// never a toast: see docs/design/patterns.md#where-a-result-belongs.
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const generatedId = useId();
  const hintId = `${generatedId}-hint`;
  const errorId = `${generatedId}-error`;
  // Only reference an id for text that actually renders below — the hint
  // paragraph is suppressed once there is an error (see JSX below), so
  // hintId must drop out here too or aria-describedby dangles.
  const showHint = Boolean(hint) && !error;
  const describedBy = [showHint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: generatedId,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error),
        "aria-required": required,
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
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

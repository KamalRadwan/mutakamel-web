"use client";

import { useId } from "react";
import { Label } from "./Label";

export interface FieldRenderProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
}

export interface FieldProps {
  id?: string;
  label: string;
  labelAction?: React.ReactNode;
  hint?: string;
  /**
   * Validation error text. Always renders inline, associated via
   * aria-describedby + role="alert" — never a toast. Field errors must
   * remain a programmatically associated, persistent target for the
   * input (docs/design-system/toast-contract.md).
   */
  error?: string;
  required?: boolean;
  className?: string;
  children: (fieldProps: FieldRenderProps) => React.ReactNode;
}

export function Field({ id, label, labelAction, hint, error, required, className, children }: FieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <Label htmlFor={fieldId}>
          {label}
          {required && (
            <span className="ms-0.5 text-destructive before:content-['*']" aria-hidden="true" />
          )}
        </Label>
        {labelAction}
      </div>
      {children({ id: fieldId, "aria-describedby": describedBy, "aria-invalid": !!error, required })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive-subtle-foreground">
          {error}
        </p>
      )}
    </div>
  );
}

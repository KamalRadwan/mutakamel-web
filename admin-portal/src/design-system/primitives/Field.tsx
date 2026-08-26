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
  label: string;
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

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className ? `space-y-1.5 ${className}` : "space-y-1.5"}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ms-0.5 text-danger-600 dark:text-danger-400" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": !!error, required })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger-600 dark:text-danger-400">
          {error}
        </p>
      )}
    </div>
  );
}

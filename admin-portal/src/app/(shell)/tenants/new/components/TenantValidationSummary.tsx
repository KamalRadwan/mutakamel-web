"use client";

import { forwardRef } from "react";
import { AlertCircle } from "lucide-react";

export interface TenantWizardValidationError {
  fieldId: string;
  message: string;
  step: number;
}

interface TenantValidationSummaryProps {
  errors: readonly TenantWizardValidationError[];
  title: string;
  description: string;
  onFieldFocus: (fieldId: string) => void;
}

export const TenantValidationSummary = forwardRef<
  HTMLDivElement,
  TenantValidationSummaryProps
>(function TenantValidationSummary(
  { errors, title, description, onFieldFocus },
  ref,
) {
  if (errors.length === 0) return null;

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby="tenant-validation-summary-title"
      aria-describedby="tenant-validation-summary-description"
      className="rounded-md border border-destructive/30 bg-destructive-subtle p-3 text-destructive-subtle-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <h2 id="tenant-validation-summary-title" className="text-xs font-semibold">
            {title}
          </h2>
          <p id="tenant-validation-summary-description" className="mt-0.5 text-xs">
            {description}
          </p>
          <ul className="mt-1.5 list-disc space-y-0.5 ps-4 text-xs">
            {errors.map((error) => (
              <li key={error.fieldId}>
                <a
                  href={`#${error.fieldId}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onFieldFocus(error.fieldId);
                  }}
                  className="inline-flex min-h-5 items-center rounded-sm font-medium underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {error.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
});

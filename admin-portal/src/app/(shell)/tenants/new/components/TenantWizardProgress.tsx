"use client";

import { CheckCircle2, CircleDot } from "lucide-react";
import { Button } from "@/design-system";

export interface TenantWizardStep {
  number: number;
  label: string;
}

interface TenantWizardProgressProps {
  steps: readonly TenantWizardStep[];
  currentStep: number;
  navigationLabel: string;
  currentLabel: string;
  completedLabel: string;
  disabled?: boolean;
  onStepChange: (step: number) => void;
}

export function TenantWizardProgress({
  steps,
  currentStep,
  navigationLabel,
  currentLabel,
  completedLabel,
  disabled = false,
  onStepChange,
}: TenantWizardProgressProps) {
  return (
    <nav
      aria-label={navigationLabel}
      className="overflow-x-auto rounded-lg border border-border bg-card p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:scroll-auto"
      tabIndex={0}
    >
      <ol className="flex min-w-max gap-1">
        {steps.map((step) => {
          const isCurrent = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          return (
            <li key={step.number} className="min-w-40 flex-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-current={isCurrent ? "step" : undefined}
                disabled={disabled}
                onClick={() => onStepChange(step.number)}
                className={`min-h-11 w-full justify-start gap-2 whitespace-normal rounded-md border px-3 py-2 text-start text-sm ${
                  isCurrent
                    ? "border-primary bg-selected text-selected-foreground"
                    : isCompleted
                      ? "border-success/30 bg-success-subtle text-success-subtle-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
                ) : isCurrent ? (
                  <CircleDot aria-hidden="true" className="size-4 shrink-0" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid size-5 shrink-0 place-items-center rounded-full border border-current text-xs"
                  >
                    {step.number}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block whitespace-nowrap">{step.label}</span>
                  {isCurrent || isCompleted ? (
                    <span className="block text-xs font-normal">
                      {isCurrent ? currentLabel : completedLabel}
                    </span>
                  ) : null}
                </span>
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

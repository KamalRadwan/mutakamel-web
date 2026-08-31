"use client";

import { Check } from "lucide-react";
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
      <ol className="flex min-w-max items-stretch gap-1">
        {steps.map((step) => {
          const isCurrent = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          return (
            <li key={step.number} className="flex-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-current={isCurrent ? "step" : undefined}
                disabled={disabled}
                onClick={() => onStepChange(step.number)}
                className={`h-auto min-h-11 w-full justify-start gap-2 rounded-md border px-3 py-2 text-start text-sm ${
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    : isCompleted
                      ? "border-primary/30 bg-primary/10 text-foreground hover:bg-primary/15"
                      : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {/* One fixed-size marker in every state keeps the labels on a
                    shared baseline; swapping a 20px circle for a 16px icon
                    shifted each step's text sideways as you advanced. */}
                <span
                  aria-hidden="true"
                  className={`grid size-5 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    isCurrent
                      ? "bg-primary-foreground text-primary"
                      : isCompleted
                        ? "bg-primary text-primary-foreground"
                        : "border border-current"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : (
                    step.number
                  )}
                </span>
                <span className="min-w-0 truncate">{step.label}</span>
                {/* The state used to render as a second visible line inside a
                    fixed-height control, which clipped it. Screen readers
                    still get it; sighted users read it from the fill. */}
                {isCurrent || isCompleted ? (
                  <span className="sr-only">
                    {isCurrent ? currentLabel : completedLabel}
                  </span>
                ) : null}
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

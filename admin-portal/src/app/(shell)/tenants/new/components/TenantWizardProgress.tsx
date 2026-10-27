import { memo } from "react";
import { Check } from "lucide-react";
import { Button, cn } from "@/design-system";

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

export const TenantWizardProgress = memo(function TenantWizardProgress({
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
      className="rounded-xl border border-border bg-card p-2.5 sm:py-3 sm:px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:scroll-auto"
      tabIndex={0}
    >
      <ol className="flex w-full items-center justify-between">
        {steps.map((step, index) => {
          const isCurrent = step.number === currentStep;
          const isCompleted = step.number < currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.number}
              className={cn("flex items-center", isLast ? "shrink-0" : "flex-1 min-w-0")}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-current={isCurrent ? "step" : undefined}
                disabled={disabled}
                onClick={() => onStepChange(step.number)}
                className={cn(
                  "h-auto p-0 hover:bg-transparent flex items-center gap-2 rounded-md outline-none text-xs font-medium transition-colors motion-reduce:transition-none shrink-0",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isCurrent
                    ? "text-primary font-semibold"
                    : isCompleted
                      ? "text-foreground hover:text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  disabled && "pointer-events-none opacity-50",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-5.5 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors motion-reduce:transition-none",
                    isCurrent
                      ? "bg-primary text-primary-foreground font-semibold"
                      : isCompleted
                        ? "border border-primary bg-primary/10 text-primary"
                        : "border border-muted-foreground/40 text-muted-foreground",
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-3" strokeWidth={2.5} />
                  ) : (
                    step.number
                  )}
                </span>
                <span className="hidden min-w-0 truncate sm:inline">
                  {step.label}
                </span>
                <span className="sr-only sm:hidden">{step.label}</span>
                {isCurrent || isCompleted ? (
                  <span className="sr-only">
                    {isCurrent ? currentLabel : completedLabel}
                  </span>
                ) : null}
              </Button>

              {!isLast ? (
                <div
                  className={cn(
                    "h-px flex-1 mx-2 sm:mx-3 transition-colors motion-reduce:transition-none",
                    isCompleted ? "bg-primary/40" : "bg-border",
                  )}
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
});

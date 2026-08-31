"use client";

import { Check, X } from "lucide-react";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";
import { Button } from "./Button";

export type StepState = "complete" | "current" | "upcoming" | "invalid";

export interface StepperStep {
  id: string;
  /** Already translated — a primitive never reads the dictionary. */
  label: string;
  description?: string;
  state: StepState;
}

export interface StepperProps {
  steps: StepperStep[];
  /** Accessible name for the step list, e.g. "Lead conversion". */
  label: string;
  /** Makes steps activatable. Omit for a read-only progress indicator. */
  onStepSelect?: (id: string) => void;
  className?: string;
}

// A step's POSITION never takes a hue — step 1 is not blue and step 3 is not
// amber. Only the outcome of a step does, and there are exactly two outcomes
// worth a colour: it passed, or it failed. "Current" is in progress, which
// tokens.md maps to ink, so it is rendered as solid ink contrast rather than
// as a fifth hue. See docs/design/README.md#1 and MASTER-PLAN task 1.44.
const MARKER_BY_STATE: Record<StepState, string> = {
  complete:
    "border-positive-700 bg-positive-700 text-ink-25 dark:border-positive-400 dark:bg-positive-400 dark:text-ink-950",
  current: "border-foreground bg-foreground text-background",
  upcoming: "border-border bg-card text-muted-foreground",
  invalid: "border-destructive bg-destructive text-destructive-foreground",
};

const LABEL_BY_STATE: Record<StepState, string> = {
  complete: "text-foreground",
  current: "text-foreground font-medium",
  upcoming: "text-muted-foreground",
  invalid: "text-destructive font-medium",
};

export function Stepper({ steps, label, onStepSelect, className }: StepperProps) {
  return (
    <nav aria-label={label} className={className}>
      {/* An <ol> carries the order semantically, so RTL ordering is the
          browser's job — flex mirrors under dir and nothing here reverses it
          by hand. */}
      <ol className="flex w-full items-center gap-1">
        {steps.map((step, index) => {
          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
                  MARKER_BY_STATE[step.state],
                )}
              >
                {step.state === "complete" ? (
                  <Check className="size-3.5" />
                ) : step.state === "invalid" ? (
                  <X className="size-3.5" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="flex min-w-0 flex-col text-start">
                <span className={cn("truncate text-sm", LABEL_BY_STATE[step.state])}>{step.label}</span>
                {step.description && (
                  <span className="truncate text-xs text-muted-foreground">{step.description}</span>
                )}
              </span>
            </>
          );

          return (
            <li
              key={step.id}
              aria-current={step.state === "current" ? "step" : undefined}
              className="flex min-w-0 flex-1 items-center gap-1"
            >
              {onStepSelect ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onStepSelect(step.id)}
                  className={cn("h-auto min-w-0 cursor-pointer justify-start gap-2 py-1 font-normal", focusRing)}
                >
                  {content}
                </Button>
              ) : (
                <span className="flex min-w-0 items-center gap-2">{content}</span>
              )}
              {index < steps.length - 1 && (
                <span aria-hidden="true" className="h-px min-w-4 flex-1 bg-border" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

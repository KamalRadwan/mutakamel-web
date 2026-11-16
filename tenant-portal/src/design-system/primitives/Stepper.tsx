"use client";

import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";
import { Button } from "./Button";

export type StepState = "complete" | "current" | "upcoming" | "invalid";

export interface StepperStep {
  id: string;
  /** Already translated — a primitive never reads the dictionary. */
  label: string;
  description?: string;
  icon?: ReactNode;
  state: StepState;
}

export interface StepperProps {
  steps: StepperStep[];
  /** Accessible name for the step list, e.g. "Lead conversion". */
  label: string;
  /** Makes steps activatable. Omit for a read-only progress indicator. */
  onStepSelect?: (id: string) => void;
  layout?: "inline" | "stacked";
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

export function Stepper({ steps, label, onStepSelect, layout = "inline", className }: StepperProps) {
  const stacked = layout === "stacked";
  const contentLayout = stacked ? "flex-col justify-center gap-2 text-center" : "gap-2 text-start";
  return (
    <nav aria-label={label} className={className}>
      {/* An <ol> carries the order semantically, so RTL ordering is the
          browser's job — flex mirrors under dir and nothing here reverses it
          by hand. */}
      <ol className={cn("w-full items-center", stacked ? "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:gap-0" : "flex gap-1")}>
        {steps.map((step, index) => {
          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-full border text-xs tabular-nums",
                  stacked ? "size-10" : "size-6",
                  MARKER_BY_STATE[step.state],
                )}
              >
                {step.state === "complete" ? (
                  <Check className="size-3.5" />
                ) : step.state === "invalid" ? (
                  <X className="size-3.5" />
                ) : (
                  step.icon ?? index + 1
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={cn("text-sm", !stacked && "truncate", LABEL_BY_STATE[step.state])}>{step.label}</span>
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
              className={cn("flex min-w-0 flex-1 items-center gap-1", stacked && "relative justify-center")}
            >
              {onStepSelect ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onStepSelect(step.id)}
                  className={cn("h-auto min-w-0 cursor-pointer font-normal", contentLayout, focusRing,
                    stacked ? "min-h-20 whitespace-normal rounded-lg border border-transparent px-3 py-2"
                      : "justify-start py-1",
                    stacked && step.state === "current" && "border-border bg-card shadow-xs")}
                >
                  {content}
                </Button>
              ) : (
                <span className={cn("flex min-w-0 items-center", contentLayout, stacked && "min-h-20 py-2")}>{content}</span>
              )}
              {index < steps.length - 1 && (
                <span aria-hidden="true" className={cn("h-px bg-border", stacked
                  ? "pointer-events-none absolute -end-[calc(50%_-_3.75rem)] start-[calc(50%_+_3.75rem)] top-7 hidden lg:block"
                  : "min-w-4 flex-1")} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { WidgetFormError } from "../widget-form-validation";

const steps = ["details", "metrics", "scope", "comparison", "display", "review"] as const;
export type WidgetBuilderStep = (typeof steps)[number];

const fieldStep: Record<WidgetFormError, WidgetBuilderStep> = {
  NAME_REQUIRED: "details",
  VISUALIZATION_REQUIRED: "metrics",
  METRIC_REQUIRED: "metrics",
  SERIES_INVALID: "metrics",
  SHAPE_INVALID: "metrics",
  UNITS_INVALID: "metrics",
  AXIS_REQUIRED: "metrics",
  SERIES_STYLE_INVALID: "metrics",
  DIMENSION_REQUIRED: "scope",
  GRAIN_REQUIRED: "scope",
  FILTER_INVALID: "scope",
  TARGET_REQUIRED: "comparison",
  TARGET_INVALID: "comparison",
  GOVERNED_TARGET_INVALID: "comparison",
  COMPARISON_UNSUPPORTED: "comparison",
  DATASETS_INVALID: "comparison",
  DISPLAY_INVALID: "display",
};

export function useWidgetBuilderSteps(error: WidgetFormError | null) {
  const [step, setStep] = useState<WidgetBuilderStep>("details");
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    heading.current?.focus();
  }, [step]);

  const index = steps.indexOf(step);
  const errorStep = error ? fieldStep[error] : null;
  const select = (id: string) => {
    const next = steps.find((candidate) => candidate === id);
    if (next) setStep(next);
  };

  return {
    steps, step, heading, errorStep, select,
    previous: steps[index - 1], next: steps[index + 1],
    isComplete: (candidate: WidgetBuilderStep) => !error && steps.indexOf(candidate) < index,
  };
}

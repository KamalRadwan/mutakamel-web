"use client";

import { useEffect, useId } from "react";
import { Info } from "lucide-react";
import { cn } from "../lib/cn";
import { iconSize } from "../lib/icons";
import { proseMeasure } from "../lib/variants";
import { Button } from "./Button";
import { FieldControlProvider } from "./field-control";
import { Label } from "./Label";
import { Tooltip, TooltipContent, TooltipTrigger } from "./Tooltip";

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /**
   * The value matters and is readable, it just cannot be changed here — B16.
   * Distinct from `disabled`, which says "not applicable, or temporarily
   * unavailable". Pair it with a `hint` naming where the value IS editable.
   */
  readOnly?: boolean;
  /** When true, renders the label visibly above the field rather than sr-only. */
  showLabel?: boolean;
  /**
   * Where `hint` appears. "below" (default) renders it as a paragraph under
   * the control. "tooltip" moves it into an `Info`-icon trigger beside the
   * label instead — the paragraph stays in the DOM for `aria-describedby`
   * but becomes screen-reader-only. Reach for "tooltip" in a dense,
   * multi-field modal; pair it with `showLabel` — see
   * docs/design/primitives.md#field-hint-placement.
   */
  hintPlacement?: "below" | "tooltip";
  className?: string;
  /**
   * Exactly one design-system control, at any depth. It claims the label by
   * calling `useFieldControl` rather than being handed props, so a positioning
   * wrapper, a Radix context component or a feature component in between makes
   * no difference. A second control under the same label opts out of the claim
   * with `FieldControlBoundary`.
   */
  children: React.ReactNode;
}

// The only correct way to render a labelled input — generates a stable
// htmlFor/id pair and wires aria-describedby to hint and error text so a
// screen-reader user can find the problem. A field error is inline here,
// never a toast: see docs/design/patterns.md#where-a-result-belongs.
export function Field({
  label,
  hint,
  error,
  required,
  readOnly,
  showLabel = false,
  hintPlacement = "below",
  className,
  children,
}: FieldProps) {
  const generatedId = useId();
  const controlId = `${generatedId}-control`;
  const hintId = `${generatedId}-hint`;
  const errorId = `${generatedId}-error`;
  // Only reference an id for text that actually renders below — the hint
  // paragraph is suppressed once there is an error (see JSX below), so
  // hintId must drop out here too or aria-describedby dangles.
  const showHint = Boolean(hint) && !error;
  const describedBy = [showHint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  // This wiring fails silently by nature: nothing throws, nothing looks
  // different, the label just stops naming anything. That is precisely how 125
  // `Field > Select` pairs and two password inputs shipped with no accessible
  // name. So the failure is made loud in development — the id is either on a
  // control or it is on nothing at all, and the DOM knows which.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (document.getElementById(controlId)) return;
    console.error(
      `Field("${label}") rendered no control that claims its label, so its <label for> points at ` +
        "nothing and the field has no accessible name. The control must be a design-system primitive " +
        "that calls useFieldControl(), or must forward `id` to its own focusable element.",
    );
  }, [controlId, label]);

  // The label is RENDERED and still points at the control; it is only hidden.
  // A placeholder is not an accessible name — it is announced inconsistently
  // and it is gone the moment there is a value — so the name stays in the
  // label and only the LOOK moves into the prompt. The required marker rides
  // along on the prompt, because a hidden asterisk marks nothing.
  const prompt = required ? `${label} *` : label;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className={cn("flex items-center gap-1", showLabel && "min-h-4")}>
        <Label
          htmlFor={controlId}
          className={showLabel ? "text-xs" : "sr-only"}
        >
          {label}
          {required && (
            <span aria-hidden="true" className="text-destructive">
              {" "}
              *
            </span>
          )}
        </Label>
        {hintPlacement === "tooltip" && showHint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                className="size-4! shrink-0 p-0! text-muted-foreground"
                aria-label={hint}
                // A dialog's auto-focus lands here; open on keyboard focus only, not programmatic focus.
                onFocus={(event) => {
                  if (!event.currentTarget.matches(":focus-visible")) event.preventDefault();
                }}
              >
                <Info className={iconSize({ size: "xs" })} aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {/*
        readOnly reaches the control BOTH ways on purpose: the native attribute
        is what makes `readOnlySurface`'s read-only:* variants render and what
        stops typing, and aria-readonly is what a screen reader announces on a
        control (Radix Select, MultiSelect) that has no native read-only state.
        Never mapped to `disabled` — dimming a value to 50% claims it does not
        apply to the user, which is false.
        docs/design/primitives.md#readonly-is-not-disabled.
      */}
      <FieldControlProvider
        value={{
          controlId,
          describedBy,
          invalid: Boolean(error),
          required,
          readOnly,
          label: prompt,
        }}
      >
        {children}
      </FieldControlProvider>
      {showHint && (
        <p
          id={hintId}
          className={cn(
            "text-xs text-muted-foreground",
            proseMeasure,
            hintPlacement === "tooltip" && "sr-only",
          )}
        >
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={cn("text-xs text-destructive", proseMeasure)}>
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { forwardRef } from "react";
import { cn } from "../lib/cn";
import {
  controlSize,
  focusRing,
  readOnlySurface,
  textEntrySize,
  type ControlSizeProps,
} from "../lib/variants";
import { useFieldControl } from "./field-control";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    ControlSizeProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, size = "lg", ...props }, ref) => {
    // Claims the enclosing Field, however deep it sits — a password input
    // inside `<div className="relative">` is still the field's control.
    const field = useFieldControl(props, { nativeReadOnly: true });

    return (
      <input
        ref={ref}
        className={cn(
          "flex w-full rounded-md border border-input bg-card text-foreground",
          "placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          readOnlySurface,
          focusRing,
          controlSize({ size }),
          // Must follow controlSize: tailwind-merge keeps the last font-size in
          // a group, so this is what lifts the base step to text-base below sm
          // while leaving the sm:* step controlSize implied.
          textEntrySize({ size }),
          className,
        )}
        {...props}
        {...field}
      />
    );
  },
);
Input.displayName = "Input";

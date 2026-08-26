"use client";

import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex h-(--size-control-lg) w-full rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors",
        "placeholder:text-muted-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        invalid && "border-danger-500 focus-visible:ring-danger-500",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

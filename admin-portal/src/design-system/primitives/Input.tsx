"use client";

import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { focusRing, hitArea } from "../lib/variants";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "flex h-(--size-control-lg) w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors motion-reduce:transition-none",
        "placeholder:text-muted-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        hitArea,
        invalid && "border-destructive focus-visible:ring-destructive",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

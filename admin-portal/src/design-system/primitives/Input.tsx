"use client";

import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { focusRing, hitArea } from "../lib/variants";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  invalid?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

const inputSizeClasses: Record<"xs" | "sm" | "md" | "lg" | "xl", string> = {
  xs: "h-(--size-control-xs) px-2 text-xs",
  sm: "h-(--size-control-sm) px-2.5 text-xs",
  md: "h-(--size-control-md) px-3 text-sm",
  lg: "h-(--size-control-lg) px-3 text-sm",
  xl: "h-(--size-control-xl) px-4 text-base",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, size = "sm", leading, trailing, ...props }, ref) => {
    const resolvedSizeClass =
      typeof size === "string" && size in inputSizeClasses
        ? inputSizeClasses[size as keyof typeof inputSizeClasses]
        : inputSizeClasses.sm;

    const inputNode = (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex w-full rounded-md border border-input bg-card text-foreground outline-none transition-colors motion-reduce:transition-none",
          resolvedSizeClass,
          leading && "ps-8",
          trailing && "pe-8",
          "placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          focusRing,
          hitArea,
          invalid && "border-destructive focus-visible:ring-destructive",
          className,
        )}
        {...props}
      />
    );

    if (!leading && !trailing) {
      return inputNode;
    }

    return (
      <div className="relative flex items-center w-full min-w-0">
        {leading ? (
          <span
            className="absolute start-2.5 text-muted-foreground pointer-events-none shrink-0 flex items-center justify-center [&>svg]:size-3.5"
            aria-hidden="true"
          >
            {leading}
          </span>
        ) : null}
        {inputNode}
        {trailing ? (
          <span
            className="absolute end-2.5 text-muted-foreground pointer-events-none shrink-0 flex items-center justify-center [&>svg]:size-3.5"
            aria-hidden="true"
          >
            {trailing}
          </span>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";

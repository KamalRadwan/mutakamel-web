import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { controlSize, focusRing, type ControlSizeProps } from "../lib/variants";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    ControlSizeProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, size = "md", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "flex w-full rounded-sm border border-input bg-card text-foreground",
          "placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          focusRing,
          controlSize({ size }),
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

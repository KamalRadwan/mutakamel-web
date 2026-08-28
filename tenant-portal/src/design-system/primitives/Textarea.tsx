import { forwardRef } from "react";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 3, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "flex w-full rounded-sm border border-input bg-card px-3 py-2 text-sm text-foreground",
          "resize-y placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          focusRing,
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

"use client";

import { forwardRef } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../lib/cn";
import { focusRing, readOnlySurface, textEntrySize, type ControlSizeProps } from "../lib/variants";

// Matches Input's padding and type size at every step, but deliberately does
// NOT reuse `controlSize`: that sets a fixed `h-(--size-control-*)`, which on a
// multi-line control would clamp it to one 28.8px row and defeat the point of a
// textarea. Height comes from `rows` instead.
const textareaSize = cva("", {
  variants: {
    size: {
      xs: "px-1.5 py-1",
      sm: "px-2 py-1.5",
      md: "px-3 py-2",
      lg: "px-4 py-2",
      xl: "px-4 py-2.5",
    },
  },
  defaultVariants: { size: "md" },
});

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "size">,
    ControlSizeProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 3, size = "md", ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "flex w-full rounded-sm border border-input bg-card text-foreground",
          "resize-y placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          readOnlySurface,
          focusRing,
          textareaSize({ size }),
          textEntrySize({ size }),
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

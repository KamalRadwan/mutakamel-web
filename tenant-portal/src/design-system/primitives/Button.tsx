"use client";

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";
import { controlSize, focusRing } from "../lib/variants";

export const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center whitespace-nowrap rounded-sm font-medium",
    "transition-colors disabled:opacity-50 disabled:pointer-events-none",
    focusRing,
  ),
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-brand-700 dark:hover:bg-brand-300",
        secondary: "bg-secondary text-secondary-foreground hover:bg-ink-200 dark:hover:bg-ink-700",
        outline: "border border-border bg-transparent hover:bg-accent",
        ghost: "bg-transparent hover:bg-accent",
        destructive: "bg-destructive text-destructive-foreground hover:bg-negative-800",
        link: "bg-transparent text-brand-700 dark:text-brand-300 hover:underline p-0! h-auto!",
      },
    },
    defaultVariants: { variant: "outline" },
  },
);

// buttonVariantClasses is a plain class string for the one case where the
// framework must own the element — Radix AlertDialog.Action/.Cancel — so
// asChild is not needed there.
export function buttonVariantClasses(
  variant: VariantProps<typeof buttonVariants>["variant"] = "outline",
  size: VariantProps<typeof controlSize>["size"] = "md",
): string {
  return cn(buttonVariants({ variant }), controlSize({ size }));
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  size?: VariantProps<typeof controlSize>["size"];
  loading?: boolean;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size = "md", loading, asChild, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant }), controlSize({ size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {/* Radix Slot requires exactly one child element — a second JSX
            expression slot breaks it even when that expression evaluates to
            false, so the loading branch must not exist in the asChild path
            at all, not just render nothing. */}
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

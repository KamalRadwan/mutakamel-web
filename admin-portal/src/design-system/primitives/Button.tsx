"use client";

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { focusRing, controlSize } from "../lib/variants";

/**
 * At most one variant="primary" per page — the page's single primary
 * action, in PageHeader (Phase 12). Everything else is outline/ghost/
 * secondary. A bright emerald fill only reads as "the action" when it's
 * the only one on screen (docs/design-system/geometry-and-density.md).
 */
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    focusRing,
  ),
  {
    variants: {
      variant: {
        primary: "bg-brand-500 text-ink-950 hover:bg-brand-600 dark:bg-brand-400 dark:hover:bg-brand-500",
        secondary: "bg-ink-100 text-ink-900 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700",
        outline: "border border-border bg-transparent text-foreground hover:bg-ink-100 dark:hover:bg-ink-800",
        ghost: "bg-transparent text-foreground hover:bg-ink-100 dark:hover:bg-ink-800",
        destructive: "bg-danger-700 text-white hover:bg-danger-800",
        link: "bg-transparent text-brand-700 underline-offset-4 hover:underline dark:text-brand-300",
      },
      size: {
        xs: "",
        sm: "",
        md: "",
        lg: "",
        xl: "",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

/**
 * The same visual styling as <Button>, as a class string — for the rare
 * case (Radix AlertDialog.Action/Cancel) where the framework requires its
 * own element to be the interactive one, so wrapping in <Button asChild>
 * isn't an option.
 */
export function buttonVariantClasses(
  variant: NonNullable<VariantProps<typeof buttonVariants>["variant"]>,
  size: NonNullable<VariantProps<typeof buttonVariants>["size"]> = "md",
): string {
  return cn(buttonVariants({ variant, size }), controlSize({ size }));
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size = "md", asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), controlSize({ size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

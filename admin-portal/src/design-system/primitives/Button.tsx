"use client";

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { focusRing, controlSize, hitArea } from "../lib/variants";

/**
 * At most one variant="primary" per visible decision surface. Primary is
 * cobalt action; successful outcomes stay on the separate green family.
 */
const buttonVariants = cva(
  cn(
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors motion-reduce:transition-none disabled:pointer-events-none disabled:opacity-50",
    focusRing,
    hitArea,
  ),
  {
    variants: {
      variant: {
        primary: "bg-gradient-primary text-white not-disabled:hover:brightness-90 not-disabled:hover:shadow-pop",
        secondary: "bg-secondary text-secondary-foreground hover:bg-accent",
        outline: "border border-input bg-card text-foreground hover:bg-accent",
        ghost: "bg-transparent text-foreground hover:bg-accent",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        link: "bg-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "",
        sm: "",
        md: "",
        lg: "",
        xl: "",
        toolbar: "h-(--size-toolbar-control) px-3.5 gap-1.5 rounded-lg text-label font-semibold",
      },
    },
    defaultVariants: { variant: "secondary", size: "sm" },
  },
);

// The shared control scale has 24/28/32/36/40px steps; toolbar owns the 33px token.
function resolveButtonSize(size: VariantProps<typeof buttonVariants>["size"] = "sm"): string {
  return size === "toolbar" ? "" : controlSize({ size });
}

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
  size: NonNullable<VariantProps<typeof buttonVariants>["size"]> = "sm",
): string {
  return cn(buttonVariants({ variant, size }), resolveButtonSize(size));
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size = "sm", asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), resolveButtonSize(size), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

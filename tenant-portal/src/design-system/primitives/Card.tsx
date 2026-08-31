"use client";

import { forwardRef } from "react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { surface } from "../lib/variants";

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof surface> {}

// The canonical consumer of the `surface` ladder — base / raised / sunken are
// the same three steps geometry.md#elevation defines, so a card asks for a
// level rather than restating the classes. Radius stays here: it is geometry,
// not elevation, and every level carries the same one.
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, level = "base", ...props }, ref) => (
    <div ref={ref} className={cn("rounded-md", surface({ level }), className)} {...props} />
  ),
);
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1 p-3", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-sm font-medium text-card-foreground", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-xs text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-3 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2 p-3 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

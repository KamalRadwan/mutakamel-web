"use client";

import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";
import { cn, DialogContent } from "@/design-system";

type TemplateDialogContentProps = Omit<ComponentPropsWithoutRef<typeof DialogContent>, "size" | "aria-modal"> & {
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
};

/** Use within the existing modal Dialog, with DialogTitle/Description/Trigger. */
export const TemplateDialogContent = forwardRef<ComponentRef<typeof DialogContent>, TemplateDialogContentProps>(
  ({ size = "2xl", className, ...props }, ref) => <DialogContent {...props} ref={ref} size={size} aria-modal="true"
    className={cn("min-w-0 w-[calc(100vw-2rem)] max-h-[85dvh] overflow-y-auto motion-reduce:animate-none", className)} />,
);
TemplateDialogContent.displayName = "TemplateDialogContent";

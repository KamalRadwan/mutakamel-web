"use client";

import { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";
import { DialogOverlay } from "./Dialog";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

// side is logical (start/end), never left/right, so Sheet mirrors
// automatically in RTL (docs/design-system/patterns.md, FormDrawer). But
// tw-animate-css's slide-in-from-*/slide-out-to-* utilities only exist for
// physical directions (left/right/top/bottom) — there is no
// slide-in-from-start. Each logical side therefore picks its physical
// animation via the ltr:/rtl: variants instead of a single logical class.
const sheetVariants = cva(
  "fixed z-50 flex flex-col gap-4 border-border bg-card p-6 text-card-foreground shadow-overlay transition ease-in-out data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=closed]:animate-out data-[state=open]:animate-in",
  {
    variants: {
      side: {
        start:
          "inset-y-0 start-0 h-full w-[min(100vw,26rem)] border-e " +
          "ltr:data-[state=closed]:slide-out-to-left ltr:data-[state=open]:slide-in-from-left " +
          "rtl:data-[state=closed]:slide-out-to-right rtl:data-[state=open]:slide-in-from-right",
        end:
          "inset-y-0 end-0 h-full w-[min(100vw,26rem)] border-s " +
          "ltr:data-[state=closed]:slide-out-to-right ltr:data-[state=open]:slide-in-from-right " +
          "rtl:data-[state=closed]:slide-out-to-left rtl:data-[state=open]:slide-in-from-left",
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
      },
    },
    defaultVariants: { side: "end" },
  },
);

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

export const SheetContent = forwardRef<React.ComponentRef<typeof DialogPrimitive.Content>, SheetContentProps>(
  ({ side, className, children, ...props }, ref) => (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        <DialogPrimitive.Close
          className={cn(
            "absolute end-4 top-4 rounded-md opacity-60 transition-opacity hover:opacity-100",
            focusRing,
          )}
        >
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  ),
);
SheetContent.displayName = "SheetContent";

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-auto flex items-center justify-end gap-2 border-t border-border pt-4", className)} {...props} />;
}

export const SheetTitle = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
));
SheetTitle.displayName = "SheetTitle";

export const SheetDescription = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = "SheetDescription";

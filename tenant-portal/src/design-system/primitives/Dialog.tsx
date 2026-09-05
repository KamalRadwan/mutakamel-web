"use client";

import { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { useDictionary } from "@/i18n/useLanguage";
import { cn } from "../lib/cn";
import { focusRing } from "../lib/variants";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

export const DialogOverlay = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-(--z-overlay) bg-ink-950/50 backdrop-blur-sm",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

// Every sized dialog is the same centred card; only its cap differs. Kept as
// one constant rather than repeated per step so the five sizes cannot drift
// apart, and so `full` can opt out of centring wholesale instead of having to
// unset six utilities the base string would otherwise have imposed.
const CENTERED_CARD =
  "start-1/2 top-1/2 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg p-6";

const dialogContentVariants = cva(
  "fixed z-(--z-overlay) border border-border bg-popover text-popover-foreground shadow-overlay",
  {
    variants: {
      size: {
        sm: `${CENTERED_CARD} max-w-[384px]`,
        md: `${CENTERED_CARD} max-w-[448px]`,
        lg: `${CENTERED_CARD} max-w-[512px]`,
        xl: `${CENTERED_CARD} max-w-[576px]`,
        "2xl": `${CENTERED_CARD} max-w-[672px]`,
        // The viewport, less 20px on every side — the working surface a long
        // record form needs, and the one size that is NOT a card floating in
        // the middle of the page. It brings no padding of its own: a surface
        // this size wants a header and a footer that reach its own edges, so
        // padding belongs to the bands inside it. See
        // docs/design/primitives.md#dialog--alertdialog--sheet.
        full: "inset-5 flex flex-col overflow-hidden rounded-lg",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {
  showCloseButton?: boolean;
  /**
   * Overrides the close button's screen-reader label. Defaults to
   * `t.common.close` — NOT to an English string. A primitive that carries an
   * English fallback renders English to an Arabic screen-reader user on every
   * call site that forgets the prop, which is most of them.
   */
  closeLabel?: string;
}

export const DialogContent = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, size, showCloseButton = true, closeLabel, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        dialogContentVariants({ size }),
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && <DialogCloseButton label={closeLabel} />}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

// Its own component so `DialogContent` keeps an expression body: the label has
// to come from a hook, and a hook cannot be called from one.
function DialogCloseButton({ label }: { label?: string }) {
  const t = useDictionary();
  return (
    <DialogPrimitive.Close
      className={cn(
        "absolute end-4 top-4 rounded-md text-muted-foreground opacity-70 hover:opacity-100 disabled:pointer-events-none",
        focusRing,
      )}
    >
      <X className="size-4" aria-hidden="true" />
      <span className="sr-only">{label ?? t.common.close}</span>
    </DialogPrimitive.Close>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 text-start", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export const DialogTitle = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-base text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

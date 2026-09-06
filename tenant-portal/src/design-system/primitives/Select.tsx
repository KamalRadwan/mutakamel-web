"use client";

import { forwardRef } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";
import { controlSize, focusRing, textEntrySize, type ControlSizeProps } from "../lib/variants";
import { useFieldControl, useFieldControlContext } from "./field-control";

// Radix's Root is a CONTEXT component — it renders no DOM node, so an id or an
// aria-* attribute handed to it reaches nothing at all. The trigger below is
// the only focusable element a select has, which is why it, and not the Root,
// is what claims the enclosing `Field`. See field-control.tsx.
export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
/**
 * Radix's value, with the enclosing `Field`'s label as its prompt.
 *
 * A `Select` cannot fall back the way an `<input>` does — the placeholder is a
 * prop on the VALUE, not on the trigger that claims the field — so this reads
 * the field itself. A caller's own placeholder still wins, which is how
 * "Default stage" and "No source" keep saying what the empty value MEANS
 * rather than repeating the label.
 */
export function SelectValue({
  placeholder,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>) {
  const field = useFieldControlContext();
  return <SelectPrimitive.Value placeholder={placeholder ?? field?.label} {...props} />;
}

export interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>,
    ControlSizeProps {}

export const SelectTrigger = forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, size = "sm", children, ...props }, ref) => {
  // aria-readonly only, no native attribute: a trigger is a button element, and
  // `readonly` on a button is meaningless markup.
  const field = useFieldControl(props);

  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-card text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        "data-[placeholder]:text-muted-foreground",
        // Matches Input. Tailwind compiles `aria-invalid:` to
        // `[aria-invalid="true"]`, so the aria-invalid="false" a Field puts on
        // every control does not paint every select red.
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        // `readOnlySurface` is keyed on the native :read-only pseudo-class,
        // which a button element can never match — hence the aria twin here.
        "aria-readonly:bg-muted aria-readonly:cursor-default aria-readonly:border-border",
        focusRing,
        controlSize({ size }),
        // B1: a select sits in the same row as the inputs it filters, so it
        // takes the same 16px-below-sm step. Must follow controlSize —
        // tailwind-merge keeps the last font-size in a group.
        textEntrySize({ size }),
        className,
      )}
      {...props}
      {...field}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "relative z-(--z-dropdown) max-h-96 min-w-32 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-pop",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
        className,
      )}
      {...props}
    >
      {/* The viewport owns the scroll. It used to be pinned to
          `--radix-select-trigger-height`, which clamped every list to one row's
          height while the content's `overflow-hidden` swallowed the rest — a
          long list simply could not be reached. */}
      <SelectPrimitive.Viewport
        className={cn(
          "max-h-96 overflow-y-auto overscroll-contain p-1",
          position === "popper" && "w-full min-w-(--radix-select-trigger-width)",
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

export const SelectItem = forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-md py-1.5 ps-8 pe-2 text-sm outline-none",
      "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    {...props}
  >
    <span className="absolute start-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";

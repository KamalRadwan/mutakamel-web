"use client";

import { createContext, forwardRef, useContext } from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "../lib/cn";
import { controlSize, focusRing, type ControlSizeProps } from "../lib/variants";

// Size travels by context so every item matches the group without each call
// site repeating it — the same shape Radix uses for its own roving tabindex.
const ToggleGroupSizeContext = createContext<ControlSizeProps["size"]>("md");

export type ToggleGroupProps = React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
  ControlSizeProps;

export const ToggleGroup = forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  ToggleGroupProps
>(({ className, size = "md", children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn("inline-flex items-center gap-1 rounded-sm bg-muted p-1", className)}
    {...props}
  >
    <ToggleGroupSizeContext.Provider value={size}>{children}</ToggleGroupSizeContext.Provider>
  </ToggleGroupPrimitive.Root>
));
ToggleGroup.displayName = "ToggleGroup";

export const ToggleGroupItem = forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  const size = useContext(ToggleGroupSizeContext);

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-xs font-medium whitespace-nowrap",
        "text-muted-foreground transition-colors hover:text-foreground",
        // The active segment is a state, not an identity: it takes contrast
        // and elevation, never a per-item hue. Three tabs do not get three
        // colours — docs/design/anti-patterns.md#4-hue-coded-controls.
        "data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-pop",
        "disabled:pointer-events-none disabled:opacity-50",
        focusRing,
        controlSize({ size }),
        className,
      )}
      {...props}
    />
  );
});
ToggleGroupItem.displayName = "ToggleGroupItem";

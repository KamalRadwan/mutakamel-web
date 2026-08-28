import { cva, type VariantProps } from "class-variance-authority";

// Sizes and paddings from docs/design/DESIGN-SYSTEM.md#3--sizing--density —
// that file supersedes geometry.md's 28-44px scale with a tighter 24-40px one.
export const controlSize = cva("", {
  variants: {
    size: {
      xs: "h-(--size-control-xs) px-1.5 text-xs gap-1",
      sm: "h-(--size-control-sm) px-2   text-xs gap-1.5",
      md: "h-(--size-control-md) px-3   text-sm gap-1.5",
      lg: "h-(--size-control-lg) px-4   text-sm gap-2",
      xl: "h-(--size-control-xl) px-4   text-base gap-2.5",
    },
  },
  defaultVariants: { size: "md" },
});

export type ControlSizeProps = VariantProps<typeof controlSize>;

// Controls below the 44px touch-target floor get an invisible expanded hit
// area instead of a bigger visible box — see geometry.md#hit-area-expansion.
export const hitArea =
  "relative after:absolute after:-inset-1.5 after:content-['']";

export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Surfaces separate by border + background step, never a shadow, except the
// two elevated levels — see geometry.md#elevation.
export const surface = cva("", {
  variants: {
    level: {
      canvas: "bg-canvas text-foreground",
      base: "bg-card text-card-foreground border border-border",
      raised: "bg-popover text-popover-foreground border border-border shadow-pop",
      overlay: "bg-popover text-popover-foreground shadow-overlay",
      sunken: "bg-muted text-muted-foreground",
    },
  },
  defaultVariants: { level: "base" },
});

import { cva } from "class-variance-authority";

/**
 * Shared CVA fragments composed into primitives (Button, Input, Select, …).
 * Reference the control/radius/surface tokens defined in globals.css so a
 * single token edit reflows every primitive built on top of these.
 */

/** Visible keyboard-focus ring. Every interactive primitive spreads this in. */
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Control height scale — xs/sm/md/lg/xl map to the 24/28/32/36/40px
 * --size-control-* tokens (docs/design-system/geometry-and-density.md).
 */
export const controlSize = cva("", {
  variants: {
    size: {
      xs: "h-(--size-control-xs) px-2 text-xs",
      sm: "h-(--size-control-sm) px-2.5 text-xs",
      md: "h-(--size-control-md) px-3 text-sm",
      lg: "h-(--size-control-lg) px-3.5 text-sm",
      xl: "h-(--size-control-xl) px-4 text-base",
    },
  },
  defaultVariants: { size: "md" },
});

/**
 * Surface ladder (canvas / surface / surface-raised / surface-sunken) — see
 * §3.5 of the migration plan. Elevation comes from border + background step,
 * never a shadow, except surface-raised which owns the one permitted
 * "floating above the document" shadow.
 */
export const surface = cva("", {
  variants: {
    level: {
      canvas: "bg-canvas text-foreground",
      base: "bg-card text-card-foreground border border-border",
      raised: "bg-popover text-popover-foreground border border-border shadow-pop",
      sunken: "bg-muted text-muted-foreground",
    },
  },
  defaultVariants: { level: "base" },
});

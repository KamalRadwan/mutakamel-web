import { cva, type VariantProps } from "class-variance-authority";

// Control height scale — xs/sm/md/lg/xl map to the 24/28/32/36/40px
// --size-control-* tokens. Heights, paddings and the fixed 1.5 gap are the
// admin portal's (admin-portal/src/design-system/lib/variants.ts), so a
// control of a given size is the same physical control in both portals. The
// two paddings that moved are xs (1.5 -> 2) and sm (2 -> 2.5); lg tightened
// from px-4 to px-3.5 so the lg step is not the same width as xl.
export const controlSize = cva("", {
  variants: {
    size: {
      xs: "h-(--size-control-xs) px-2   text-xs  gap-1.5",
      sm: "h-(--size-control-sm) px-2.5 text-xs  gap-1.5",
      md: "h-(--size-control-md) px-3   text-sm  gap-1.5",
      lg: "h-(--size-control-lg) px-3.5 text-sm  gap-1.5",
      xl: "h-(--size-control-xl) px-4   text-base gap-1.5",
    },
  },
  defaultVariants: { size: "md" },
});

export type ControlSizeProps = VariantProps<typeof controlSize>;

// Text-entry controls render at text-base below the sm breakpoint and drop to
// their dense size from sm: upward — DESIGN-SYSTEM.md#inputs-are-16px-on-mobile.
// Mobile Safari zooms the viewport whenever a focused input is under 16px.
//
// Separate from controlSize on purpose: the rule covers anything that receives
// typed input and explicitly does NOT cover buttons or labels, which share
// controlSize.
export const textEntrySize = cva("text-base", {
  variants: {
    size: {
      xs: "sm:text-xs",
      sm: "sm:text-xs",
      md: "sm:text-sm",
      lg: "sm:text-sm",
      xl: "sm:text-base",
    },
  },
  defaultVariants: { size: "md" },
});

// readOnly is not disabled — the value still matters and keeps full text
// contrast; only the surface says "not editable here". Dimming it to 50% would
// claim the value does not apply to the user, which is false. See
// docs/design/primitives.md#readonly-is-not-disabled.
//
// The focus-visible ring is deliberately kept: a readOnly input is still
// focusable and reachable by keyboard, and WCAG 2.4.7 requires a visible
// indicator on anything that can take focus.
export const readOnlySurface =
  "read-only:bg-muted read-only:text-foreground read-only:cursor-default " +
  "read-only:border-border read-only:placeholder:text-muted-foreground";

// Controls below the 44px touch-target floor get a real expanded target
// instead of a bigger visible box — see geometry.md#hit-area-expansion.
//
// This is admin's mechanism, and it replaces a fixed `after:-inset-2`. That
// 8px was derived from --ui-scale 0.9 ("28.8px + 8px per side = 44.8px"), a
// number that silently stopped being right the moment the scale default moved
// to 1. The class pair below is declared in globals.css and expressed in
// minimum sizes rather than a hardcoded inset, so it holds the WCAG floor at
// any scale — and it expands only for coarse pointers, where the floor
// actually applies.
//
// hitArea grows the control box itself; hitTarget keeps a compact visual box
// (checkbox, radio) while its generated ::after stays part of the same
// hit-testing area.
export const hitArea = "ds-hit-area";

export const hitTarget = "ds-hit-target";

// B11 (SKILL-AUDIT.md): UUIDs, correlationIds, idempotency keys and cursors
// are unbroken 36-character tokens with no natural break point, and they
// overflow a toast or a narrow cell. `wrap-anywhere` is overflow-wrap:
// anywhere — deliberately NOT word-break: break-all, which also hyphenates
// ordinary Arabic and English prose mid-syllable.
// docs/design/typography.md#identifiers-wrap-never-overflow.
//
// Wrap the value itself in <bdi> at the call site: without it, bidirectional
// reordering mangles a Latin id inside an Arabic sentence and the DISPLAYED
// value is wrong, not merely ugly — accessibility.md#bidirectional-text.
export const identifierText = "font-mono wrap-anywhere";

// B17: prose is capped at 65 characters. `max-w-prose` is exactly 65ch in
// Tailwind v4, so this is the documented rule expressed as a scale utility
// rather than an arbitrary value. Exempt: table cells, labels, badges, nav
// items — docs/design/typography.md#prose-is-capped-at-65-characters.
export const proseMeasure = "max-w-prose";

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

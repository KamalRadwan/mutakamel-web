import { cva } from "class-variance-authority";

// The icon size scale, tied one-to-one to `controlSize` so an icon inside a
// control never has to be sized by eye. See docs/design/icons.md.
//
// The ratios are the ones already shipping — this codifies them rather than
// re-deciding them, so adopting the scale is visually a no-op.
export const iconSize = cva("shrink-0", {
  variants: {
    size: {
      xs: "size-3", // 12px in a 24px control
      sm: "size-3.5", // 14px in a 28px control
      md: "size-3.5", // 14px in a 32px control — the workhorse
      lg: "size-4", // 16px in a 36px control
      xl: "size-5", // 20px in a 40px control
    },
  },
  defaultVariants: { size: "md" },
});

/**
 * The **one** RTL mirror mechanism in this system.
 *
 * `rtl:rotate-180` also produces a horizontal flip for a purely horizontal
 * glyph, which is why it kept appearing — but it is a different transform
 * (it flips vertically too), it composes differently with any other transform
 * on the same element, and having two spellings means neither can be linted.
 *
 * `rtl:-scale-x-100` is the spelling `docs/design/theming.md#icons-that-must-mirror`
 * names. An ESLint selector rejects the alternatives in feature code, the
 * design census counts them at a ratchet of 0, and `icons.test.ts` covers
 * `src/design-system/`, which both of those deliberately skip.
 */
export const mirrorInRtl = "rtl:-scale-x-100";

/**
 * Glyphs that carry a reading direction and therefore must mirror.
 *
 * Transcribed from the "Flips" column of
 * `docs/design/theming.md#icons-that-must-mirror`. A vertical glyph
 * (`ChevronDown`, `ArrowUp`) is **not** on this list: rotating a disclosure
 * chevron is direction-neutral and mirroring it would be wrong.
 *
 * Anything whose meaning is fixed in space — a media play control, a logo, a
 * clock — never mirrors, regardless of which way it points.
 */
export const DIRECTIONAL_ICON_NAMES = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeftToLine",
  "ArrowRightToLine",
  "ChevronLeft",
  "ChevronRight",
  "ChevronsLeft",
  "ChevronsRight",
  "MoveLeft",
  "MoveRight",
] as const;

export type DirectionalIconName = (typeof DIRECTIONAL_ICON_NAMES)[number];

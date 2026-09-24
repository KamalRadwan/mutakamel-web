"use client";

import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { toTagColor, type TagColor } from "./tag-color";

// A tag is a value the tenant chose, so it is a chip in sentence case — never
// the Badge primitive, which states a record's STATE in uppercase semibold.
// `sm` is the card-face chip, `xs` the one that fits a dense table cell.
const tagChipVariants = cva(
  "inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border font-medium leading-none",
  {
    variants: {
      size: {
        sm: "px-2 py-0.5 text-xs",
        xs: "px-1.5 py-0.5 text-2xs",
      },
    },
    defaultVariants: { size: "sm" },
  },
);

// The uncoloured chip, and the overflow chip beside a coloured one. Theme-aware
// through the semantic tokens, so it needs no dark: variant.
const NEUTRAL_CHIP = "border-border/70 bg-muted/60 text-muted-foreground";

// The one place a tag's colour reaches the DOM. It is an inline style because
// the pair is tenant data, unknown at build time — no utility can exist for it,
// the same reason chart-common.tsx paints a legend swatch this way. Both values
// passed `toTagColor`, so nothing but `#RRGGBB` is ever interpolated. The border
// is the text colour mixed a quarter into the fill: a pale chip keeps an edge
// on a white card, and a solid one does not grow a grey outline.
function tagColorStyle({ backgroundColor, textColor }: TagColor): CSSProperties {
  return {
    backgroundColor,
    color: textColor,
    borderColor: `color-mix(in srgb, ${textColor} 25%, ${backgroundColor})`,
  };
}

export interface TagChipProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "children" | "color" | "style">,
    VariantProps<typeof tagChipVariants> {
  label: string;
  /** `#RRGGBB`. Used only together with a valid `textColor`. */
  backgroundColor?: string | null;
  /** `#RRGGBB`. Used only together with a valid `backgroundColor`. */
  textColor?: string | null;
  /** Trailing content inside the chip — a remove control, for instance. */
  children?: ReactNode;
}

/**
 * One tag. A coloured tag draws its own background/text pair; an uncoloured
 * one — or one whose pair is missing or malformed — is the neutral chip.
 *
 * Colours are the tenant's, so they are not re-tinted for dark mode: the pair
 * is judged against itself, and a pale chip on a dark card still reads because
 * its text contrast never depended on the page behind it.
 */
export const TagChip = forwardRef<HTMLSpanElement, TagChipProps>(
  ({ label, backgroundColor, textColor, size, className, title, children, ...props }, ref) => {
    const color = toTagColor(backgroundColor, textColor);
    return (
      <span
        ref={ref}
        title={title ?? label}
        className={cn(tagChipVariants({ size }), color === null && NEUTRAL_CHIP, className)}
        style={color ? tagColorStyle(color) : undefined}
        {...props}
      >
        <bdi dir="auto" className="min-w-0 truncate">
          {label}
        </bdi>
        {children}
      </span>
    );
  },
);
TagChip.displayName = "TagChip";

export interface TagChipOverflowProps extends VariantProps<typeof tagChipVariants> {
  /** The visible text, e.g. `+3`. Hidden from assistive technology. */
  label: string;
  /** The names past the visible chips — what a screen reader hears instead. */
  hiddenNames: readonly string[];
  className?: string;
}

/**
 * The `+N` chip after the visible tags. The names it stands for are still
 * announced: a row that silently claims three tags when there are nine is the
 * failure this exists to prevent.
 */
export function TagChipOverflow({ label, hiddenNames, size, className }: TagChipOverflowProps) {
  return (
    <span className={cn(tagChipVariants({ size }), NEUTRAL_CHIP, "shrink-0", className)}>
      <span aria-hidden="true">{label}</span>
      <span className="sr-only">{hiddenNames.join(", ")}</span>
    </span>
  );
}

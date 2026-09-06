// The user-chosen card colour, and the only place its class strings exist.
//
// Eleven marks plus "none". They are NOT a status: a board card's colour is a
// private filing mark whose meaning lives in the head of whoever set it, so no
// role ramp can supply one and the theme flip would collapse Tailwind's own
// families onto four hues if it tried — see the swatch block in
// src/app/globals.css.
//
// Feature code asks for a colour by name and gets a token utility back, which
// is what keeps a raw palette step out of a screen that legitimately needs
// eleven distinguishable colours. Nothing here may carry meaning on its own: the
// picker labels every swatch in words, because a colour with a private meaning
// is exactly the kind that cannot be inferred from the pixel.

export const CARD_COLORS = [
  "RED",
  "ORANGE",
  "AMBER",
  "YELLOW",
  "GREEN",
  "TEAL",
  "BLUE",
  "INDIGO",
  "PURPLE",
  "PINK",
  "SLATE",
] as const;

export type CardColor = (typeof CARD_COLORS)[number];

// Written out rather than built from the name at runtime: Tailwind extracts
// class names by scanning source text, so `bg-swatch-${color}` would generate
// no CSS at all and every swatch would render transparent.
const CARD_COLOR_BORDER: Record<CardColor, string> = {
  RED: "border-swatch-red",
  ORANGE: "border-swatch-orange",
  AMBER: "border-swatch-amber",
  YELLOW: "border-swatch-yellow",
  GREEN: "border-swatch-green",
  TEAL: "border-swatch-teal",
  BLUE: "border-swatch-blue",
  INDIGO: "border-swatch-indigo",
  PURPLE: "border-swatch-purple",
  PINK: "border-swatch-pink",
  SLATE: "border-swatch-slate",
};

const CARD_COLOR_FILL: Record<CardColor, string> = {
  RED: "bg-swatch-red",
  ORANGE: "bg-swatch-orange",
  AMBER: "bg-swatch-amber",
  YELLOW: "bg-swatch-yellow",
  GREEN: "bg-swatch-green",
  TEAL: "bg-swatch-teal",
  BLUE: "bg-swatch-blue",
  INDIGO: "bg-swatch-indigo",
  PURPLE: "bg-swatch-purple",
  PINK: "bg-swatch-pink",
  SLATE: "bg-swatch-slate",
};

export function isCardColor(value: unknown): value is CardColor {
  return CARD_COLORS.includes(value as CardColor);
}

/**
 * The card's border colour. `null` returns nothing, so the card keeps
 * `border-border` and its geometry: the width never changes, only the hue, so
 * picking or clearing a colour cannot nudge the card's contents by a pixel.
 */
export function cardColorBorder(color: CardColor | null): string {
  return color === null ? "" : CARD_COLOR_BORDER[color];
}

/** The filled square a picker shows for one colour. */
export function cardColorFill(color: CardColor): string {
  return CARD_COLOR_FILL[color];
}

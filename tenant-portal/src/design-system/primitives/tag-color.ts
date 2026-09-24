// A tag's colour: a background and a text colour chosen together, by the
// tenant, for any kind of tag in any app — CRM today, Trade and Accounting
// tomorrow. It is not a role and not a status: like a card swatch it is a
// private filing mark, so no ramp supplies it — docs/design/tokens.md
// #tag-colours--a-pair-the-tenant-owns. What this module guarantees instead is
// that the TEXT stays legible: every preset clears WCAG's 4.5:1 against its
// own background, measured by `pnpm design:contrast`, and a custom pair below
// that bar is flagged, never silently accepted as fine.
//
// Colours travel as upper-case `#RRGGBB`, the one form the backends store —
// crm-app's TAG_COLOR_PATTERN in src/crm/tags/dto/tag.dto.ts.

import { contrastRatio, hexToOklch } from "@/lib/branding/brand-ramp";

export interface TagColor {
  backgroundColor: string;
  textColor: string;
}

/** WCAG 2.x AA for body-size text; a tag label is 12–13px. */
export const TAG_COLOR_MIN_CONTRAST = 4.5;

// Thirty pairs: every hue family as a tinted chip (100 background, 800 text),
// the three neutrals, then ten solid chips for tags that must stand out. The
// hex values are Tailwind's published palette, written out because the theme
// flip in globals.css remaps every stock family onto the four roles — so the
// utilities cannot supply them. One preset per line: scripts/design/contrast.mjs
// parses this file and fails the build on a pair under 4.5:1 or a count ≠ 30.
export const TAG_COLOR_PRESETS = [
  { key: "red", backgroundColor: "#FEE2E2", textColor: "#991B1B" },
  { key: "orange", backgroundColor: "#FFEDD5", textColor: "#9A3412" },
  { key: "amber", backgroundColor: "#FEF3C7", textColor: "#92400E" },
  { key: "yellow", backgroundColor: "#FEF9C3", textColor: "#854D0E" },
  { key: "lime", backgroundColor: "#ECFCCB", textColor: "#3F6212" },
  { key: "green", backgroundColor: "#DCFCE7", textColor: "#166534" },
  { key: "emerald", backgroundColor: "#D1FAE5", textColor: "#065F46" },
  { key: "teal", backgroundColor: "#CCFBF1", textColor: "#115E59" },
  { key: "cyan", backgroundColor: "#CFFAFE", textColor: "#155E75" },
  { key: "sky", backgroundColor: "#E0F2FE", textColor: "#075985" },
  { key: "blue", backgroundColor: "#DBEAFE", textColor: "#1E40AF" },
  { key: "indigo", backgroundColor: "#E0E7FF", textColor: "#3730A3" },
  { key: "violet", backgroundColor: "#EDE9FE", textColor: "#5B21B6" },
  { key: "purple", backgroundColor: "#F3E8FF", textColor: "#6B21A8" },
  { key: "fuchsia", backgroundColor: "#FAE8FF", textColor: "#86198F" },
  { key: "pink", backgroundColor: "#FCE7F3", textColor: "#9D174D" },
  { key: "rose", backgroundColor: "#FFE4E6", textColor: "#9F1239" },
  { key: "slate", backgroundColor: "#F1F5F9", textColor: "#1E293B" },
  { key: "gray", backgroundColor: "#F3F4F6", textColor: "#1F2937" },
  { key: "stone", backgroundColor: "#F5F5F4", textColor: "#292524" },
  { key: "redStrong", backgroundColor: "#B91C1C", textColor: "#FFFFFF" },
  { key: "orangeStrong", backgroundColor: "#C2410C", textColor: "#FFFFFF" },
  { key: "amberStrong", backgroundColor: "#FBBF24", textColor: "#451A03" },
  { key: "greenStrong", backgroundColor: "#15803D", textColor: "#FFFFFF" },
  { key: "tealStrong", backgroundColor: "#0F766E", textColor: "#FFFFFF" },
  { key: "blueStrong", backgroundColor: "#1D4ED8", textColor: "#FFFFFF" },
  { key: "indigoStrong", backgroundColor: "#4338CA", textColor: "#FFFFFF" },
  { key: "purpleStrong", backgroundColor: "#7E22CE", textColor: "#FFFFFF" },
  { key: "pinkStrong", backgroundColor: "#BE185D", textColor: "#FFFFFF" },
  { key: "slateStrong", backgroundColor: "#334155", textColor: "#FFFFFF" },
] as const satisfies readonly (TagColor & { key: string })[];

type TagColorPreset = (typeof TAG_COLOR_PRESETS)[number];

const TAG_HEX_COLOR = /^#[0-9A-F]{6}$/;

/**
 * What a person typed, in the canonical form, or `null` when it is not a
 * six-digit hex colour. The `#` is optional so pasting `1d4ed8` works; three-
 * digit shorthand is refused because the backend refuses it.
 */
export function normalizeTagHexColor(value: string): string | null {
  const trimmed = value.trim();
  const candidate = (trimmed.startsWith("#") ? trimmed : `#${trimmed}`).toUpperCase();
  return TAG_HEX_COLOR.test(candidate) ? candidate : null;
}

/**
 * The pair a payload carries, or `null` for an uncoloured tag.
 *
 * Deliberately tolerant: the colours are cosmetic, so a missing, half-set or
 * malformed pair degrades to the neutral chip instead of failing the record
 * that carries the tag. Both sides must be valid for either to be used.
 */
export function toTagColor(backgroundColor: unknown, textColor: unknown): TagColor | null {
  if (typeof backgroundColor !== "string" || typeof textColor !== "string") return null;
  const background = normalizeTagHexColor(backgroundColor);
  const text = normalizeTagHexColor(textColor);
  return background && text ? { backgroundColor: background, textColor: text } : null;
}

export function sameTagColor(a: TagColor | null, b: TagColor | null): boolean {
  if (a === null || b === null) return a === b;
  return a.backgroundColor === b.backgroundColor && a.textColor === b.textColor;
}

/** The WCAG contrast ratio between a pair's text and its background. */
export function tagColorContrast({ backgroundColor, textColor }: TagColor): number {
  const background = hexToOklch(backgroundColor);
  const text = hexToOklch(textColor);
  return background && text ? contrastRatio(text, background) : 1;
}

/** The preset a pair is, so a picker can mark it — or `null` for a custom pair. */
export function findTagColorPreset(color: TagColor | null): TagColorPreset | null {
  if (color === null) return null;
  return TAG_COLOR_PRESETS.find((preset) => sameTagColor(preset, color)) ?? null;
}

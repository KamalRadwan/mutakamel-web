import { contrastInkFor } from '../../color/contrast-ink';
import { FieldOption } from '../../../query-builder/query.model';

export interface TagColorPair {
  bg: string;
  text: string;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Extracts inline tag background and text colours from a FieldOption when provided as hex values. */
export function resolveTagColors(option: FieldOption): TagColorPair | null {
  const raw = option as FieldOption & {
    backgroundColor?: string | null;
    textColor?: string | null;
    bg?: string | null;
    text?: string | null;
  };
  const explicitBg = raw.backgroundColor ?? raw.bg;
  const explicitText = raw.textColor ?? raw.text;
  if (explicitBg && explicitText) {
    return { bg: explicitBg, text: explicitText };
  }
  if (explicitBg && HEX_COLOR.test(explicitBg.trim())) {
    const bg = explicitBg.trim();
    return { bg, text: contrastInkFor(bg) };
  }

  const colorHint = option.colorClass?.trim();
  if (!colorHint) return null;

  const hexMatches = colorHint.match(/#[0-9a-fA-F]{6}/g);
  if (hexMatches && hexMatches.length >= 2) {
    return { bg: hexMatches[0], text: hexMatches[1] };
  }
  if (hexMatches && hexMatches.length === 1 && HEX_COLOR.test(colorHint)) {
    return { bg: colorHint, text: contrastInkFor(colorHint) };
  }
  return null;
}

/** True when a colour string is a CSS hex value (#RGB, #RRGGBB, etc.) rather than a Tailwind class. */
export function isHexColor(value: string | undefined): boolean {
  return Boolean(value && /^#[0-9a-fA-F]{3,8}$/.test(value.trim()));
}

/** True when FieldOption.icon is an asset URL/path rather than a Tabler icon name. */
export function isIconUrl(icon: string | undefined): boolean {
  return Boolean(icon && (icon.includes('/') || icon.includes('.') || icon.startsWith('data:')));
}

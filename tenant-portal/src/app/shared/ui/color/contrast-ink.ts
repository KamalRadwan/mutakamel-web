export type ContrastInk = 'var(--ink-on-light)' | 'var(--ink-on-dark)';

/** WCAG switch point: dark ink wins over white when relative luminance exceeds ~0.179. */
const DARK_INK_MIN_LUMINANCE = 0.179;

/** Theme-fixed text colour (CSS var) that stays readable on a user-chosen background hex (WCAG relative luminance). */
export function contrastInkFor(hex: string): ContrastInk {
  const raw = hex.trim().replace(/^#/, '');
  const wide = raw.length >= 6;
  const channel = (index: number) => {
    const part = wide ? raw.slice(index * 2, index * 2 + 2) : raw[index].repeat(2);
    return Number.parseInt(part, 16) / 255;
  };
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * toLinear(channel(0)) + 0.7152 * toLinear(channel(1)) + 0.0722 * toLinear(channel(2));
  return luminance > DARK_INK_MIN_LUMINANCE ? 'var(--ink-on-light)' : 'var(--ink-on-dark)';
}

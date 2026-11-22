export interface TagPreset {
  readonly key: string;
  readonly bg: string;
  readonly text: string;
}

export const TAG_PRESETS: readonly { key: string; bg: string; text: string }[] = [
  { key: 'red', bg: '#FEE2E2', text: '#991B1B' },
  { key: 'orange', bg: '#FFEDD5', text: '#9A3412' },
  { key: 'amber', bg: '#FEF3C7', text: '#92400E' },
  { key: 'yellow', bg: '#FEF9C3', text: '#854D0E' },
  { key: 'lime', bg: '#ECFCCB', text: '#3F6212' },
  { key: 'green', bg: '#DCFCE7', text: '#166534' },
  { key: 'emerald', bg: '#D1FAE5', text: '#065F46' },
  { key: 'teal', bg: '#CCFBF1', text: '#115E59' },
  { key: 'cyan', bg: '#CFFAFE', text: '#155E75' },
  { key: 'sky', bg: '#E0F2FE', text: '#075985' },
  { key: 'blue', bg: '#DBEAFE', text: '#1E40AF' },
  { key: 'indigo', bg: '#E0E7FF', text: '#3730A3' },
  { key: 'violet', bg: '#EDE9FE', text: '#5B21B6' },
  { key: 'purple', bg: '#F3E8FF', text: '#6B21A8' },
  { key: 'fuchsia', bg: '#FAE8FF', text: '#86198F' },
  { key: 'pink', bg: '#FCE7F3', text: '#9D174D' },
  { key: 'rose', bg: '#FFE4E6', text: '#9F1239' },
  { key: 'slate', bg: '#F1F5F9', text: '#1E293B' },
  { key: 'gray', bg: '#F3F4F6', text: '#1F2937' },
  { key: 'stone', bg: '#F5F5F4', text: '#292524' },
  { key: 'redStrong', bg: '#B91C1C', text: '#FFFFFF' },
  { key: 'orangeStrong', bg: '#C2410C', text: '#FFFFFF' },
  { key: 'amberStrong', bg: '#FBBF24', text: '#451A03' },
  { key: 'greenStrong', bg: '#15803D', text: '#FFFFFF' },
  { key: 'tealStrong', bg: '#0F766E', text: '#FFFFFF' },
  { key: 'blueStrong', bg: '#1D4ED8', text: '#FFFFFF' },
  { key: 'indigoStrong', bg: '#4338CA', text: '#FFFFFF' },
  { key: 'purpleStrong', bg: '#7E22CE', text: '#FFFFFF' },
  { key: 'pinkStrong', bg: '#BE185D', text: '#FFFFFF' },
  { key: 'slateStrong', bg: '#334155', text: '#FFFFFF' },
];

const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/;

export function normalizeHexColor(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function isValidHexColor(value: string | null | undefined): boolean {
  const normalized = normalizeHexColor(value);
  return normalized !== null && HEX_COLOR_PATTERN.test(normalized);
}

export function presetOf(bg: string | null | undefined, text: string | null | undefined): string | null {
  const normBg = normalizeHexColor(bg);
  const normText = normalizeHexColor(text);
  if (!normBg || !normText) return null;
  return TAG_PRESETS.find((preset) => preset.bg === normBg && preset.text === normText)?.key ?? null;
}

function channelLuminance(channelHex: string): number {
  const srgb = Number.parseInt(channelHex, 16) / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const r = channelLuminance(hex.slice(1, 3));
  const g = channelLuminance(hex.slice(3, 5));
  const b = channelLuminance(hex.slice(5, 7));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(bg: string, text: string): number {
  const normBg = normalizeHexColor(bg);
  const normText = normalizeHexColor(text);
  if (!normBg || !normText || !HEX_COLOR_PATTERN.test(normBg) || !HEX_COLOR_PATTERN.test(normText)) {
    return 0;
  }
  const l1 = relativeLuminance(normBg);
  const l2 = relativeLuminance(normText);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export type ColorFormat = 'hex' | 'rgb' | 'hsl';

export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** Opacity percentage in [0, 100]. */
  readonly a: number;
}

export interface HsvColor {
  /** Hue angle in [0, 360]. */
  readonly h: number;
  /** Saturation percentage in [0, 100]. */
  readonly s: number;
  /** Value (brightness) percentage in [0, 100]. */
  readonly v: number;
  /** Opacity percentage in [0, 100]. */
  readonly a: number;
}

export interface HslColor {
  /** Hue angle in [0, 360]. */
  readonly h: number;
  /** Saturation percentage in [0, 100]. */
  readonly s: number;
  /** Lightness percentage in [0, 100]. */
  readonly l: number;
  /** Opacity percentage in [0, 100]. */
  readonly a: number;
}

const HEX_SHORT_RE = /^#([0-9a-f]{3})$/i;
const HEX_SHORT_ALPHA_RE = /^#([0-9a-f]{4})$/i;
const HEX_FULL_RE = /^#([0-9a-f]{6})$/i;
const HEX_FULL_ALPHA_RE = /^#([0-9a-f]{8})$/i;
const BARE_HEX_RE = /^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const RGB_FN_RE = /^rgba?\(\s*([^)]+)\s*\)$/i;
const HSL_FN_RE = /^hsla?\(\s*([^)]+)\s*\)$/i;
const NUMBER_TOKEN_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:%|deg)?$/i;

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function normalizeHue(hue: number): number {
  if (!Number.isFinite(hue)) return 0;
  if (hue === 360) return 360;
  return ((hue % 360) + 360) % 360;
}

function effectiveHue(hue: number): number {
  const norm = normalizeHue(hue);
  return norm === 360 ? 0 : norm;
}

export function alphaPercentToByte(alphaPercent: number): number {
  return Math.round((clamp(alphaPercent, 0, 100) / 100) * 255);
}

export function alphaByteToPercent(byte: number): number {
  return (clamp(Math.round(byte), 0, 255) / 255) * 100;
}

function toHexByte(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0').toUpperCase();
}

export function hsvToRgb(hsv: HsvColor): RgbColor {
  const h = effectiveHue(hsv.h);
  const s = clamp(hsv.s, 0, 100) / 100;
  const v = clamp(hsv.v, 0, 100) / 100;
  const a = clamp(hsv.a, 0, 100);

  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h < 60) {
    r1 = c;
    g1 = x;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
  } else if (h < 180) {
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: clamp(Math.round((r1 + m) * 255), 0, 255),
    g: clamp(Math.round((g1 + m) * 255), 0, 255),
    b: clamp(Math.round((b1 + m) * 255), 0, 255),
    a,
  };
}

export function rgbToHsv(rgb: RgbColor): HsvColor {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;
  const a = clamp(rgb.a, 0, 100);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2);
    } else {
      h = 60 * ((r - g) / delta + 4);
    }
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;

  return { h, s, v, a };
}

export function rgbToHsl(rgb: RgbColor): HslColor {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;
  const a = clamp(rgb.a, 0, 100);

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta > 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) {
      h = 60 * (((g - b) / delta) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / delta + 2);
    } else {
      h = 60 * ((r - g) / delta + 4);
    }
    if (h < 0) h += 360;
  }

  return {
    h,
    s: clamp(s * 100, 0, 100),
    l: clamp(l * 100, 0, 100),
    a,
  };
}

export function hslToRgb(hsl: HslColor): RgbColor {
  const h = effectiveHue(hsl.h);
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;
  const a = clamp(hsl.a, 0, 100);

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h < 60) {
    r1 = c;
    g1 = x;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
  } else if (h < 180) {
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: clamp(Math.round((r1 + m) * 255), 0, 255),
    g: clamp(Math.round((g1 + m) * 255), 0, 255),
    b: clamp(Math.round((b1 + m) * 255), 0, 255),
    a,
  };
}

export function hsvToHsl(hsv: HsvColor): HslColor {
  const h = normalizeHue(hsv.h);
  const s = clamp(hsv.s, 0, 100) / 100;
  const v = clamp(hsv.v, 0, 100) / 100;
  const a = clamp(hsv.a, 0, 100);

  const l = v * (1 - s / 2);
  const sl = l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l);

  return {
    h,
    s: clamp(sl * 100, 0, 100),
    l: clamp(l * 100, 0, 100),
    a,
  };
}

export function hslToHsv(hsl: HslColor): HsvColor {
  const h = normalizeHue(hsl.h);
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;
  const a = clamp(hsl.a, 0, 100);

  const v = l + s * Math.min(l, 1 - l);
  const sv = v === 0 ? 0 : 2 * (1 - l / v);

  return {
    h,
    s: clamp(sv * 100, 0, 100),
    v: clamp(v * 100, 0, 100),
    a,
  };
}

export function rgbToHex(rgb: RgbColor, allowAlpha = true): string {
  const base = `#${toHexByte(rgb.r)}${toHexByte(rgb.g)}${toHexByte(rgb.b)}`;
  if (!allowAlpha) return base;
  const alphaByte = alphaPercentToByte(rgb.a);
  if (alphaByte >= 255) return base;
  return `${base}${toHexByte(alphaByte)}`;
}

export function hsvToHex(hsv: HsvColor, allowAlpha = true): string {
  return rgbToHex(hsvToRgb(hsv), allowAlpha);
}

function splitFunctionalArgs(body: string): { channels: string[]; alpha: string | null } | null {
  const slashParts = body.split('/');
  if (slashParts.length > 2) return null;

  if (slashParts.length === 2) {
    const channelText = slashParts[0]?.trim() ?? '';
    const alphaText = slashParts[1]?.trim() ?? '';
    if (!channelText || !alphaText || channelText.includes(',')) return null;
    const channels = channelText.split(/\s+/).filter(Boolean);
    if (channels.length !== 3) return null;
    return { channels, alpha: alphaText };
  }

  if (body.includes(',')) {
    const parts = body.split(',').map((part) => part.trim());
    if (parts.some((part) => part.length === 0)) return null;
    if (parts.length === 3) return { channels: parts, alpha: null };
    if (parts.length === 4) return { channels: parts.slice(0, 3), alpha: parts[3] ?? null };
    return null;
  }

  const parts = body.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 3) return { channels: parts, alpha: null };
  return null;
}

function parseAlphaToken(token: string | null): number | null {
  if (token === null) return 100;
  if (!NUMBER_TOKEN_RE.test(token) || token.toLowerCase().endsWith('deg')) return null;
  if (token.endsWith('%')) {
    const pct = Number(token.slice(0, -1));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
    return pct;
  }
  const unit = Number(token);
  if (!Number.isFinite(unit) || unit < 0 || unit > 1) return null;
  return unit * 100;
}

function parseRgbChannel(token: string): number | null {
  if (!NUMBER_TOKEN_RE.test(token) || token.toLowerCase().endsWith('deg')) return null;
  if (token.endsWith('%')) {
    const pct = Number(token.slice(0, -1));
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
    return Math.round((pct / 100) * 255);
  }
  const num = Number(token);
  if (!Number.isFinite(num) || num < 0 || num > 255) return null;
  return Math.round(num);
}

function parseHueToken(token: string): number | null {
  if (!NUMBER_TOKEN_RE.test(token) || token.endsWith('%')) return null;
  const raw = token.toLowerCase().endsWith('deg') ? token.slice(0, -3) : token;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  return normalizeHue(num);
}

function parsePercentToken(token: string): number | null {
  if (!NUMBER_TOKEN_RE.test(token) || !token.endsWith('%')) return null;
  const pct = Number(token.slice(0, -1));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  return pct;
}

/**
 * Parses a CSS colour string (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, `rgb()/rgba()`, `hsl()/hsla()`).
 * Returns `null` when the input is empty or invalid.
 */
export function parseColor(input: string | null | undefined, allowAlpha = true): RgbColor | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const shortMatch = HEX_SHORT_RE.exec(trimmed);
  if (shortMatch) {
    const hex = shortMatch[1] ?? '';
    return {
      r: Number.parseInt(hex.slice(0, 1).repeat(2), 16),
      g: Number.parseInt(hex.slice(1, 2).repeat(2), 16),
      b: Number.parseInt(hex.slice(2, 3).repeat(2), 16),
      a: 100,
    };
  }

  const shortAlphaMatch = HEX_SHORT_ALPHA_RE.exec(trimmed);
  if (shortAlphaMatch) {
    const hex = shortAlphaMatch[1] ?? '';
    const alphaByte = Number.parseInt(hex.slice(3, 4).repeat(2), 16);
    return {
      r: Number.parseInt(hex.slice(0, 1).repeat(2), 16),
      g: Number.parseInt(hex.slice(1, 2).repeat(2), 16),
      b: Number.parseInt(hex.slice(2, 3).repeat(2), 16),
      a: allowAlpha ? alphaByteToPercent(alphaByte) : 100,
    };
  }

  const fullMatch = HEX_FULL_RE.exec(trimmed);
  if (fullMatch) {
    const hex = fullMatch[1] ?? '';
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: 100,
    };
  }

  const fullAlphaMatch = HEX_FULL_ALPHA_RE.exec(trimmed);
  if (fullAlphaMatch) {
    const hex = fullAlphaMatch[1] ?? '';
    const alphaByte = Number.parseInt(hex.slice(6, 8), 16);
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
      a: allowAlpha ? alphaByteToPercent(alphaByte) : 100,
    };
  }

  const rgbMatch = RGB_FN_RE.exec(trimmed);
  if (rgbMatch) {
    const parsedArgs = splitFunctionalArgs(rgbMatch[1] ?? '');
    if (!parsedArgs) return null;
    const r = parseRgbChannel(parsedArgs.channels[0] ?? '');
    const g = parseRgbChannel(parsedArgs.channels[1] ?? '');
    const b = parseRgbChannel(parsedArgs.channels[2] ?? '');
    const a = parseAlphaToken(parsedArgs.alpha);
    if (r === null || g === null || b === null || a === null) return null;
    return { r, g, b, a: allowAlpha ? a : 100 };
  }

  const hslMatch = HSL_FN_RE.exec(trimmed);
  if (hslMatch) {
    const parsedArgs = splitFunctionalArgs(hslMatch[1] ?? '');
    if (!parsedArgs) return null;
    const h = parseHueToken(parsedArgs.channels[0] ?? '');
    const s = parsePercentToken(parsedArgs.channels[1] ?? '');
    const l = parsePercentToken(parsedArgs.channels[2] ?? '');
    const a = parseAlphaToken(parsedArgs.alpha);
    if (h === null || s === null || l === null || a === null) return null;
    return hslToRgb({ h, s, l, a: allowAlpha ? a : 100 });
  }

  return null;
}

/**
 * Parses user-typed hex or CSS colour text, accepting bare hex values without a leading `#`
 * when they have 3, 4 (only if `allowAlpha` is true), 6, or 8 (only if `allowAlpha` is true) hex digits.
 */
export function parseColorText(input: string | null | undefined, allowAlpha = true): RgbColor | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (!allowAlpha && (/^#[0-9a-f]{4}$/i.test(trimmed) || /^#[0-9a-f]{8}$/i.test(trimmed))) {
    return null;
  }

  const direct = parseColor(trimmed, allowAlpha);
  if (direct) return direct;

  if (BARE_HEX_RE.test(trimmed)) {
    if (!allowAlpha && (trimmed.length === 4 || trimmed.length === 8)) {
      return null;
    }
    return parseColor(`#${trimmed}`, allowAlpha);
  }

  return null;
}

/**
 * Parses any supported CSS colour string (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`, `rgb()/rgba()`, `hsl()/hsla()`)
 * and normalises it to uppercase `#RRGGBB` (or `#RRGGBBAA` when `alpha < 100` and `allowAlpha` is `true`).
 */
export function normalizeColor(input: string | null | undefined, allowAlpha = true): string | null {
  const parsed = parseColor(input, allowAlpha);
  return parsed ? rgbToHex(parsed, allowAlpha) : null;
}

export function formatRgbString(rgb: RgbColor, allowAlpha = true): string {
  const r = clamp(Math.round(rgb.r), 0, 255);
  const g = clamp(Math.round(rgb.g), 0, 255);
  const b = clamp(Math.round(rgb.b), 0, 255);
  const alphaByte = allowAlpha ? alphaPercentToByte(rgb.a) : 255;
  if (alphaByte >= 255) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  const alphaPct = Number(clamp(rgb.a, 0, 100).toFixed(6));
  return `rgba(${r}, ${g}, ${b}, ${alphaPct}%)`;
}

export function formatHslString(hsl: HslColor, allowAlpha = true): string {
  const h = Number(normalizeHue(hsl.h).toFixed(6));
  const s = Number(clamp(hsl.s, 0, 100).toFixed(6));
  const l = Number(clamp(hsl.l, 0, 100).toFixed(6));
  const alphaByte = allowAlpha ? alphaPercentToByte(hsl.a) : 255;
  if (alphaByte >= 255) {
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
  const alphaPct = Number(clamp(hsl.a, 0, 100).toFixed(6));
  return `hsla(${h}, ${s}%, ${l}%, ${alphaPct}%)`;
}

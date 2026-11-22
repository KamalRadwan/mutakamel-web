import type { TemplateBinding, TemplateTextSegment, TemplateTextTemplate } from '../../templates.model';

export const EMAIL_WIDTH_MIN = 320;
export const EMAIL_WIDTH_MAX = 800;
export const EMAIL_WIDTH_DEFAULT = 600;

export const EMAIL_SUBJECT_MAX_CHARS = 998;
export const EMAIL_PREHEADER_MAX_CHARS = 500;
export const LINK_LABEL_MAX_CHARS = 2000;
export const SAFE_HREF_MAX_CHARS = 2048;
export const TEXT_TEMPLATE_MAX_SEGMENTS = 50;
export const TEXT_SEGMENT_MAX_CHARS = 2000;

const SAFE_COLOR_REGEX = /^#[0-9A-F]{6}([0-9A-F]{2})?$/i;

export function stripLineBreaks(value: string): string {
  return value.replace(/[\r\n]+/g, '');
}

/**
 * Splits a TextTemplate into alternating text slots around binding chips,
 * merging adjacent TEXT segments so `texts.length === bindings.length + 1`.
 */
export function splitTextTemplateToSlots(
  tpl: TemplateTextTemplate | null | undefined,
  singleLine: boolean,
): { texts: string[]; bindings: TemplateBinding[] } {
  const texts: string[] = [''];
  const bindings: TemplateBinding[] = [];

  if (!tpl?.segments) {
    return { texts, bindings };
  }

  for (const seg of tpl.segments) {
    if (seg.kind === 'TEXT') {
      const piece = singleLine ? stripLineBreaks(seg.value) : seg.value;
      texts[texts.length - 1] += piece;
    } else if (seg.kind === 'BINDING') {
      bindings.push(structuredClone(seg.binding));
      texts.push('');
    }
  }

  return { texts, bindings };
}

/**
 * Rebuilds a normalized TextTemplate from alternating text slots and bindings,
 * merging adjacent TEXT segments and dropping empty TEXT segments.
 */
export function buildNormalizedTextTemplate(
  texts: readonly string[],
  bindings: readonly TemplateBinding[],
  singleLine: boolean,
): TemplateTextTemplate | null {
  const segments: TemplateTextSegment[] = [];

  for (let i = 0; i < texts.length; i++) {
    const raw = texts[i] ?? '';
    const value = singleLine ? stripLineBreaks(raw) : raw;
    if (value.length > 0) {
      const prev = segments[segments.length - 1];
      if (prev && prev.kind === 'TEXT') {
        prev.value += value;
      } else {
        segments.push({ kind: 'TEXT', value });
      }
    }

    if (i < bindings.length) {
      segments.push({ kind: 'BINDING', binding: structuredClone(bindings[i]) });
    }
  }

  return segments.length > 0 ? { segments } : null;
}

export function normalizeTextTemplate(
  tpl: TemplateTextTemplate | null | undefined,
  singleLine: boolean,
): TemplateTextTemplate | null {
  const { texts, bindings } = splitTextTemplateToSlots(tpl, singleLine);
  return buildNormalizedTextTemplate(texts, bindings, singleLine);
}

export function areTextTemplatesEqual(
  a: TemplateTextTemplate | null | undefined,
  b: TemplateTextTemplate | null | undefined,
): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Counts only literal TEXT characters; BINDING segments count as 0. */
export function countTextTemplateChars(tpl: TemplateTextTemplate | null | undefined): number {
  if (!tpl?.segments) return 0;
  let total = 0;
  for (const seg of tpl.segments) {
    if (seg.kind === 'TEXT') {
      total += seg.value.length;
    }
  }
  return total;
}

export function countTextTemplateSegments(tpl: TemplateTextTemplate | null | undefined): number {
  return tpl?.segments.length ?? 0;
}

export function hasNonEmptyTextTemplate(tpl: TemplateTextTemplate | null | undefined): boolean {
  if (!tpl?.segments || tpl.segments.length === 0) return false;
  return tpl.segments.some(
    (seg) => seg.kind === 'BINDING' || (seg.kind === 'TEXT' && seg.value.trim().length > 0),
  );
}

export function normalizeSafeColor(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return SAFE_COLOR_REGEX.test(trimmed) ? trimmed.toUpperCase() : undefined;
}

export function isValidSafeColor(raw: string): boolean {
  const trimmed = raw.trim();
  return SAFE_COLOR_REGEX.test(trimmed);
}

export function parseEmailWidthPx(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const num = Number(trimmed);
  return Number.isSafeInteger(num) && num >= EMAIL_WIDTH_MIN && num <= EMAIL_WIDTH_MAX ? num : null;
}

export function isValidSafeHttpsUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > SAFE_HREF_MAX_CHARS) return false;
  if (!trimmed.toLowerCase().startsWith('https://')) return false;
  if (/[\s\u0000-\u001F\u007F]/.test(trimmed)) return false;

  const afterScheme = trimmed.slice('https://'.length);
  const authorityEnd = afterScheme.search(/[/?#]/);
  const authority = authorityEnd === -1 ? afterScheme : afterScheme.slice(0, authorityEnd);
  if (!authority || authority.includes('@')) return false;

  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname.length > 0 &&
      parsed.username === '' &&
      parsed.password === ''
    );
  } catch {
    return false;
  }
}

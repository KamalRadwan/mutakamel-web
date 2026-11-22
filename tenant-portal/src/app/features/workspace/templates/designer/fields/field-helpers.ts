import type {
  TemplateDateStyle,
  TemplateFieldDataType,
  TemplateNodeType,
  TemplatePagePreset,
  TemplateSchemaField,
  TemplateTimeStyle,
} from '../../templates.model';

export const SAFE_COLOR_RE = /^#([0-9A-F]{6}|[0-9A-F]{8})$/;

export function normalizeSafeColor(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidSafeColor(raw: string): boolean {
  const normalized = normalizeSafeColor(raw);
  return SAFE_COLOR_RE.test(normalized);
}

/** Normalize Latin/Arabic text for case-insensitive, diacritic-insensitive search. */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

export function humanizeFieldFallback(path: string): string {
  const cleaned = path.replace(/\[\]/g, '');
  const parts = cleaned.split('.');
  const last = parts[parts.length - 1] ?? path;
  const spaced = last
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
  if (!spaced) return path;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export const FIELD_TYPE_VISUAL: Readonly<Record<TemplateFieldDataType, { icon: string; tile: string }>> = {
  STRING: { icon: 'tablerAbc', tile: 'bg-icon-gray' },
  NUMBER: { icon: 'tablerHash', tile: 'bg-icon-navy' },
  DECIMAL: { icon: 'tablerHash', tile: 'bg-icon-navy' },
  CURRENCY: { icon: 'tablerCash', tile: 'bg-icon-green' },
  PERCENTAGE: { icon: 'tablerPercentage', tile: 'bg-icon-orange' },
  DATE: { icon: 'tablerCalendar', tile: 'bg-icon-blue' },
  DATETIME: { icon: 'tablerCalendar', tile: 'bg-icon-blue' },
  BOOLEAN: { icon: 'tablerToggleLeft', tile: 'bg-icon-teal' },
  IMAGE: { icon: 'tablerPhoto', tile: 'bg-icon-violet' },
  OBJECT: { icon: 'tablerBox', tile: 'bg-icon-teal' },
  ARRAY: { icon: 'tablerList', tile: 'bg-icon-orange' },
};

export const NODE_TYPE_VISUAL: Readonly<Record<TemplateNodeType, { icon: string; tile: string }>> = {
  text: { icon: 'tablerTypography', tile: 'bg-icon-blue' },
  richText: { icon: 'tablerFileText', tile: 'bg-icon-blue' },
  dataField: { icon: 'tablerBraces', tile: 'bg-icon-teal' },
  image: { icon: 'tablerPhoto', tile: 'bg-icon-violet' },
  divider: { icon: 'tablerLine', tile: 'bg-icon-gray' },
  spacer: { icon: 'tablerSpacingVertical', tile: 'bg-icon-gray' },
  container: { icon: 'tablerSection', tile: 'bg-icon-navy' },
  group: { icon: 'tablerBox', tile: 'bg-icon-navy' },
  row: { icon: 'tablerLayoutRows', tile: 'bg-icon-navy' },
  column: { icon: 'tablerLayoutColumns', tile: 'bg-icon-navy' },
  link: { icon: 'tablerLink', tile: 'bg-icon-blue' },
  button: { icon: 'tablerSquare', tile: 'bg-icon-blue' },
  totals: { icon: 'tablerSum', tile: 'bg-icon-green' },
  pageBreak: { icon: 'tablerSeparatorHorizontal', tile: 'bg-icon-gray' },
  header: { icon: 'tablerLayoutNavbar', tile: 'bg-icon-teal' },
  footer: { icon: 'tablerLayoutBottombar', tile: 'bg-icon-teal' },
  staticTable: { icon: 'tablerTable', tile: 'bg-icon-orange' },
  dynamicTable: { icon: 'tablerTableOptions', tile: 'bg-icon-orange' },
  formula: { icon: 'tablerMathFunction', tile: 'bg-icon-violet' },
};

export const SYSTEM_PAGE_FIELDS: readonly TemplateSchemaField[] = [
  {
    path: 'page.number',
    labelKey: 'page.number',
    dataType: 'NUMBER',
    nullable: false,
    parentNullable: false,
    sensitive: false,
    previewAllowed: true,
    allowedFormats: ['NUMBER'],
    valueEncoding: 'INTEGER_STRING',
    maxLength: null,
    minItems: null,
    maxItems: null,
    itemPathPrefix: null,
  },
  {
    path: 'page.count',
    labelKey: 'page.count',
    dataType: 'NUMBER',
    nullable: false,
    parentNullable: false,
    sensitive: false,
    previewAllowed: true,
    allowedFormats: ['NUMBER'],
    valueEncoding: 'INTEGER_STRING',
    maxLength: null,
    minItems: null,
    maxItems: null,
    itemPathPrefix: null,
  },
];

export const PRESET_DIMENSIONS_MM: Readonly<
  Record<Exclude<TemplatePagePreset, 'CUSTOM'>, { width: number; height: number }>
> = {
  A4: { width: 210, height: 297 },
  A5: { width: 148, height: 210 },
  LETTER: { width: 215.9, height: 279.4 },
};

const FIXED_PREVIEW_DATE = new Date(2026, 11, 4, 14, 30, 0);

export function formatDateExample(style: TemplateDateStyle, lang: 'en' | 'ar'): string {
  const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
  if (style === 'SHORT') {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'numeric', day: 'numeric' }).format(
      FIXED_PREVIEW_DATE,
    );
  }
  if (style === 'MEDIUM') {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(
      FIXED_PREVIEW_DATE,
    );
  }
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(
    FIXED_PREVIEW_DATE,
  );
}

export function formatTimeExample(style: TemplateTimeStyle, lang: 'en' | 'ar'): string {
  const locale = lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: style === 'MEDIUM' ? '2-digit' : undefined,
    hourCycle: 'h23',
  }).format(FIXED_PREVIEW_DATE);
}

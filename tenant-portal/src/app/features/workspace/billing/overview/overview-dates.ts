import type { Language } from '../../../../core/i18n/language';

const DATE_FORMATTERS: Record<Language, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }),
  ar: new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }),
};

const DATE_TIME_FORMATTERS: Record<Language, Intl.DateTimeFormat> = {
  en: new Intl.DateTimeFormat('en-u-nu-latn', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }),
  ar: new Intl.DateTimeFormat('ar-u-nu-latn', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }),
};

export function formatBillingDate(iso: string | null | undefined, lang: Language): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return DATE_FORMATTERS[lang].format(new Date(ms));
}

export function formatBillingDateTime(iso: string | null | undefined, lang: Language): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  return DATE_TIME_FORMATTERS[lang].format(new Date(ms));
}

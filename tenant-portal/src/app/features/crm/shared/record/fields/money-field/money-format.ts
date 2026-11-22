import { formatMoneyNumber } from '../../../../../../shared/ui/money/money-format';

function normalizeDecimalChars(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/٫/g, '.')
    .replace(/[٬,]/g, '');
}

function createFormatter(locale: string): Intl.NumberFormat {
  try {
    return new Intl.NumberFormat(locale || 'en', {
      numberingSystem: 'latn',
      useGrouping: true,
    });
  } catch {
    return new Intl.NumberFormat('en', {
      numberingSystem: 'latn',
      useGrouping: true,
    });
  }
}

export function formatMoneyDisplay(value: string | null | undefined, locale = 'en'): string {
  if (value === null || value === undefined) {
    return '';
  }
  const nf = createFormatter(locale);
  const group = nf.formatToParts(1000).find((part) => part.type === 'group')?.value ?? ',';
  const decimal = nf.formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.';
  return formatMoneyNumber(normalizeDecimalChars(value), { group, decimal }) ?? '';
}

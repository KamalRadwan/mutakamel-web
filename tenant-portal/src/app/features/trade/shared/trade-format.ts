import { addThousands, formatMoneyNumber, roundHalfAwayFromZero } from '../../../shared/ui/money/money-format';

interface ParsedDecimal {
  negative: boolean;
  intPart: string;
  fracPart: string;
}

const EN_DATE = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const AR_DATE = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function parseDecimal(raw: string): ParsedDecimal | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let negative = false;
  let unsigned = trimmed;
  if (unsigned.startsWith('-')) {
    negative = true;
    unsigned = unsigned.slice(1);
  } else if (unsigned.startsWith('+')) {
    unsigned = unsigned.slice(1);
  }

  let intPart = '';
  let fracPart = '';
  const fullMatch = /^(\d+)(?:\.(\d*))?$/.exec(unsigned);
  if (fullMatch) {
    intPart = fullMatch[1];
    fracPart = fullMatch[2] ?? '';
  } else {
    const leadingDotMatch = /^\.(\d+)$/.exec(unsigned);
    if (!leadingDotMatch) return null;
    intPart = '0';
    fracPart = leadingDotMatch[1];
  }

  const normalizedInt = intPart.replace(/^0+(?=\d)/, '') || '0';
  return { negative, intPart: normalizedInt, fracPart };
}

function isZeroParts(intPart: string, fracPart: string): boolean {
  return intPart === '0' && /^0*$/.test(fracPart);
}

function withCurrency(currency: string | null, formattedNumber: string): string {
  const code = currency?.trim();
  return code ? `${code} ${formattedNumber}` : formattedNumber;
}

export function formatMoney(currency: string | null, amount: string | null): string {
  const numberText = formatMoneyNumber(amount);
  return numberText === null ? '—' : withCurrency(currency, numberText);
}

export function formatUnitPrice(currency: string | null, amount: string | null): string {
  if (amount === null || amount === undefined || amount.trim() === '') {
    return '—';
  }
  const parsed = parseDecimal(amount);
  if (!parsed) {
    return '—';
  }

  const trimmedFrac = parsed.fracPart.replace(/0+$/, '');
  const frac = trimmedFrac.padEnd(2, '0');
  const sign = parsed.negative && !isZeroParts(parsed.intPart, frac) ? '-' : '';
  const numberText = `${sign}${addThousands(parsed.intPart)}.${frac}`;
  return withCurrency(currency, numberText);
}

export function formatQty(value: string | null): string {
  if (value === null || value === undefined || value.trim() === '') {
    return '—';
  }
  const parsed = parseDecimal(value);
  if (!parsed) {
    return '—';
  }

  const rounded =
    parsed.fracPart.length > 8
      ? roundHalfAwayFromZero(parsed.intPart, parsed.fracPart, 8)
      : { intPart: parsed.intPart, fracPart: parsed.fracPart };
  const trimmedFrac = rounded.fracPart.replace(/0+$/, '');
  const sign = parsed.negative && !isZeroParts(rounded.intPart, trimmedFrac) ? '-' : '';
  const intText = addThousands(rounded.intPart);
  return trimmedFrac ? `${sign}${intText}.${trimmedFrac}` : `${sign}${intText}`;
}

export function formatDate(iso: string, lang: 'en' | 'ar'): string {
  if (!iso || !iso.trim()) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return (lang === 'ar' ? AR_DATE : EN_DATE).format(date);
}

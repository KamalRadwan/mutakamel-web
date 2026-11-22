import { formatMoneyNumber } from '../../../../shared/ui/money/money-format';
import { Money } from '../billing.model';

const MINUS = '\u2212';
const ZERO_PATTERN = /^[+\-\u2212]?0+(?:\.0+)?$/;

interface ParsedDecimal {
  readonly negative: boolean;
  readonly intDigits: string;
  readonly fracDigits: string;
}

function parseDecimal(raw: string): ParsedDecimal | null {
  let trimmed = raw.trim();
  if (!trimmed) return null;

  let negative = false;
  if (trimmed.startsWith('-') || trimmed.startsWith(MINUS)) {
    negative = true;
    trimmed = trimmed.slice(1);
  } else if (trimmed.startsWith('+')) {
    trimmed = trimmed.slice(1);
  }

  const dotIdx = trimmed.indexOf('.');
  const rawInt = dotIdx === -1 ? trimmed : trimmed.slice(0, dotIdx);
  const rawFrac = dotIdx === -1 ? '' : trimmed.slice(dotIdx + 1);

  if (!/^\d+$/.test(rawInt)) return null;
  if (rawFrac.length > 0 && !/^\d+$/.test(rawFrac)) return null;

  return {
    negative,
    intDigits: rawInt.replace(/^0+(?=\d)/, '') || '0',
    fracDigits: rawFrac,
  };
}

function groupThousands(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function incrementDigits(digits: string): string {
  const arr = digits.split('');
  let carry = 1;
  for (let i = arr.length - 1; i >= 0 && carry > 0; i--) {
    const next = arr[i].charCodeAt(0) - 48 + carry;
    if (next === 10) {
      arr[i] = '0';
      carry = 1;
    } else {
      arr[i] = String(next);
      carry = 0;
    }
  }
  return carry > 0 ? `1${arr.join('')}` : arr.join('');
}

export function isZero(value: Money | null): boolean {
  if (value === null) return true;
  return ZERO_PATTERN.test(value.trim());
}

/**
 * A money amount with its currency code, per the shared money rule in
 * `shared/ui/money/money-format.ts` (2 decimals, or a plain integer when the rounded
 * fraction is zero): "1250.5" shows "USD 1,250.50", "1250" shows "USD 1,250".
 * Negative values use the minus sign (U+2212); `signed` adds "+" to positive non-zero values.
 */
export function formatAmount(
  value: Money | null,
  currencyCode: string,
  opts?: { signed?: boolean },
): string {
  if (value === null) return '—';
  const trimmed = value.trim();
  const formatted = formatMoneyNumber(trimmed.startsWith(MINUS) ? `-${trimmed.slice(1)}` : trimmed);
  if (formatted === null) return '—';

  const negative = formatted.startsWith('-');
  const digits = negative ? formatted.slice(1) : formatted;
  const sign = negative ? MINUS : opts?.signed && digits !== '0' ? '+' : '';
  return `${sign}${currencyCode} ${digits}`;
}

/** An exchange rate with 4 decimals (rounded half up), no currency prefix. Unparseable values show a dash. */
export function formatRate(value: Money | null): string {
  if (value === null) return '—';
  const parsed = parseDecimal(value);
  if (!parsed) return '—';

  const paddedFrac = parsed.fracDigits.padEnd(5, '0');
  let digits = `${parsed.intDigits}${paddedFrac.slice(0, 4)}`;
  if (paddedFrac.charCodeAt(4) - 48 >= 5) {
    digits = incrementDigits(digits);
  }
  const intDigits = digits.slice(0, -4) || '0';
  const frac = digits.slice(-4);
  const isZeroRate = /^0+$/.test(intDigits) && frac === '0000';
  return `${parsed.negative && !isZeroRate ? MINUS : ''}${groupThousands(intDigits)}.${frac}`;
}

export function formatUsd(value: Money | null, opts?: { signed?: boolean }): string {
  return formatAmount(value, 'USD', opts);
}

/**
 * A unit price with its currency code. Unit prices keep their stored precision, but trailing
 * zeros are dropped: when at most 2 significant decimals remain the shared money rule applies
 * ("12.0000" shows "USD 12", "12.5000" shows "USD 12.50"); otherwise the significant decimals
 * are kept as stored ("12.3450" shows "USD 12.345", "0.00125" shows "USD 0.00125").
 */
export function formatUnitPrice(value: Money | null, currencyCode = 'USD'): string {
  if (value === null) return '—';
  const parsed = parseDecimal(value);
  if (!parsed) return '—';

  const significantFrac = parsed.fracDigits.replace(/0+$/, '');
  if (significantFrac.length <= 2) {
    const plain = `${parsed.negative ? '-' : ''}${parsed.intDigits}${significantFrac ? `.${significantFrac}` : ''}`;
    return formatAmount(plain, currencyCode);
  }

  const sign = parsed.negative ? MINUS : '';
  return `${sign}${currencyCode} ${groupThousands(parsed.intDigits)}.${significantFrac}`;
}

/** True when decimal string `a` is strictly greater than `b`. Unparseable values return false. */
export function isGreater(a: Money, b: Money): boolean {
  const x = parseDecimal(a);
  const y = parseDecimal(b);
  if (!x || !y) return false;
  const len = Math.max(x.fracDigits.length, y.fracDigits.length);
  const norm = (d: ParsedDecimal): bigint => {
    const v = BigInt(d.intDigits + d.fracDigits.padEnd(len, '0'));
    return d.negative ? -v : v;
  };
  return norm(x) > norm(y);
}

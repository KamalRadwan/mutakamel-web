/**
 * Shared money rule: round to 2 decimals (half away from zero, string-decimal,
 * exact for any size), show a plain integer when the rounded fraction is zero.
 * Digits are always Latin.
 */

interface ParsedDecimal {
  negative: boolean;
  intPart: string;
  fracPart: string;
}

export interface MoneyNumberSeparators {
  group?: string;
  decimal?: string;
}

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

  let intPart: string;
  let fracPart: string;
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

  return { negative, intPart: intPart.replace(/^0+(?=\d)/, '') || '0', fracPart };
}

/** Half away from zero on the magnitude, with decimal-string carry (no float). */
export function roundHalfAwayFromZero(
  intPart: string,
  fracPart: string,
  decimals: number,
): { intPart: string; fracPart: string } {
  if (fracPart.length <= decimals) {
    return { intPart, fracPart: fracPart.padEnd(decimals, '0') };
  }

  const keptFrac = fracPart.slice(0, decimals);
  if (fracPart.charCodeAt(decimals) - 48 < 5) {
    return { intPart, fracPart: keptFrac };
  }

  const digits = (intPart + keptFrac).split('');
  let carry = 1;
  for (let i = digits.length - 1; i >= 0 && carry > 0; i -= 1) {
    const sum = digits[i].charCodeAt(0) - 48 + carry;
    digits[i] = String(sum % 10);
    carry = sum >= 10 ? 1 : 0;
  }
  if (carry > 0) {
    digits.unshift('1');
  }

  const rounded = digits.join('');
  if (decimals === 0) {
    return { intPart: rounded, fracPart: '' };
  }
  const splitAt = rounded.length - decimals;
  return { intPart: rounded.slice(0, splitAt), fracPart: rounded.slice(splitAt) };
}

export function addThousands(intPart: string, group = ','): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, group);
}

/**
 * A decimal (string or number) as a plain 2-decimal string: "1200000.00", no grouping.
 * This is the wire shape of money fields (targets, remaining, pace). Returns null when not a decimal.
 */
export function toMoneyString(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const parsed = parseDecimal(typeof raw === 'number' ? numberToPlain(raw) : raw);
  if (!parsed) return null;
  const rounded = roundHalfAwayFromZero(parsed.intPart, parsed.fracPart, 2);
  const isZero = rounded.intPart === '0' && rounded.fracPart === '00';
  return `${parsed.negative && !isZero ? '-' : ''}${rounded.intPart}.${rounded.fracPart}`;
}

function numberToPlain(v: number): string {
  if (!Number.isFinite(v)) return '';
  const raw = String(v);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(raw);
  if (!match) return raw;
  const sign = match[1] === '-' ? '-' : '';
  const digits = match[2] + (match[3] ?? '');
  const exp = Number(match[4]) - (match[3]?.length ?? 0);
  if (exp >= 0) return `${sign}${digits}${'0'.repeat(exp)}`;
  const pos = digits.length + exp;
  return pos > 0 ? `${sign}${digits.slice(0, pos)}.${digits.slice(pos)}` : `${sign}0.${'0'.repeat(-pos)}${digits}`;
}

/**
 * Formats a plain decimal string per the money rule, without currency.
 * Returns null when the input is empty or not a decimal.
 */
export function formatMoneyNumber(raw: string | null | undefined, separators: MoneyNumberSeparators = {}): string | null {
  if (raw === null || raw === undefined) return null;
  const parsed = parseDecimal(raw);
  if (!parsed) return null;

  const rounded = roundHalfAwayFromZero(parsed.intPart, parsed.fracPart, 2);
  const isZero = rounded.intPart === '0' && rounded.fracPart === '00';
  const sign = parsed.negative && !isZero ? '-' : '';
  const intText = addThousands(rounded.intPart, separators.group ?? ',');
  return rounded.fracPart === '00' ? `${sign}${intText}` : `${sign}${intText}${separators.decimal ?? '.'}${rounded.fracPart}`;
}

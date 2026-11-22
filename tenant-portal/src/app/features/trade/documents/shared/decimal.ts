import type { Dec } from './document.model';

interface ParsedDecimal {
  unscaled: bigint;
  scale: number;
}

export interface IsDecimalOptions {
  positive?: boolean;
  signed?: boolean;
  maxDecimals?: number;
}

const ARITHMETIC_DECIMAL_RE = /^(-)?(\d+)(?:\.(\d+))?$/;
const STRICT_UNSIGNED_DECIMAL_RE = /^(0|[1-9]\d{0,15})(?:\.(\d+))?$/;

function parse(value: Dec): ParsedDecimal {
  const match = ARITHMETIC_DECIMAL_RE.exec(value);
  if (!match) {
    throw new Error(`Invalid decimal string: "${value}"`);
  }
  const negative = match[1] === '-';
  const intPart = match[2];
  const fracPart = match[3] ?? '';
  const raw = BigInt(`${intPart}${fracPart}`);
  return {
    unscaled: negative && raw !== 0n ? -raw : raw,
    scale: fracPart.length,
  };
}

function format(unscaled: bigint, scale: number): Dec {
  if (unscaled === 0n) {
    return '0';
  }
  const negative = unscaled < 0n;
  const digits = (negative ? -unscaled : unscaled).toString();
  const sign = negative ? '-' : '';
  if (scale === 0) {
    return `${sign}${digits}`;
  }
  const padded = digits.padStart(scale + 1, '0');
  const splitAt = padded.length - scale;
  const intPart = padded.slice(0, splitAt);
  const fracPart = padded.slice(splitAt).replace(/0+$/, '');
  return fracPart ? `${sign}${intPart}.${fracPart}` : `${sign}${intPart}`;
}

function roundParsed(unscaled: bigint, scale: number, dp: number): Dec {
  if (!Number.isInteger(dp) || dp < 0) {
    throw new RangeError(`Decimal places must be a non-negative integer, got ${dp}`);
  }
  if (scale <= dp) {
    return format(unscaled, scale);
  }
  const factor = 10n ** BigInt(scale - dp);
  const negative = unscaled < 0n;
  const abs = negative ? -unscaled : unscaled;
  let quotient = abs / factor;
  const remainder = abs % factor;
  // Half-up away from zero (symmetric for negative numbers).
  if (remainder * 2n >= factor) {
    quotient += 1n;
  }
  return format(negative && quotient !== 0n ? -quotient : quotient, dp);
}

function align(a: Dec, b: Dec): { left: bigint; right: bigint; scale: number } {
  const pa = parse(a);
  const pb = parse(b);
  const scale = Math.max(pa.scale, pb.scale);
  const left = pa.unscaled * 10n ** BigInt(scale - pa.scale);
  const right = pb.unscaled * 10n ** BigInt(scale - pb.scale);
  return { left, right, scale };
}

export function add(a: Dec, b: Dec): Dec {
  const { left, right, scale } = align(a, b);
  return format(left + right, scale);
}

export function sub(a: Dec, b: Dec): Dec {
  const { left, right, scale } = align(a, b);
  return format(left - right, scale);
}

export function mul(a: Dec, b: Dec, dp = 8): Dec {
  const pa = parse(a);
  const pb = parse(b);
  return roundParsed(pa.unscaled * pb.unscaled, pa.scale + pb.scale, dp);
}

export function round(a: Dec, dp: number): Dec {
  const pa = parse(a);
  return roundParsed(pa.unscaled, pa.scale, dp);
}

export function cmp(a: Dec, b: Dec): -1 | 0 | 1 {
  const { left, right } = align(a, b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function isZero(a: Dec): boolean {
  return parse(a).unscaled === 0n;
}

export function neg(a: Dec): Dec {
  const pa = parse(a);
  return format(-pa.unscaled, pa.scale);
}

export function isDecimal(value: string, opts?: IsDecimalOptions): boolean {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  let unsigned = value;
  if (unsigned.startsWith('-')) {
    if (!opts?.signed) {
      return false;
    }
    unsigned = unsigned.slice(1);
  }
  const match = STRICT_UNSIGNED_DECIMAL_RE.exec(unsigned);
  if (!match) {
    return false;
  }
  const fracPart = match[2] ?? '';
  const maxDecimals = opts?.maxDecimals ?? 8;
  if (fracPart.length > maxDecimals) {
    return false;
  }
  if (opts?.positive) {
    return cmp(value, '0') > 0;
  }
  return true;
}

/** Percent cap for messages: rounded to 2 decimals, integer when whole. */
export function formatPercentCap(value: string): string {
  if (!ARITHMETIC_DECIMAL_RE.test(value)) return value;
  const rounded = round(value, 2);
  return rounded.replace(/\.00$/, '');
}

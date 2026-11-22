import type { BadgeTone } from '../../../shared/ui/badge/badge';
import { currentUiLang } from './governance-fake-actors';
import type {
  GovernanceState,
  PriceBookStatus,
  PromotionInput,
  PromotionRule,
  VersionHead,
} from './pricing.model';

interface ParsedDecimal {
  negative: boolean;
  intPart: string;
  fracPart: string;
}

const FOUR_DECIMAL_CURRENCIES = new Set(['CLF', 'UYW']);

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

const EN_DATE_TIME = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const AR_DATE_TIME = new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
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
  const match = /^(\d+)(?:\.(\d*))?$/.exec(unsigned);
  if (match) {
    intPart = match[1];
    fracPart = match[2] ?? '';
  } else {
    const dotMatch = /^\.(\d+)$/.exec(unsigned);
    if (!dotMatch) return null;
    intPart = '0';
    fracPart = dotMatch[1];
  }

  return {
    negative,
    intPart: intPart.replace(/^0+(?=\d)/, '') || '0',
    fracPart,
  };
}

function roundHalfUp(
  intPart: string,
  fracPart: string,
  decimals: number,
): { intPart: string; fracPart: string } {
  if (fracPart.length <= decimals) {
    return {
      intPart,
      fracPart: fracPart.padEnd(decimals, '0'),
    };
  }

  const keptFrac = fracPart.slice(0, decimals);
  const nextDigit = fracPart.charCodeAt(decimals) - 48;
  if (nextDigit < 5) {
    return { intPart, fracPart: keptFrac };
  }

  const digits = (intPart + keptFrac).split('');
  let carry = 1;
  for (let i = digits.length - 1; i >= 0 && carry > 0; i -= 1) {
    const sum = digits[i].charCodeAt(0) - 48 + carry;
    if (sum >= 10) {
      digits[i] = String(sum - 10);
      carry = 1;
    } else {
      digits[i] = String(sum);
      carry = 0;
    }
  }
  if (carry > 0) {
    digits.unshift('1');
  }

  const rounded = digits.join('');
  if (decimals === 0) {
    return { intPart: rounded, fracPart: '' };
  }
  const splitAt = rounded.length - decimals;
  return {
    intPart: rounded.slice(0, splitAt),
    fracPart: rounded.slice(splitAt),
  };
}

function addThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function isZeroParts(intPart: string, fracPart: string): boolean {
  return intPart === '0' && /^0*$/.test(fracPart);
}

export function formatMoney(
  code: string | null | undefined,
  amount: string | null | undefined,
  decimals = 3,
): string {
  if (amount === null || amount === undefined || !amount.trim()) {
    return '—';
  }
  const parsed = parseDecimal(amount);
  if (!parsed) {
    return '—';
  }
  const normalizedCode = code?.trim().toUpperCase() ?? '';
  const targetDecimals =
    decimals === 3 && FOUR_DECIMAL_CURRENCIES.has(normalizedCode) ? 4 : Math.max(0, decimals);

  const rounded = roundHalfUp(parsed.intPart, parsed.fracPart, targetDecimals);
  const sign = parsed.negative && !isZeroParts(rounded.intPart, rounded.fracPart) ? '-' : '';
  const intText = addThousands(rounded.intPart);
  const numberText =
    targetDecimals > 0 ? `${sign}${intText}.${rounded.fracPart}` : `${sign}${intText}`;
  return normalizedCode ? `${normalizedCode} ${numberText}` : numberText;
}

export function formatUnitPrice(
  code: string | null | undefined,
  amount: string | null | undefined,
): string {
  if (amount === null || amount === undefined || !amount.trim()) {
    return '—';
  }
  const parsed = parseDecimal(amount);
  if (!parsed) {
    return '—';
  }
  const normalizedCode = code?.trim().toUpperCase() ?? '';
  const trimmedFrac = parsed.fracPart.slice(0, 8);
  const frac = trimmedFrac.length > 0 ? trimmedFrac : '000';
  const sign = parsed.negative && !isZeroParts(parsed.intPart, frac) ? '-' : '';
  const numberText = `${sign}${addThousands(parsed.intPart)}.${frac}`;
  return normalizedCode ? `${normalizedCode} ${numberText}` : numberText;
}

export function governanceStateTone(state: GovernanceState): BadgeTone {
  switch (state) {
    case 'PUBLISHED':
      return 'success';
    case 'SCHEDULED':
      return 'brand';
    case 'TESTED':
      return 'tag';
    case 'DRAFT_ONLY':
      return 'warning';
    case 'INACTIVE':
      return 'none';
  }
}

/**
 * The backend list carries no governance state; it filters with PriceBookGovernanceFilter.
 * This mirrors those filters on the book status and its version heads, first match wins.
 */
export function bookGovernanceState(
  book: { status: PriceBookStatus; versions: readonly VersionHead[] },
  now: Date | number = Date.now(),
): GovernanceState {
  if (book.status === 'INACTIVE') return 'INACTIVE';
  const nowMs = now instanceof Date ? now.getTime() : now;
  const live = book.versions.some((v) => {
    if (v.status !== 'PUBLISHED' && v.status !== 'SCHEDULED') return false;
    const end = v.supersededAt ?? v.effectiveTo;
    return Date.parse(v.effectiveFrom) <= nowMs && (!end || Date.parse(end) > nowMs);
  });
  if (live) return 'PUBLISHED';
  if (book.versions.some((v) => v.status === 'SCHEDULED' && Date.parse(v.effectiveFrom) > nowMs)) {
    return 'SCHEDULED';
  }
  if (book.versions.some((v) => v.status === 'TESTED')) return 'TESTED';
  return 'DRAFT_ONLY';
}

/** A stored promotion back to the flat PromotionChangeDto body. */
export function promotionToInput(rule: PromotionRule): PromotionInput {
  const { selector } = rule;
  return {
    id: rule.id,
    code: rule.code,
    name: rule.name,
    ...(selector.itemId ? { itemId: selector.itemId } : {}),
    ...(selector.uomId ? { uomId: selector.uomId } : {}),
    ...(selector.branchId ? { branchId: selector.branchId } : {}),
    ...(selector.channelId ? { channelId: selector.channelId } : {}),
    ...(selector.partyId ? { partyId: selector.partyId } : {}),
    minimumQuantity: selector.minimumQuantity,
    maximumQuantity: selector.maximumQuantity,
    benefitType: rule.benefit.type,
    discountValue: rule.benefit.value,
    priority: rule.priority,
    stackGroup: rule.stackGroup,
    exclusive: rule.exclusive,
  };
}

export function isLiveScheduled(
  v: Pick<VersionHead, 'status' | 'effectiveFrom' | 'effectiveTo'>,
  now: Date | number | string = Date.now(),
): boolean {
  if (v.status !== 'SCHEDULED') {
    return false;
  }
  const nowMs = now instanceof Date ? now.getTime() : typeof now === 'string' ? Date.parse(now) : now;
  const fromMs = Date.parse(v.effectiveFrom);
  if (Number.isNaN(nowMs) || Number.isNaN(fromMs) || fromMs > nowMs) {
    return false;
  }
  if (!v.effectiveTo) {
    return true;
  }
  const toMs = Date.parse(v.effectiveTo);
  return Number.isNaN(toMs) || nowMs < toMs;
}

export function formatDateOnly(
  iso: string | null | undefined,
  lang: 'en' | 'ar' = currentUiLang(),
): string {
  if (!iso || !iso.trim()) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return (lang === 'ar' ? AR_DATE : EN_DATE).format(date);
}

export function formatDateTime(
  iso: string | null | undefined,
  lang: 'en' | 'ar' = currentUiLang(),
): string {
  if (!iso || !iso.trim()) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return (lang === 'ar' ? AR_DATE_TIME : EN_DATE_TIME).format(date);
}

export function rangeText(
  from: string | null | undefined,
  to: string | null | undefined,
  lang: 'en' | 'ar' = currentUiLang(),
): string {
  if (!from || !from.trim()) {
    return '—';
  }
  const fromLabel = formatDateOnly(from, lang);
  if (fromLabel === '—') {
    return '—';
  }
  if (!to || !to.trim()) {
    return lang === 'ar' ? `من ${fromLabel} · بلا نهاية` : `From ${fromLabel} · open-ended`;
  }
  const toLabel = formatDateOnly(to, lang);
  return `${fromLabel} – ${toLabel}`;
}

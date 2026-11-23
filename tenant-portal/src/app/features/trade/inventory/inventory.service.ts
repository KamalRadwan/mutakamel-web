import { ApiError } from '../shared/trade-api';
import { formatQty } from '../shared/trade-format';
import type { LedgerEntry, MovementType } from './inventory.model';

const DECIMAL_INPUT_PATTERN = /^([+-])?(\d+)(?:\.(\d+))?$/;
const POSITIVE_INT_PATTERN = /^[1-9]\d*$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SCALE = 100_000_000n;
const DAY_MS = 86_400_000;

const KNOWN_REASON_KEYS: ReadonlySet<string> = new Set([
  'TRADE_INVENTORY_PERIOD_CLOSED.INVALID_RANGE',
  'TRADE_INVENTORY_PERIOD_CLOSED.OVERLAPPING_PERIOD',
  'TRADE_INVENTORY_PERIOD_CLOSED.TRANSITION_NOT_ALLOWED',
  'TRADE_INVENTORY_PERIOD_CLOSED.OVERLAPPING_OPEN_PERIOD',
  'TRADE_INVENTORY_PERIOD_CONFLICT.PERIOD_MISSING',
  'TRADE_INVENTORY_PERIOD_CONFLICT.PERIOD_CLOSED',
  'TRADE_INVENTORY_PERIOD_CONFLICT.FUTURE_DATE',
  'TRADE_INVENTORY_PERIOD_CONFLICT.BACKDATE_LIMIT',
  'TRADE_INVENTORY_UOM_CONVERSION_INVALID.IDENTITY_NOT_REQUIRED',
  'TRADE_INVENTORY_UOM_CONVERSION_INVALID.UOM_NOT_REGISTERED_FOR_ITEM',
  'TRADE_INVENTORY_UOM_CONVERSION_INVALID.TRANSITION_NOT_ALLOWED',
  'TRADE_INVENTORY_UOM_CONVERSION_INVALID.FUTURE_REPLACEMENT_UNSUPPORTED',
  'TRADE_INVENTORY_UOM_CONVERSION_INVALID.EFFECTIVE_FROM_NOT_AFTER_PREDECESSOR',
  'TRADE_INVENTORY_UOM_CONVERSION_INVALID.NON_EXACT_RESULT',
  'TRADE_INVENTORY_QUANTITY_INVALID.UOM_REQUIRED_FOR_AMBIGUOUS_BALANCE',
]);

const OBJECT_ERROR_CODES: ReadonlySet<string> = new Set([
  'TRADE_INVENTORY_PERIOD_CLOSED',
  'TRADE_INVENTORY_PERIOD_CONFLICT',
  'TRADE_INVENTORY_UOM_CONVERSION_INVALID',
  'TRADE_INVENTORY_QUANTITY_INVALID',
]);

const STRING_ERROR_CODES: ReadonlySet<string> = new Set([
  'TRADE_VALIDATION_FAILED',
  'TRADE_CONCURRENCY_STALE_VERSION',
  'TRADE_IDEMPOTENCY_KEY_MISSING',
  'TRADE_IDEMPOTENCY_MISMATCH',
  'TRADE_INVENTORY_NODE_CONFLICT',
  'TRADE_INVENTORY_NODE_INVALID',
  'TRADE_INVENTORY_NODE_IN_USE',
  'TRADE_INVENTORY_NODE_NOT_FOUND',
  'TRADE_INVENTORY_SCOPE_INVALID',
  'TRADE_INVENTORY_PERIOD_NOT_FOUND',
  'TRADE_INVENTORY_PERIOD_CODE_TAKEN',
  'TRADE_INVENTORY_SCOPE_NOT_FOUND',
  'TRADE_INVENTORY_ITEM_NOT_STOCK_TRACKED',
  'TRADE_INVENTORY_ITEM_TRACKING_CONFLICT',
  'TRADE_INVENTORY_TRACKING_UNSUPPORTED',
  'TRADE_INVENTORY_UOM_CONVERSION_UNAVAILABLE',
  'TRADE_INVENTORY_INSUFFICIENT_AVAILABILITY',
  'TRADE_INVENTORY_TRACKING_REQUIRED',
  'TRADE_INVENTORY_SERIAL_CONFLICT',
  'TRADE_INVENTORY_SERIAL_NOT_FOUND',
  'TRADE_INVENTORY_QUANTITY_CONFLICT',
  'TRADE_INVENTORY_REVERSAL_NOT_ALLOWED',
  'TRADE_INVENTORY_POLICY_REJECTED',
  'TRADE_REASON_NOT_FOUND',
  'TRADE_REASON_INACTIVE',
  'TRADE_REASON_KIND_INVALID',
  'TRADE_INVENTORY_MOVEMENT_NOT_FOUND',
  'TRADE_INVENTORY_RECEIPT_NOT_FOUND',
  'TRADE_INVENTORY_DELIVERY_NOT_FOUND',
  'TRADE_INVENTORY_DECISION_NOT_FOUND',
]);

function parseUtcDate(raw: string): number | null {
  const match = ISO_DATE_PATTERN.exec(raw.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

/**
 * The backend error reason: `details.reason[0]`, a lower_snake value
 * (for example `overlapping_period`). Null when the error carries none.
 */
export function errorReason(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.details) return null;
  const raw = (error.details as Record<string, unknown>)['reason'];
  if (Array.isArray(raw) && typeof raw[0] === 'string') {
    const trimmed = raw[0].trim();
    return trimmed || null;
  }
  return null;
}

/**
 * Quantities arrive as numeric(24,8) text ("10.00000000"); the shared Trade
 * formatter trims trailing zeros and groups thousands.
 */
export function formatQuantity(value: string, _lang: 'en' | 'ar'): string {
  return formatQty(value);
}

export function signOf(value: string): -1 | 0 | 1 {
  const match = DECIMAL_INPUT_PATTERN.exec(value.trim());
  if (!match) return 0;
  const intPart = match[2].replace(/^0+/, '');
  const fracPart = (match[3] ?? '').replace(/0+$/, '');
  if (!intPart && !fracPart) return 0;
  return match[1] === '-' ? -1 : 1;
}

export function factorText(num: string, den: string): string {
  const nRaw = num.trim();
  const dRaw = den.trim();
  if (!POSITIVE_INT_PATTERN.test(nRaw) || !POSITIVE_INT_PATTERN.test(dRaw)) {
    return `${num}/${den}`;
  }

  const n = BigInt(nRaw);
  const d = BigInt(dRaw);
  const numeratorScaled = n * SCALE;
  if (numeratorScaled % d !== 0n) {
    return `${nRaw}/${dRaw}`;
  }

  const scaled = numeratorScaled / d;
  const intPart = scaled / SCALE;
  const frac = (scaled % SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  return frac ? `${intPart}.${frac}` : intPart.toString();
}

export function convertPreview(qty: string, num: string, den: string): string | null {
  const trimmed = qty.trim();
  const match = DECIMAL_INPUT_PATTERN.exec(trimmed);
  const nRaw = num.trim();
  const dRaw = den.trim();
  if (!match || !POSITIVE_INT_PATTERN.test(nRaw) || !POSITIVE_INT_PATTERN.test(dRaw)) {
    return null;
  }

  const negative = match[1] === '-';
  const intDigits = match[2];
  const fracDigits = match[3] ?? '';
  const qtyInteger = BigInt(intDigits + fracDigits);
  const qtyScale = 10n ** BigInt(fracDigits.length);

  const totalNum = qtyInteger * BigInt(nRaw);
  const totalDen = BigInt(dRaw) * qtyScale;
  const scaledNum = totalNum * SCALE;
  if (scaledNum % totalDen !== 0n) {
    return null;
  }

  const scaled = scaledNum / totalDen;
  const intPart = scaled / SCALE;
  const frac = (scaled % SCALE).toString().padStart(8, '0').replace(/0+$/, '');
  const sign = negative && scaled > 0n ? '-' : '';
  return frac ? `${sign}${intPart}.${frac}` : `${sign}${intPart}`;
}

export function periodDays(startsOn: string, endsOn: string): number {
  const startMs = parseUtcDate(startsOn);
  const endMs = parseUtcDate(endsOn);
  if (startMs === null || endMs === null || endMs < startMs) {
    return 0;
  }
  return Math.round((endMs - startMs) / DAY_MS) + 1;
}

export function itemName(
  names: Record<string, string> | null | undefined,
  lang: 'en' | 'ar' | string,
): string {
  if (!names) return '';
  const byLang = names[lang]?.trim();
  if (byLang) return byLang;
  const byEn = names['en']?.trim();
  if (byEn) return byEn;
  for (const val of Object.values(names)) {
    const trimmed = val?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

export function hasBranchGrant(grants: 'ALL' | ReadonlySet<string>, branchId: string | null): boolean {
  if (grants === 'ALL') return true;
  return branchId ? grants.has(branchId) : grants.size > 0;
}

export function hasCompanyGrant(
  grants: 'ALL' | ReadonlySet<string>,
  branchId: string | null,
  companyBranchIds: readonly string[],
): boolean {
  if (grants === 'ALL') return true;
  if (branchId) return grants.has(branchId);
  if (companyBranchIds.length > 0) {
    return companyBranchIds.some((id) => grants.has(id));
  }
  return grants.size > 0;
}

export function movementGroup(type: MovementType): 'OPENING' | 'RECEIPT' | 'DELIVERY' | 'REVERSAL' {
  switch (type) {
    case 'OPENING_BALANCE':
      return 'OPENING';
    case 'PURCHASE_RECEIPT':
      return 'RECEIPT';
    case 'SALES_DELIVERY':
      return 'DELIVERY';
    case 'PURCHASE_RECEIPT_REVERSAL':
    case 'SALES_DELIVERY_REVERSAL':
      return 'REVERSAL';
  }
}

export function errorKey(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof TypeError ? 'tradeInventory.errors.network' : 'tradeInventory.errors.generic';
  }
  if (error.status === 0) {
    return 'tradeInventory.errors.network';
  }

  const normalized = error.code.replaceAll('.', '_');
  const reason = errorReason(error);
  if (reason) {
    const reasonKey = `${normalized}.${reason.toUpperCase()}`;
    if (KNOWN_REASON_KEYS.has(reasonKey)) {
      return `tradeInventory.errors.${reasonKey}`;
    }
  }

  if (OBJECT_ERROR_CODES.has(normalized)) {
    return `tradeInventory.errors.${normalized}.default`;
  }
  if (STRING_ERROR_CODES.has(normalized)) {
    return `tradeInventory.errors.${normalized}`;
  }
  if (error.status === 403) {
    return 'tradeInventory.errors.permission';
  }
  return 'tradeInventory.errors.generic';
}

/** Shortens a long id to `abcd…wxyz`; ids of 12 characters or fewer are returned as they are. */
export function shortId(id: string | null | undefined): string {
  const trimmed = id?.trim();
  if (!trimmed) return '—';
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

/** Formats an ISO instant as `dd/MM/yyyy HH:mm` in local time; empty or invalid input gives `—`. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).padStart(4, '0')} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * The one rule for offering Reverse on a movement (row menu and detail modal): the user may adjust,
 * the entry is a receipt or delivery with a source document, nothing reversible is exhausted, and
 * the source document, when known, is not already fully reversed.
 */
export function canReverseEntry(
  entry: Pick<LedgerEntry, 'movementType' | 'sourceId' | 'remainingReversibleQuantity'>,
  canAdjust: boolean,
  sourceStatus?: string | null,
): boolean {
  if (!canAdjust) return false;
  if (entry.movementType !== 'PURCHASE_RECEIPT' && entry.movementType !== 'SALES_DELIVERY') return false;
  if (!entry.sourceId) return false;
  if (sourceStatus === 'REVERSED') return false;
  if (entry.remainingReversibleQuantity !== null && signOf(entry.remainingReversibleQuantity) <= 0) return false;
  return true;
}

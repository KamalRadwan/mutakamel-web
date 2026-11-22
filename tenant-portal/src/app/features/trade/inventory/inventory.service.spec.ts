import { describe, expect, it } from 'vitest';
import { ApiError } from '../shared/trade-api';
import {
  convertPreview,
  errorKey,
  factorText,
  formatQuantity,
  itemName,
  movementGroup,
  periodDays,
  signOf,
} from './inventory.service';

describe('inventory.service formatQuantity', () => {
  it('groups thousands and trims trailing fraction zeros', () => {
    expect(formatQuantity('1234567.5000', 'en')).toBe('1,234,567.5');
  });

  it('returns a dash for blank input', () => {
    expect(formatQuantity('   ', 'en')).toBe('—');
  });

  it('collapses any zero to plain 0', () => {
    expect(formatQuantity('-0.000', 'en')).toBe('0');
  });

  it('keeps the minus sign on negative quantities', () => {
    expect(formatQuantity('-6', 'en')).toBe('-6');
  });

  it('shows a dash for non-decimal text (shared Trade formatter)', () => {
    expect(formatQuantity('abc', 'ar')).toBe('—');
  });

  it('formats numeric(24,8) read text without the trailing zeros', () => {
    expect(formatQuantity('10.00000000', 'en')).toBe('10');
    expect(formatQuantity('-2.50000000', 'en')).toBe('-2.5');
  });
});

describe('inventory.service signOf', () => {
  it('returns -1, 0 and 1 for negative, zero and positive', () => {
    expect(signOf('-3')).toBe(-1);
    expect(signOf('0.000')).toBe(0);
    expect(signOf('+2.5')).toBe(1);
  });

  it('returns 0 for unparsable text', () => {
    expect(signOf('x')).toBe(0);
  });
});

describe('inventory.service factorText and convertPreview', () => {
  it('renders an exact decimal factor', () => {
    expect(factorText('12', '1')).toBe('12');
    expect(factorText('1', '4')).toBe('0.25');
  });

  it('renders a non-terminating factor as a fraction', () => {
    expect(factorText('1', '3')).toBe('1/3');
  });

  it('echoes invalid factor parts', () => {
    expect(factorText('0', '5')).toBe('0/5');
  });

  it('converts a quantity by the factor', () => {
    expect(convertPreview('2.5', '12', '1')).toBe('30');
  });

  it('keeps the sign of a negative quantity', () => {
    expect(convertPreview('-2', '12', '1')).toBe('-24');
  });

  it('returns null when the result is not exact within 8 decimals', () => {
    expect(convertPreview('1', '1', '3')).toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(convertPreview('x', '1', '1')).toBeNull();
    expect(convertPreview('1', '0', '1')).toBeNull();
  });
});

describe('inventory.service periodDays', () => {
  it('counts both ends inclusive', () => {
    expect(periodDays('2026-11-01', '2026-11-30')).toBe(30);
  });

  it('returns 1 for a single-day period', () => {
    expect(periodDays('2026-11-05', '2026-11-05')).toBe(1);
  });

  it('returns 0 when the range is reversed or a date is invalid', () => {
    expect(periodDays('2026-11-05', '2026-11-01')).toBe(0);
    expect(periodDays('2026-02-30', '2026-03-05')).toBe(0);
  });
});

describe('inventory.service itemName', () => {
  it('prefers the requested language', () => {
    expect(itemName({ en: 'Water', ar: 'ماء' }, 'ar')).toBe('ماء');
  });

  it('falls back to English then to any non-blank name', () => {
    expect(itemName({ en: 'Water', ar: ' ' }, 'ar')).toBe('Water');
    expect(itemName({ fr: 'Eau' }, 'ar')).toBe('Eau');
  });

  it('returns an empty string when no name exists', () => {
    expect(itemName({}, 'en')).toBe('');
  });
});

describe('inventory.service movementGroup', () => {
  it('maps every movement type to its group', () => {
    expect(movementGroup('OPENING_BALANCE')).toBe('OPENING');
    expect(movementGroup('PURCHASE_RECEIPT')).toBe('RECEIPT');
    expect(movementGroup('SALES_DELIVERY')).toBe('DELIVERY');
    expect(movementGroup('PURCHASE_RECEIPT_REVERSAL')).toBe('REVERSAL');
    expect(movementGroup('SALES_DELIVERY_REVERSAL')).toBe('REVERSAL');
  });
});

describe('inventory.service errorKey', () => {
  it('maps a TypeError to the network key', () => {
    expect(errorKey(new TypeError('fetch'))).toBe('tradeInventory.errors.network');
  });

  it('maps status 0 to the network key', () => {
    expect(errorKey(new ApiError(0, 'X'))).toBe('tradeInventory.errors.network');
  });

  it('maps unknown errors to generic', () => {
    expect(errorKey(new Error('x'))).toBe('tradeInventory.errors.generic');
  });

  it('uses the reason-specific key when the reason is known', () => {
    expect(
      errorKey(new ApiError(409, 'TRADE.INVENTORY.PERIOD_CONFLICT', { reason: ['period_closed'] })),
    ).toBe('tradeInventory.errors.TRADE_INVENTORY_PERIOD_CONFLICT.PERIOD_CLOSED');
  });

  it('falls back to the default key for an unknown reason on an object code', () => {
    expect(
      errorKey(new ApiError(409, 'TRADE.INVENTORY.PERIOD_CONFLICT', { reason: ['nope'] })),
    ).toBe('tradeInventory.errors.TRADE_INVENTORY_PERIOD_CONFLICT.default');
  });

  it('maps a plain string code to its own key', () => {
    expect(errorKey(new ApiError(409, 'TRADE.INVENTORY.REVERSAL_NOT_ALLOWED'))).toBe(
      'tradeInventory.errors.TRADE_INVENTORY_REVERSAL_NOT_ALLOWED',
    );
  });

  it('maps the governance not-found and tracking codes to string keys', () => {
    expect(errorKey(new ApiError(404, 'TRADE.INVENTORY.SCOPE_NOT_FOUND'))).toBe(
      'tradeInventory.errors.TRADE_INVENTORY_SCOPE_NOT_FOUND',
    );
    expect(errorKey(new ApiError(409, 'TRADE.INVENTORY.PERIOD_CODE_TAKEN', { field: ['code'] }))).toBe(
      'tradeInventory.errors.TRADE_INVENTORY_PERIOD_CODE_TAKEN',
    );
    expect(errorKey(new ApiError(422, 'TRADE.INVENTORY.ITEM_NOT_STOCK_TRACKED'))).toBe(
      'tradeInventory.errors.TRADE_INVENTORY_ITEM_NOT_STOCK_TRACKED',
    );
    expect(errorKey(new ApiError(422, 'TRADE.INVENTORY.TRACKING_UNSUPPORTED'))).toBe(
      'tradeInventory.errors.TRADE_INVENTORY_TRACKING_UNSUPPORTED',
    );
  });

  it('maps the reason-code errors to string keys', () => {
    expect(errorKey(new ApiError(422, 'TRADE.REASON.KIND_INVALID'))).toBe(
      'tradeInventory.errors.TRADE_REASON_KIND_INVALID',
    );
  });

  it('maps an unknown 403 to permission and other unknowns to generic', () => {
    expect(errorKey(new ApiError(403, 'SOMETHING'))).toBe('tradeInventory.errors.permission');
    expect(errorKey(new ApiError(500, 'SOMETHING'))).toBe('tradeInventory.errors.generic');
  });
});

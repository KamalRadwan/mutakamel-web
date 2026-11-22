import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../core/api/api-errors';
import en from '../../../../../public/i18n/trade-settings/en.json';
import ar from '../../../../../public/i18n/trade-settings/ar.json';
import { settingsErrorText } from './settings-errors';

const SHARED: Record<string, string> = {
  'apiErrors.idempotencyKey': 'Shared key message',
  'apiErrors.validation': 'Shared validation message',
  'apiErrors.generic': 'Shared generic message',
};

function translatorFor(errors: Record<string, unknown>) {
  return {
    translate(key: string): string {
      if (key.startsWith('tset.errors.')) {
        const rest = key.slice('tset.errors.'.length);
        const value = errors[rest];
        return typeof value === 'string' ? value : key;
      }
      return SHARED[key] ?? key;
    },
  };
}

describe('settingsErrorText', () => {
  const t = translatorFor(en.errors);

  it('reads the tset text for a dotted trade code', () => {
    expect(settingsErrorText(new ApiError(400, 'TRADE.IDEMPOTENCY.KEY_MISSING'), t)).toBe(
      en.errors.TRADE_IDEMPOTENCY_KEY_MISSING,
    );
    expect(settingsErrorText(new ApiError(422, 'TRADE.IDEMPOTENCY.KEY_REQUIRED'), t)).toBe(
      en.errors.TRADE_IDEMPOTENCY_KEY_REQUIRED,
    );
    expect(settingsErrorText(new ApiError(422, 'TRADE.IDEMPOTENCY.MISMATCH'), t)).toBe(
      en.errors.TRADE_IDEMPOTENCY_MISMATCH,
    );
    expect(settingsErrorText(new ApiError(400, 'TRADE.CONCURRENCY.IF_MATCH_REQUIRED'), t)).toBe(
      en.errors.TRADE_CONCURRENCY_IF_MATCH_REQUIRED,
    );
    expect(settingsErrorText(new ApiError(409, 'TRADE.REASON.SYSTEM_IMMUTABLE'), t)).toBe(
      en.errors.TRADE_REASON_SYSTEM_IMMUTABLE,
    );
    expect(settingsErrorText(new ApiError(404, 'TRADE.TERMS.NOT_FOUND'), t)).toBe(en.errors.TRADE_TERMS_NOT_FOUND);
  });

  it('falls back to the shared map in core/api/api-errors.ts for codes tset does not name', () => {
    expect(settingsErrorText(new ApiError(400, 'GW.IDEM.MISSING'), t)).toBe('Shared key message');
    expect(settingsErrorText(new ApiError(422, 'TRADE.SOMETHING.NEW'), t)).toBe('Shared validation message');
    expect(settingsErrorText(new Error('boom'), t)).toBe('Shared generic message');
  });

  it('ships every new error text in English and Arabic', () => {
    const keys = [
      'TRADE_IDEMPOTENCY_KEY_MISSING',
      'TRADE_IDEMPOTENCY_KEY_REQUIRED',
      'TRADE_IDEMPOTENCY_MISMATCH',
      'TRADE_CONCURRENCY_IF_MATCH_REQUIRED',
      'TRADE_REASON_SYSTEM_IMMUTABLE',
      'TRADE_TERMS_NOT_FOUND',
    ] as const;
    for (const key of keys) {
      expect(en.errors[key]).toBeTruthy();
      expect(ar.errors[key]).toBeTruthy();
    }
    expect(en.errors.TRADE.IDEMPOTENCY.KEY_MISSING).toBe(en.errors.TRADE_IDEMPOTENCY_KEY_MISSING);
    expect(ar.errors.TRADE.IDEMPOTENCY.KEY_MISSING).toBe(ar.errors.TRADE_IDEMPOTENCY_KEY_MISSING);
  });
});

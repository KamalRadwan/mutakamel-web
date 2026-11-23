import type { TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../../shared/trade-api';
import { termErrorKey } from '../../shared/terms/terms.api';

export const TERM_PAGE_ERROR_KEYS: ReadonlySet<string> = new Set([
  'TRADE_VALIDATION_FAILED',
  'TRADE_CONCURRENCY_STALE_VERSION',
  'TRADE_CONCURRENCY_IF_MATCH_REQUIRED',
  'TRADE_IDEMPOTENCY_IN_FLIGHT',
  'TRADE_AUTH_TARGET_DENIED',
  'TRADE_IDEMPOTENCY_KEY_MISSING',
  'TRADE_IDEMPOTENCY_KEY_REQUIRED',
  'TRADE_IDEMPOTENCY_MISMATCH',
  'TRADE_CONTEXT_MISSING_COMPANY',
  'TRADE_SCOPE_REQUIRED',
  'TRADE_TERMS_NOT_FOUND',
  'TRADE_TERMS_CODE_TAKEN',
  'TRADE_TERMS_TEXT_REQUIRED',
  'TRADE_TERMS_TYPE_FIELD_INVALID',
  'TRADE_TERMS_DEFAULT_INACTIVE',
  'TRADE_TERMS_DEFAULT_IN_USE',
  'TRADE_TERMS_PAYMENT_REQUIRED',
]);

export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

export function isMissingCompanyError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'TRADE.CONTEXT.MISSING_COMPANY' || error.code === 'TRADE.SCOPE.REQUIRED')
  );
}

export function termErrorText(error: unknown, transloco: TranslocoService): string {
  if (error instanceof ApiError) {
    const normalized = error.code.replaceAll('.', '_');
    if (TERM_PAGE_ERROR_KEYS.has(normalized)) {
      const scopedKey = `tset.errors.${normalized}`;
      const scoped = transloco.translate(scopedKey);
      if (scoped && scoped !== scopedKey) return scoped;
    }

    const apiMappedKey = termErrorKey(error);
    if (apiMappedKey !== 'tset.errors.generic') {
      const mapped = transloco.translate(apiMappedKey);
      if (mapped && mapped !== apiMappedKey) return mapped;
    }

    if (error.status === 0) return transloco.translate('settings.errors.network');
    if (error.status === 404) return transloco.translate('settings.errors.notFound');
    if (error.status === 429) return transloco.translate('settings.errors.rateLimited');
  }
  return transloco.translate('tset.errors.generic');
}

import type { WritableSignal } from '@angular/core';
import { ApiError, correlationIdOf, fieldErrorsOf } from '../../../../core/api/api-errors';
import type { SettingsTranslator } from '../../../../core/api/settings-translator';
import { errorKey } from '../../../../shared/widgets/dashboard/panel-state';

export function accessReadOnly(error: unknown): boolean {
  return error instanceof ApiError && (error.code.endsWith('_DISABLED')
    || ['CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY'].includes(error.code));
}

export function accessMismatch(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'GW.IDEM.MISMATCH'
    || error.code.includes('IDEMPOTENCY_MISMATCH') || error.code === 'CRM_IDEMPOTENCY_KEY_REUSED');
}

export function accessMessage(t: SettingsTranslator, error: unknown): string {
  const translate = typeof t === 'function' ? t : t.translate.bind(t);
  if (error instanceof ApiError) {
    if (error.status === 401) return translate('access.errors.notSaved');
    if (error.code.endsWith('_DISABLED')) return translate('access.errors.moduleDisabled');
    if (accessMismatch(error)) return translate('access.errors.reloadRequired');
    if (error.status === 429) {
      const seconds = error.details?.['retryAfterSeconds'] ?? error.details?.['retryAfter'] ?? '?';
      return translate('access.errors.rateLimited', { seconds });
    }
    const message = translate(errorKey(error.code));
    const correlation = correlationIdOf(error);
    return correlation ? `${message} (${correlation})` : message;
  }
  return translate(errorKey(null));
}

export function accessCanRetry(error: unknown): boolean {
  return error instanceof ApiError && ([0, 401].includes(error.status)
    || error.status >= 500 || error.code === 'GW.IDEM.IN_FLIGHT');
}

export function accessValidation(
  t: SettingsTranslator, error: unknown, fields: Record<string, WritableSignal<string | null>>,
): boolean {
  const errors = fieldErrorsOf(error);
  let matched = false;
  for (const [path, field] of Object.entries(fields)) {
    if (!Object.hasOwn(errors, path)) continue;
    field.set(accessMessage(t, error));
    matched = true;
  }
  return matched;
}

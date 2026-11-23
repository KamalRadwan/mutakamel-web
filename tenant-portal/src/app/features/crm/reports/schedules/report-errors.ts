import { ApiError, correlationIdOf, errorCodeOf } from '../../../../core/api/api-errors';
import type { SettingsTranslator } from '../../../../core/api/settings-translator';
import { errorKey } from '../../../../shared/widgets/dashboard/panel-state';

export function reportWriteError(error: unknown, t: SettingsTranslator, scope: string) {
  const code = errorCodeOf(error);
  const readOnly = code === 'CRM_SUBSCRIPTION_READ_ONLY' || code === 'SEAT_OVER_CAPACITY_READ_ONLY'
    || code?.endsWith('_DISABLED') === true;
  const reloadRequired = code === 'GW.IDEM.MISMATCH' || code?.endsWith('_IDEMPOTENCY_MISMATCH') === true;
  const translate = typeof t === 'function' ? t : t.translate.bind(t);
  let message: string;
  if (reloadRequired) message = translate(`${scope}.writeErrors.reloadRequired`);
  else if (code?.endsWith('_DISABLED')) message = translate(`${scope}.writeErrors.moduleOff`);
  else if (error instanceof ApiError && error.status === 401) message = translate(`${scope}.writeErrors.notSaved`);
  else if (error instanceof ApiError && error.status === 429) {
    const delay = error.details?.['retryAfterSeconds'];
    message = translate(`${scope}.writeErrors.rateLimited`, { seconds: Array.isArray(delay) ? delay[0] : 1 });
  } else message = translate(errorKey(code));
  return { message, readOnly, reloadRequired,
    conflict: error instanceof ApiError && error.status === 409 && /_(STALE|CONFLICT)$/.test(code ?? '') };
}

export function reportCorrelation(error: unknown, t: SettingsTranslator, scope: string): string {
  const id = correlationIdOf(error);
  const translate = typeof t === 'function' ? t : t.translate.bind(t);
  return id ? translate(`${scope}.correlation`, { id }) : '';
}

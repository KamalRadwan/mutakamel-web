import { ApiError, correlationIdOf } from '../../../../core/api/api-errors';
import type { SettingsTranslator } from '../../../../core/api/settings-translator';
import type { FullStateKind } from '../../../../shared/ui/full-state/full-state';
import { errorText } from '../../../../shared/widgets/dashboard/panel-state';

const NOT_READY = new Set([
  'CRM_TARGET_SOURCE_NOT_READY', 'CRM_ANALYTICS_SOURCE_UNAVAILABLE',
  'CRM_DASHBOARD_BLUEPRINTS_NOT_READY', 'CRM_TEAM_SCOPE_NOT_READY', 'CRM_INQUIRY_SOURCE_NOT_READY',
]);

export function reportLoadKind(error: unknown): FullStateKind {
  if (error instanceof ApiError) {
    if (NOT_READY.has(error.code)) return 'provisioning';
    if (error.status === 403) return 'forbidden';
    if (error.status === 404) return 'not-found';
  }
  return 'load-failure';
}

export function reportWriteReadOnly(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && (
    /_DISABLED$/.test(error.code) || error.code === 'CRM_SUBSCRIPTION_READ_ONLY'
    || error.code === 'SEAT_OVER_CAPACITY_READ_ONLY'
  );
}

export function reportWriteRetryable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status === 401 || error.status >= 500
    || error.code === 'GW.IDEM.IN_FLIGHT');
}

export function reportIdempotencyMismatch(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'GW.IDEM.MISMATCH' || error.code.endsWith('_IDEMPOTENCY_MISMATCH'));
}

export function reportErrorMessage(transloco: SettingsTranslator, error: unknown, scope: string): string {
  const translate = typeof transloco === 'function' ? transloco : transloco.translate.bind(transloco);
  let message: string;
  if (error instanceof ApiError && error.status === 401) {
    message = translate(`${scope}.notSaved`);
  } else if (error instanceof ApiError && error.status === 429) {
    const retryAfter = error.details?.['retryAfterSeconds'];
    message = translate(`${scope}.rateLimited`, { seconds: Array.isArray(retryAfter) ? retryAfter[0] : '1' });
  } else if (reportWriteReadOnly(error)) {
    message = translate(`${scope}.${error instanceof ApiError && error.code.endsWith('_DISABLED') ? 'moduleDisabled' : 'readOnly'}`);
  } else {
    const text = errorText(error);
    message = translate(text.key, text.params);
  }
  const correlationId = correlationIdOf(error);
  return correlationId ? `${message} (${correlationId})` : message;
}

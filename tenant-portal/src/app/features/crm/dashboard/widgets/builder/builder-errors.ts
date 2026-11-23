import { ApiError, correlationIdOf, errorCodeOf } from '../../../../../core/api/api-errors';
import type { SettingsTranslator } from '../../../../../core/api/settings-translator';
import type { FullStateKind } from '../../../../../shared/ui/full-state/full-state';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';

const NOT_READY_CODES = new Set([
  'CRM_TARGET_SOURCE_NOT_READY', 'CRM_ANALYTICS_SOURCE_UNAVAILABLE',
  'CRM_DASHBOARD_BLUEPRINTS_NOT_READY', 'CRM_TEAM_SCOPE_NOT_READY', 'CRM_INQUIRY_SOURCE_NOT_READY',
]);

export interface WidgetReadFailure {
  kind: FullStateKind;
  message: string;
  correlationId: string | null;
  requestAccess: boolean;
}

export function widgetNeedsReload(error: unknown): boolean {
  const code = errorCodeOf(error);
  return code === 'GW.IDEM.MISMATCH' || !!code?.endsWith('_IDEMPOTENCY_MISMATCH');
}

export function widgetWriteReadOnly(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 &&
    (error.code.endsWith('_DISABLED') || error.code === 'CRM_SUBSCRIPTION_READ_ONLY'
      || error.code === 'SEAT_OVER_CAPACITY_READ_ONLY');
}

export function widgetConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && /_(STALE|CONFLICT)$/.test(error.code);
}

export function widgetErrorMessage(error: unknown, translator: SettingsTranslator, scope: string, writing = false): string {
  const translate = typeof translator === 'function' ? translator : translator.translate.bind(translator);
  if (writing && error instanceof ApiError && error.status === 401) return translate(`${scope}.requests.notSaved`);
  if (widgetNeedsReload(error)) return translate(`${scope}.requests.reloadRequired`);
  if (errorCodeOf(error) === 'CRM_WIDGET_OWNER_LIMIT') return translate(`${scope}.requests.ownerLimit`);
  if (error instanceof ApiError && error.status === 429) {
    const seconds = error.details?.['retryAfterSeconds'];
    return Array.isArray(seconds) && seconds[0]
      ? translate(`${scope}.requests.rateLimited`, { seconds: seconds[0] })
      : translate(errorKey(error.code));
  }
  if (widgetWriteReadOnly(error) && errorCodeOf(error)?.endsWith('_DISABLED')) {
    return translate(`${scope}.requests.moduleOff`);
  }
  return translate(errorKey(errorCodeOf(error)));
}

export function widgetReadFailure(error: unknown, translator: SettingsTranslator, scope: string): WidgetReadFailure {
  const code = errorCodeOf(error);
  const status = error instanceof ApiError ? error.status : null;
  return {
    kind: status === 503 && code && NOT_READY_CODES.has(code) ? 'provisioning'
      : status === 403 ? 'forbidden' : status === 404 ? 'not-found' : 'load-failure',
    message: widgetErrorMessage(error, translator, scope),
    correlationId: correlationIdOf(error),
    requestAccess: code === 'CRM_DASHBOARD_DEFINITION_ACCESS_DENIED',
  };
}

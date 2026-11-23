import { ApiError, correlationIdOf, errorCodeOf } from '../../../../core/api/api-errors';
import type { TranslocoService } from '@jsverse/transloco';
import type { FullStateKind } from '../../../../shared/ui/full-state/full-state';
import { errorText } from '../../../../shared/widgets/dashboard/panel-state';

const NOT_READY = new Set([
  'CRM_TARGET_SOURCE_NOT_READY', 'CRM_ANALYTICS_SOURCE_UNAVAILABLE', 'CRM_DASHBOARD_BLUEPRINTS_NOT_READY',
  'CRM_TEAM_SCOPE_NOT_READY', 'CRM_INQUIRY_SOURCE_NOT_READY',
]);
export function alertReadKind(error: unknown): FullStateKind {
  if (NOT_READY.has(errorCodeOf(error) ?? '')) return 'provisioning';
  if (error instanceof ApiError && error.status === 403) return 'forbidden';
  if (error instanceof ApiError && error.status === 404) return 'not-found';
  return 'load-failure';
}
export function alertWriteLocked(error: unknown): boolean {
  const code = errorCodeOf(error) ?? '';
  return code.endsWith('_DISABLED') || ['CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY',
    'GW.IDEM.MISMATCH', 'CRM_IDEMPOTENCY_KEY_REUSED'].includes(code) || code.endsWith('_IDEMPOTENCY_MISMATCH');
}
export function alertErrorText(t: TranslocoService, error: unknown): string {
  const code = errorCodeOf(error) ?? '';
  let text: string;
  if (error instanceof ApiError && error.status === 401) text = t.translate('alerts.errors.notSaved');
  else if (code.endsWith('_DISABLED')) text = t.translate('alerts.errors.moduleDisabled');
  else if (alertWriteLocked(error)) text = t.translate(code.includes('IDEMPOTENCY') || code === 'GW.IDEM.MISMATCH' ? 'alerts.errors.reloadRequired' : 'alerts.errors.readOnly');
  else if (error instanceof ApiError && error.status === 429) {
    const seconds = error.details?.['retryAfterSeconds'] ?? error.details?.['retryAfter'];
    const value = Array.isArray(seconds) ? seconds[0] : seconds;
    text = t.translate('alerts.errors.rateLimited', { seconds: Number(value) > 0 ? Number(value) : 1 });
  } else if (error instanceof ApiError && error.status === 403 && (code === 'CRM_SCOPED_PERMISSION_DENIED' || code.startsWith('BRANCH_'))) text = t.translate('alerts.forbidden.text');
  else {
    const message = errorText(error);
    text = t.translate(message.key, message.params);
  }
  const correlationId = correlationIdOf(error);
  return correlationId ? `${text} (${correlationId})` : text;
}

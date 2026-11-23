import type { TranslocoService } from '@jsverse/transloco';
import { ApiError, correlationIdOf, errorCodeOf } from '../../../../../core/api/api-errors';
import type { FullStateKind } from '../../../../../shared/ui/full-state/full-state';
import { errorText } from '../../../../../shared/widgets/dashboard/panel-state';
import { crmSettingsError } from '../../../settings/shared/settings-api';

const PROVISIONING_CODES = new Set([
  'CRM_TARGET_SOURCE_NOT_READY',
  'CRM_ANALYTICS_SOURCE_UNAVAILABLE',
  'CRM_DASHBOARD_BLUEPRINTS_NOT_READY',
  'CRM_TEAM_SCOPE_NOT_READY',
  'CRM_INQUIRY_SOURCE_NOT_READY',
]);

export function dashboardReadError(error: unknown, transloco: TranslocoService, scope: 'dashPage' | 'dashFilters') {
  const code = errorCodeOf(error);
  // The generic CRM mapper probes optional page keys. Check them without raising missing-key warnings.
  const translate = (key: string, params?: Record<string, unknown>): string => {
    let value: unknown = transloco.getTranslation();
    for (const part of key.split('.')) {
      value = value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
    }
    return typeof value === 'string' ? transloco.translate(key, params) : key;
  };
  const shared = crmSettingsError(translate, error, scope);
  const text = errorText(error);
  let message = text.key === 'analytics.error.GENERIC'
    ? shared.message : transloco.translate(text.key, text.params);
  if (error instanceof ApiError && error.status === 429) {
    const seconds = error.details?.['retryAfterSeconds'];
    const value = Array.isArray(seconds) ? Number(seconds[0]) : NaN;
    message = Number.isFinite(value) && value > 0
      ? transloco.translate(`${scope}.retryAfter`, { seconds: Math.ceil(value) })
      : transloco.translate(`${scope}.tooManyRequests`);
  }
  const correlationId = correlationIdOf(error);
  if (correlationId) message += ` · ${transloco.translate(`${scope}.requestId`, { id: correlationId })}`;
  const kind: FullStateKind = code && PROVISIONING_CODES.has(code) ? 'provisioning' : shared.kind;
  return { code, kind, message };
}

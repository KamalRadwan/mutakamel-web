import { ApiError, isRetryableWriteError } from '../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import type { SettingsTranslator } from '../../../../core/api/settings-translator';
import { crmSettingsError } from '../../settings/shared/settings-api';
import { errorKey } from '../../../../shared/widgets/dashboard/panel-state';

export interface WriteIntent {
  bodyJson: string;
  key: string;
}
export function writeIntent(body: unknown, previous?: WriteIntent | null): WriteIntent {
  const bodyJson = JSON.stringify(body);
  return previous?.bodyJson === bodyJson ? previous : { bodyJson, key: newIdempotencyKey() };
}
export function retainWriteIntent(error: unknown): boolean {
  return isRetryableWriteError(error) || (error instanceof ApiError && error.status === 401);
}
export function dashboardWriteError(
  t: SettingsTranslator,
  error: unknown,
  scope: 'dashEdit' | 'share',
  write = true,
) {
  const translate = typeof t === 'function' ? t : t.translate.bind(t);
  const code = error instanceof ApiError ? error.code : null;
  const result = crmSettingsError(
    (key, params) =>
      key === `${scope}.errors.${code}`
        ? translate(errorKey(code), params)
        : translate(key, params),
    error,
    scope,
  );
  const reloadRequired =
    code === 'GW.IDEM.MISMATCH' || code?.endsWith('_IDEMPOTENCY_MISMATCH') === true;
  const disabled =
    error instanceof ApiError && error.status === 403 && code?.endsWith('_DISABLED') === true;
  const readOnly = result.readOnly || disabled || code === 'CRM_SUBSCRIPTION_BLOCKED';
  const retryAfter = error instanceof ApiError ? error.details?.['retryAfterSeconds'] : null;
  const key = reloadRequired
    ? `${scope}.errors.reloadRequired`
    : disabled
      ? `${scope}.errors.moduleDisabled`
      : readOnly
        ? `${scope}.errors.readOnly`
        : write && error instanceof ApiError && error.status === 401
          ? `${scope}.errors.notSaved`
          : error instanceof ApiError && error.status === 429
            ? `${scope}.errors.${Array.isArray(retryAfter) && retryAfter[0] ? 'rateLimitedIn' : 'rateLimited'}`
            : code?.startsWith('BRANCH_')
              ? errorKey('CRM_SCOPED_PERMISSION_DENIED')
              : errorKey(code);
  const message = translate(key, { seconds: Array.isArray(retryAfter) ? retryAfter[0] : '' });
  result.message = message && message !== key ? message : translate(errorKey(code));
  if (!write && result.correlationId)
    result.message = translate(`${scope}.errors.reference`, {
      message: result.message,
      id: result.correlationId,
    });
  const provisioning =
    error instanceof ApiError &&
    error.status === 503 &&
    [
      'CRM_TARGET_SOURCE_NOT_READY',
      'CRM_ANALYTICS_SOURCE_UNAVAILABLE',
      'CRM_DASHBOARD_BLUEPRINTS_NOT_READY',
      'CRM_TEAM_SCOPE_NOT_READY',
      'CRM_INQUIRY_SOURCE_NOT_READY',
    ].includes(error.code);
  return {
    ...result,
    kind: provisioning ? ('provisioning' as const) : result.kind,
    reloadRequired,
    readOnly,
  };
}

export function isAnalyticsConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && /_(STALE|CONFLICT)$/.test(error.code);
}

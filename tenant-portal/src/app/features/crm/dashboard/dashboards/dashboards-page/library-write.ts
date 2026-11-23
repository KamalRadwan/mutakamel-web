import { ApiError, isRetryableWriteError } from '../../../../../core/api/api-errors';
import { newIdempotencyKey } from '../../../../../core/api/idempotency';
import type { SettingsTranslator } from '../../../../../core/api/settings-translator';
import { crmSettingsError } from '../../../settings/shared/settings-api';
import { errorKey } from '../../../../../shared/widgets/dashboard/panel-state';

export interface LibraryWriteIntent {
  bodyJson: string;
  key: string;
}

export function libraryWriteIntent(body: unknown, previous?: LibraryWriteIntent | null): LibraryWriteIntent {
  const bodyJson = JSON.stringify(body);
  return previous?.bodyJson === bodyJson ? previous : { bodyJson, key: newIdempotencyKey() };
}

export function keepLibraryWriteIntent(error: unknown): boolean {
  return isRetryableWriteError(error) || error instanceof ApiError && error.status === 401;
}

export function libraryFailure(t: SettingsTranslator, error: unknown, write = false) {
  const code = error instanceof ApiError ? error.code : null;
  const translate = typeof t === 'function' ? t : t.translate.bind(t);
  const owned = code === 'CRM_DASHBOARD_NAME_CONFLICT' || code === 'CRM_DASHBOARD_OWNER_LIMIT';
  const disabled = error instanceof ApiError && error.status === 403 && code?.endsWith('_DISABLED') === true;
  const mappedKey = disabled ? 'dashLibrary.errors.moduleDisabled'
    : code === 'CRM_SUBSCRIPTION_READ_ONLY' ? 'dashLibrary.errors.subscriptionReadOnly'
    : code?.startsWith('BRANCH_') ? errorKey('CRM_SCOPED_PERMISSION_DENIED')
    : owned ? `dashLibrary.errors.${code}` : errorKey(code);
  const result = crmSettingsError(
    (key, params) => key === `dashLibrary.errors.${code}` ? translate(mappedKey, params) : translate(key, params),
    error,
    'dashLibrary',
  );
  const reloadRequired = code === 'GW.IDEM.MISMATCH' || code?.endsWith('_IDEMPOTENCY_MISMATCH') === true;
  if (reloadRequired) result.message = translate('dashLibrary.errors.reloadRequired');
  else if (write && error instanceof ApiError && error.status === 401) {
    result.message = translate('dashLibrary.errors.notSaved');
  } else if (error instanceof ApiError && error.status === 429) {
    const seconds = error.details?.['retryAfterSeconds'];
    result.message = Array.isArray(seconds) && seconds[0]
      ? translate('dashLibrary.errors.rateLimitedIn', { seconds: seconds[0] })
      : translate('dashLibrary.errors.rateLimited');
  }
  const provisioning = error instanceof ApiError && error.status === 503 && [
    'CRM_TARGET_SOURCE_NOT_READY', 'CRM_ANALYTICS_SOURCE_UNAVAILABLE',
    'CRM_DASHBOARD_BLUEPRINTS_NOT_READY', 'CRM_TEAM_SCOPE_NOT_READY', 'CRM_INQUIRY_SOURCE_NOT_READY',
  ].includes(error.code);
  return {
    ...result,
    code,
    kind: provisioning ? 'provisioning' as const : result.kind,
    readOnly: result.readOnly || error instanceof ApiError && error.status === 403 && (
      error.code.endsWith('_DISABLED') || error.code === 'CRM_SUBSCRIPTION_BLOCKED'
    ),
    reloadRequired,
  };
}

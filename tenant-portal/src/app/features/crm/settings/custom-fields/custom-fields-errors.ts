import { ApiError } from '../../../../core/api/api-errors';
import type { TranslocoService } from '@jsverse/transloco';
import { crmSettingsError } from '../shared/settings-api';

export function customFieldsError(transloco: TranslocoService, error: unknown) {
  const dictionary = transloco.getTranslation(transloco.getActiveLang());
  const translate = (key: string, params?: Record<string, unknown>): string =>
    Object.hasOwn(dictionary, key) ? transloco.translate(key, params) : key;
  const result = crmSettingsError(translate, error, 'customFields');
  if (error instanceof ApiError && error.status === 429) {
    const raw = error.details?.['retryAfterSeconds'];
    const seconds = Array.isArray(raw) ? raw[0] : raw;
    result.message = seconds === undefined
      ? translate('settings.errors.rateLimited')
      : translate('settings.errors.rateLimitedIn', { seconds });
  }
  return result;
}

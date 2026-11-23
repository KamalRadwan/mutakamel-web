import type { TranslocoService } from '@jsverse/transloco';
import { ApiError, writeErrorMessage } from '../../../../core/api/api-errors';
import { crmSettingsError } from '../shared/settings-api';

export function opportunityStageError(transloco: TranslocoService, error: unknown) {
  const translate = (key: string, params?: Record<string, unknown>): string =>
    transloco.getTranslation(transloco.getActiveLang())[key] === undefined ? key : transloco.translate(key, params);
  const state = crmSettingsError(translate, error, 'opportunityStages');
  let message = error instanceof ApiError && error.status === 401
    ? writeErrorMessage(error, 'opportunityStages', translate)
    : state.message;
  if (error instanceof ApiError && error.status === 429) {
    const seconds = error.details?.['retryAfterSeconds'];
    if (Array.isArray(seconds) && seconds[0]) {
      message = translate('settings.errors.rateLimitedIn', { seconds: seconds[0] });
    }
  }
  return { ...state, message };
}

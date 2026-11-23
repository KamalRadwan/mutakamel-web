import { ApiError, writeErrorMessage } from '../../../../core/api/api-errors';
import type { SettingsTranslator } from '../../../../core/api/settings-translator';
import type { TranslocoService } from '@jsverse/transloco';

// Error mappers probe several fallbacks; absent candidates should not emit missing-key warnings.
export function pipelineErrorTranslator(transloco: TranslocoService): SettingsTranslator {
  return (key, params) => Object.hasOwn(transloco.getTranslation(transloco.getActiveLang()), key)
    ? transloco.translate(key, params)
    : key;
}

export function pipelineWriteMessage(error: unknown, transloco: SettingsTranslator): string {
  if (error instanceof ApiError && error.status === 429) {
    const retryAfter = error.details?.['retryAfterSeconds'];
    const seconds = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
    if ((typeof seconds === 'number' || typeof seconds === 'string') && Number.isFinite(Number(seconds))) {
      const translate = typeof transloco === 'function' ? transloco : transloco.translate.bind(transloco);
      return translate('settings.errors.rateLimitedIn', { seconds });
    }
  }
  return writeErrorMessage(error, 'pipelines', transloco);
}

import type { TranslocoService } from '@jsverse/transloco';
import { crmSettingsError } from '../shared/settings-api';

export function reasonsError(transloco: TranslocoService, error: unknown): ReturnType<typeof crmSettingsError> {
  const dictionary = transloco.getTranslation(transloco.getActiveLang());
  return crmSettingsError((key, params) =>
    Object.hasOwn(dictionary, key) ? transloco.translate(key, params) : key,
  error, 'reasons');
}

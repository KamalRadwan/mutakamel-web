import type { TranslocoService } from '@jsverse/transloco';
import { crmSettingsError } from '../shared/settings-api';

export function readinessError(transloco: TranslocoService, error: unknown) {
  // Shared errors probe optional page keys before falling back to settings/global text.
  return crmSettingsError((key, params) => {
    const dictionary = transloco.getTranslation(transloco.getActiveLang());
    return Object.hasOwn(dictionary, key) ? transloco.translate<string>(key, params) : key;
  }, error, 'readiness');
}

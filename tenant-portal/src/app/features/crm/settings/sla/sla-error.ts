import { TranslocoService } from '@jsverse/transloco';
import { crmSettingsError } from '../shared/settings-api';

export function slaError(transloco: TranslocoService, error: unknown) {
  return crmSettingsError(
    (key, params) =>
      Object.hasOwn(transloco.getTranslation(transloco.getActiveLang()), key)
        ? transloco.translate(key, params)
        : key,
    error,
    'sla',
  );
}

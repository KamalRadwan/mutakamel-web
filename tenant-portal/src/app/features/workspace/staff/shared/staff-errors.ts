import { ApiError, errorCodeOf, errorMessage } from '../../../../core/api/api-errors';
import type { SettingsTranslator } from '../../../../core/api/settings-translator';

export function staffErrorMessage(
  error: unknown,
  scope: string,
  t: SettingsTranslator,
  operation: 'read' | 'write' = 'read',
): string {
  const translate = typeof t === 'function' ? t : (key: string, params?: Record<string, unknown>) => t.translate(key, params);
  const details = error instanceof ApiError ? error.details : undefined;
  if (operation === 'write' && error instanceof ApiError && error.status === 401) {
    return translate('staff.errors.notSaved', details);
  }
  const code = typeof error === 'string' ? error : errorCodeOf(error);
  if (code === 'GW.IDEM.MISSING' || code === 'GW.IDEM.BAD_VALUE') {
    return translate('staff.errors.generic', details);
  }
  if (code) {
    for (const key of [`${scope}.errors.${code}`, `staff.errors.${code}`]) {
      const message = translate(key, details);
      if (message && message !== key) return message;
    }
  }
  return errorMessage(error, 'staff', t);
}

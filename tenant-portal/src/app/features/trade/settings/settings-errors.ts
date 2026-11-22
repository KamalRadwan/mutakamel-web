import { errorCodeOf, errorMessage } from '../../../core/api/api-errors';
import type { SettingsTranslator } from '../../../core/api/settings-translator';

/**
 * Toast text for a trade settings error: the tset scope first (`tset.errors.TRADE_X_Y` for the wire
 * code `TRADE.X.Y`), then the shared map in core/api/api-errors.ts (shared keys, then the HTTP status).
 */
export function settingsErrorText(error: unknown, t: SettingsTranslator): string {
  const code = errorCodeOf(error);
  if (code) {
    const key = `tset.errors.${code.replaceAll('.', '_')}`;
    const scoped = typeof t === 'function' ? t(key) : t.translate(key);
    if (scoped && scoped !== key) return scoped;
  }
  return errorMessage(error, 'tset.errors', t);
}

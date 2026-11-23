import { ApiError as CoreApiError, correlationIdOf, errorCodeOf, errorMessage } from '../../../../core/api/api-errors';
import type { SettingsTranslator } from '../../../../core/api/settings-translator';
import type { FullStateKind } from '../../../../shared/ui/full-state/full-state';

// Generic helpers now live in core; re-exported here so CRM imports stay unchanged.
export { ApiError, errorCodeOf, errorMessage } from '../../../../core/api/api-errors';
export { newIdempotencyKey } from '../../../../core/api/idempotency';
export type { SettingsTranslator } from '../../../../core/api/settings-translator';
export { fakeDelay, fakeId } from '../../../../core/fake/fake-utils';

/** Message and state metadata; the caller chooses a load state or a write toast. */
export function crmSettingsError(transloco: SettingsTranslator, error: unknown, pageScope: string): {
  message: string;
  readOnly: boolean;
  kind: FullStateKind;
  correlationId: string | null;
} {
  const code = errorCodeOf(error);
  const details = error instanceof CoreApiError ? error.details : undefined;
  const translate = typeof transloco === 'function' ? transloco : transloco.translate.bind(transloco);
  let message: string | undefined;
  if (code) {
    for (const key of [`${pageScope}.errors.${code}`, `settings.errors.${code}`]) {
      const translated = translate(key, details);
      if (translated && translated !== key) {
        message = translated;
        break;
      }
    }
  }
  const status = error instanceof CoreApiError ? error.status : null;
  return {
    message: message ?? errorMessage(error, pageScope, transloco),
    readOnly: code === 'CRM_SUBSCRIPTION_READ_ONLY' || code === 'SEAT_OVER_CAPACITY_READ_ONLY',
    kind: status === 403 ? 'forbidden' : status === 404 ? 'not-found' : 'load-failure',
    correlationId: correlationIdOf(error),
  };
}

/**
 * Legacy fake validation shape. Real CRM responses use message text, not constraint names.
 * Kept while settings fakes still import it.
 */
export function crmValidationFailed(details: Record<string, string[]>): CoreApiError {
  return new CoreApiError(400, 'CRM_VALIDATION_FAILED', details);
}

/**
 * `@IsString @IsNotEmpty @MaxLength(max)` on a (possibly already trimmed) string: adds the failed constraint to
 * `details[field]`. MaxLength counts code points, like class-validator.
 */
export function checkRequiredText(
  details: Record<string, string[]>,
  field: string,
  value: unknown,
  max: number,
): void {
  if (typeof value !== 'string') details[field] = ['is_string'];
  else if (value.length === 0) details[field] = ['is_not_empty'];
  else if (Array.from(value).length > max) details[field] = ['max_length'];
}

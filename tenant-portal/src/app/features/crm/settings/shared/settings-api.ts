import { ApiError as CoreApiError } from '../../../../core/api/api-errors';

// Generic helpers now live in core; re-exported here so CRM imports stay unchanged.
export { ApiError, errorCodeOf, errorMessage } from '../../../../core/api/api-errors';
export { newIdempotencyKey } from '../../../../core/api/idempotency';
export type { SettingsTranslator } from '../../../../core/api/settings-translator';
export { fakeDelay, fakeId } from '../../../../core/fake/fake-utils';

/**
 * 400 CRM_VALIDATION_FAILED as the CRM ValidationPipe sends it: details keyed by property path, each a list of
 * lowercase snake_case constraint names (the shared filter keeps string arrays only). The pipe runs before any
 * service check, so fakes throw this before 404/409/422.
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

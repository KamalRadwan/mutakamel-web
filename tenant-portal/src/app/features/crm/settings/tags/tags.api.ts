import { TranslocoService } from '@jsverse/transloco';
import { fieldErrorsOf, isValidationError } from '../../../../core/api/api-errors';
import { ApiError, errorCodeOf } from '../shared/settings-api';
import { fakeCreateTag, fakeDeleteTag, fakeListTags, fakeUpdateTag } from './tags.fake';
import { CreateTagInput, MAX_DETACH_LEADS, Tag, UpdateTagInput } from './tags.model';

/** GET /api/tenant/crm/v1/tags */
export function listTags(): Promise<Tag[]> {
  return fakeListTags();
}

/** POST /api/tenant/crm/v1/tags */
export function createTag(input: CreateTagInput): Promise<Tag> {
  return fakeCreateTag(input);
}

/** PATCH /api/tenant/crm/v1/tags/:id */
export function updateTag(id: string, patch: UpdateTagInput): Promise<Tag> {
  return fakeUpdateTag(id, patch);
}

/** DELETE /api/tenant/crm/v1/tags/:id */
export function deleteTag(id: string): Promise<void> {
  return fakeDeleteTag(id);
}

/** 422 CRM_TAG_DETACH_LIMIT_EXCEEDED details { count: ['101'] }: the decimal string, or the limit when absent. */
export function detachLimitCount(error: unknown): number {
  const raw = error instanceof ApiError ? error.details?.['count'] : undefined;
  const count = Array.isArray(raw) ? Number(raw[0]) : NaN;
  return Number.isInteger(count) && count > 0 ? count : MAX_DETACH_LEADS;
}

export function tagErrorMessage(transloco: TranslocoService, error: unknown): string {
  const code = errorCodeOf(error);
  if (code) {
    const key = `tags.errors.${code}`;
    const translated = transloco.translate(key);
    if (translated && translated !== key) {
      return translated;
    }
  }
  if (error instanceof ApiError) {
    if (error.status === 404) return transloco.translate('settings.errors.notFound');
    if (error.status === 403) return transloco.translate('settings.errors.permission');
    if (isValidationError(error)) {
      // 400 CRM_VALIDATION_FAILED: name → name message, colours → colour message.
      const fields = Object.keys(fieldErrorsOf(error));
      if (fields.includes('backgroundColor') || fields.includes('textColor')) {
        return transloco.translate('tags.errors.CRM_TAG_COLOR_INVALID');
      }
      if (fields.includes('name')) return transloco.translate('tags.errors.CRM_TAG_NAME_INVALID');
      return transloco.translate('settings.errors.validation');
    }
  }
  return transloco.translate('settings.errors.generic');
}

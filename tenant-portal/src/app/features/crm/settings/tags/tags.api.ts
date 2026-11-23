import { TranslocoService } from '@jsverse/transloco';
import { fieldErrorsOf, isRetryableWriteError, isValidationError } from '../../../../core/api/api-errors';
import type { CoreWriteMethod } from '../../../../core/api/core-http';
import { ApiError, crmSettingsError, newIdempotencyKey } from '../shared/settings-api';
import { crmHttp, crmQueries, type CrmHttpTransport } from '../../shared/crm-http';
import { CreateTagInput, MAX_DETACH_LEADS, Tag, UpdateTagInput } from './tags.model';
import type { BulkJobSubmitResult } from '../../../../shared/bulk-jobs/bulk-jobs.model';

const queryKey = ['crm-settings', 'tags'] as const;
const retries = new WeakMap<CrmHttpTransport, Map<string, { key: string; bodyJson: string | undefined }>>();

/** GET /api/tenant/crm/v1/tags */
export function listTags(): Promise<Tag[]> {
  return crmQueries().fetchQuery({ queryKey, queryFn: () => crmHttp().read<Tag[]>('/tags') });
}

/** POST /api/tenant/crm/v1/tags */
export function createTag(input: CreateTagInput): Promise<Tag> {
  return writeTag('POST', '/tags', input);
}

/** PATCH /api/tenant/crm/v1/tags/:id */
export function updateTag(id: string, patch: UpdateTagInput): Promise<Tag> {
  return writeTag('PATCH', `/tags/${id}`, patch);
}

/** DELETE /api/tenant/crm/v1/tags/:id */
export async function deleteTag(id: string): Promise<void> {
  await deleteTagJob(id);
}

/** DELETE returns a bare submit result on 202; an empty 204 completes synchronously. */
export function deleteTagJob(id: string): Promise<BulkJobSubmitResult | undefined> {
  return writeTag('DELETE', `/tags/${id}`, undefined);
}

/** A newly opened form is a new action, even when the previous response was lost. */
export function beginTagEdit(id: string | null): void {
  retries.get(crmHttp())?.delete(id ? `PATCH /tags/${id}` : 'POST /tags');
}

async function writeTag<T>(method: CoreWriteMethod, path: string, body: unknown): Promise<T> {
  const http = crmHttp();
  let pending = retries.get(http);
  if (!pending) retries.set(http, (pending = new Map()));
  const action = `${method} ${path}`;
  const bodyJson = JSON.stringify(body);
  const previous = pending.get(action);
  const key = previous && previous.bodyJson === bodyJson ? previous.key : newIdempotencyKey();
  pending.delete(action);
  let data: T;
  try {
    data = (await http.write<T>(method, path, body, { key })).data;
  } catch (error) {
    if (isRetryableWriteError(error) || (error instanceof ApiError && error.status === 401)) {
      pending.set(action, { key, bodyJson });
    }
    throw error;
  }
  await crmQueries().cancelQueries({ queryKey });
  await crmQueries().invalidateQueries({ queryKey });
  return data;
}

/** 422 CRM_TAG_DETACH_LIMIT_EXCEEDED details { count: ['101'] }: the decimal string, or the limit when absent. */
export function detachLimitCount(error: unknown): number {
  const raw = error instanceof ApiError ? error.details?.['count'] : undefined;
  const count = Array.isArray(raw) ? Number(raw[0]) : NaN;
  return Number.isInteger(count) && count > 0 ? count : MAX_DETACH_LEADS;
}

export function tagErrorState(transloco: TranslocoService, error: unknown) {
  return crmSettingsError((key, params) =>
    Object.hasOwn(transloco.getTranslation(transloco.getActiveLang()), key)
      ? transloco.translate(key, params) : key,
  error, 'tags');
}

export function tagErrorMessage(transloco: TranslocoService, error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return transloco.translate('settings.errors.notSaved');
    if (error.status === 429) {
      const retryAfter = error.details?.['retryAfterSeconds'];
      const seconds = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
      return seconds !== undefined
        ? transloco.translate('settings.errors.rateLimitedIn', { seconds })
        : transloco.translate('settings.errors.rateLimited');
    }
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
  return tagErrorState(transloco, error).message;
}

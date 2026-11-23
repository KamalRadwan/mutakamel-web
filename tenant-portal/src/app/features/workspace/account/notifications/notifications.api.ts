import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError, errorCodeOf, errorMessage } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { newIdempotencyKey } from '../../../../core/api/idempotency';
import type { SettingsTranslator } from '../../../../core/api/settings-translator';
import type { NotificationPreference, NotificationPreferenceBody } from './notifications.model';

const PREFERENCES = '/api/tenant/core/v1/notifications/preferences';

@Service()
export class NotificationPreferencesApi {
  private readonly http = inject(CoreHttp);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, networkMode: 'always', retry: false } },
  });

  listNotificationPreferences(): Promise<NotificationPreference[]> {
    return this.queries.fetchQuery({
      queryKey: [PREFERENCES],
      queryFn: () => this.http.read<NotificationPreference[]>(PREFERENCES),
    });
  }

  async upsertNotificationPreference(
    body: NotificationPreferenceBody,
    key = newIdempotencyKey(),
  ): Promise<NotificationPreference> {
    return (await this.http.write<NotificationPreference>('PUT', PREFERENCES, body, { key })).data;
  }
}

export function notificationsErrorMessage(
  error: unknown,
  scope: string,
  t: SettingsTranslator,
  operation: 'read' | 'write' = 'read',
): string {
  const translate =
    typeof t === 'function'
      ? t
      : (key: string, params?: Record<string, unknown>) => t.translate(key, params);
  if (operation === 'write' && error instanceof ApiError && error.status === 401) {
    return translate(`${scope}.errors.notSaved`);
  }
  const code = errorCodeOf(error);
  if (code) {
    const key = `${scope}.errors.${code}`;
    const message = translate(key, error instanceof ApiError ? error.details : undefined);
    if (message && message !== key) return message;
  }
  return errorMessage(error, scope, t);
}

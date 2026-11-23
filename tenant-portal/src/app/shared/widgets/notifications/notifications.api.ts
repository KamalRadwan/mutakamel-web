import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError, errorCodeOf, errorMessage } from '../../../core/api/api-errors';
import { CoreHttp, type CoreQuery, type CoreWriteMethod } from '../../../core/api/core-http';
import type { SettingsTranslator } from '../../../core/api/settings-translator';
import type {
  NotificationListResult,
  NotificationQuery,
  NotificationReadAllResult,
  NotificationUnreadCount,
  NotificationView,
} from './notifications.model';

const BASE = '/api/tenant/core/v1/notifications';

@Service()
export class NotificationsApi {
  private readonly http = inject(CoreHttp);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, networkMode: 'always', retry: false } },
  });

  listNotifications(query: NotificationQuery = {}): Promise<NotificationListResult> {
    const { limit, cursor, unreadOnly } = query;
    return this.read(BASE, { limit, cursor, unreadOnly });
  }

  getUnreadNotificationCount(): Promise<NotificationUnreadCount> {
    return this.read(`${BASE}/unread-count`);
  }

  getNotification(id: string): Promise<NotificationView> {
    return this.read(`${BASE}/${encodeURIComponent(id)}`);
  }

  markAllNotificationsRead(key: string): Promise<NotificationReadAllResult> {
    return this.write('POST', `${BASE}/read-all`, key);
  }

  markNotificationRead(id: string, key: string): Promise<void> {
    return this.write('POST', `${BASE}/${encodeURIComponent(id)}/read`, key);
  }

  acknowledgeNotification(id: string, key: string): Promise<void> {
    return this.write('POST', `${BASE}/${encodeURIComponent(id)}/acknowledge`, key);
  }

  dismissNotification(id: string, key: string): Promise<void> {
    return this.write('DELETE', `${BASE}/${encodeURIComponent(id)}`, key);
  }

  private read<T>(path: string, query?: CoreQuery): Promise<T> {
    return this.queries.fetchQuery({
      queryKey: [path, query],
      queryFn: () => this.http.read<T>(path, query),
    });
  }

  private async write<T>(method: CoreWriteMethod, path: string, key: string): Promise<T> {
    return (await this.http.write<T>(method, path, undefined, { key, noBody: true })).data;
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

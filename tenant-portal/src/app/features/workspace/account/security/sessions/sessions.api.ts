import { DestroyRef, Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../../../core/api/api-errors';
import { CoreHttp } from '../../../../../core/api/core-http';
import { AuthSession } from '../../../../../core/auth/auth-session';
import type { SessionList } from './sessions.model';

const AUTH = '/api/tenant/core/v1/auth';

@Service()
export class SessionsApi {
  private readonly http = inject(CoreHttp);
  private readonly session = inject(AuthSession);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.queries.clear());
  }

  listSessions(historyPage = 1): Promise<SessionList> {
    return this.queries.fetchQuery({
      queryKey: [
        'account-sessions',
        this.session.me()?.id,
        this.session.requestVersion().generation,
        historyPage,
      ],
      queryFn: () =>
        this.recoverOnce(() => this.http.read<SessionList>(`${AUTH}/sessions`, { historyPage })),
    });
  }

  revokeSession(id: string): Promise<void> {
    return this.recoverOnce(async () => {
      await this.http.write<void>(
        'DELETE',
        `${AUTH}/sessions/${encodeURIComponent(id)}`,
        undefined,
        { noBody: true },
      );
    });
  }

  logoutAll(): Promise<void> {
    return this.recoverOnce(async () => {
      await this.http.write<void>('POST', `${AUTH}/logout-all`, undefined, { noBody: true });
    });
  }

  private async recoverOnce<T>(send: () => Promise<T>): Promise<T> {
    const version = this.session.requestVersion();
    try {
      return await send();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (await this.session.recoverRequest(error, version)) return send();
      throw error;
    }
  }
}

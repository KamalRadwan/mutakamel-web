import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError, errorCodeOf, errorMessage } from '../../../../core/api/api-errors';
import { CoreHttp, type CoreWriteMethod, type CoreWriteOptions } from '../../../../core/api/core-http';
import type { SettingsTranslator } from '../../../../core/api/settings-translator';
import { AuthSession } from '../../../../core/auth/auth-session';
import type { OwnNamePatch, OwnNameUser, TenantProfile, TenantProfilePatch } from './preferences.model';

const BASE = '/api/tenant/core/v1';

@Service()
export class PreferencesApi {
  private readonly http = inject(CoreHttp);
  private readonly session = inject(AuthSession);
  private readonly queries = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, networkMode: 'always' },
      mutations: { retry: false, gcTime: 0, networkMode: 'always' },
    },
  });

  getMyProfile(): Promise<TenantProfile> {
    return this.queries.fetchQuery({
      queryKey: ['account-preferences', this.session.requestVersion()],
      queryFn: () => this.http.read<TenantProfile>(`${BASE}/users/me/profile`),
    });
  }

  updateMyProfile(patch: TenantProfilePatch, key: string): Promise<TenantProfile> {
    return this.write('PUT', '/users/me/profile', patch, { key });
  }

  updateMyName(patch: OwnNamePatch, key: string): Promise<OwnNameUser> {
    return this.write('PATCH', '/users/me', patch, { key });
  }

  uploadAvatar(file: File): Promise<void> {
    const form = new FormData();
    form.append('file', file);
    // CoreHttp.writeMultipart is POST-only and requires a key; this route is PUT with mode NONE.
    return this.write('PUT', '/profile/avatar', form);
  }

  avatarUrl(revision: number): string {
    return `${BASE}/profile/avatar?v=${revision}`;
  }

  deleteAvatar(): Promise<void> {
    return this.write('DELETE', '/profile/avatar', undefined, { noBody: true });
  }

  private write<T>(method: CoreWriteMethod, path: string, body?: unknown, options?: CoreWriteOptions): Promise<T> {
    return this.queries.getMutationCache().build(this.queries, {
      mutationFn: async () => (await this.http.write<T>(method, `${BASE}${path}`, body, options)).data,
    }).execute(undefined);
  }
}

export function preferencesErrorMessage(
  error: unknown,
  t: SettingsTranslator,
  operation: 'read' | 'write' = 'read',
): string {
  const translate = typeof t === 'function' ? t : (key: string, params?: Record<string, unknown>) => t.translate(key, params);
  if (operation === 'write' && error instanceof ApiError && error.status === 401) {
    return translate('wsAccPrefs.errors.notSaved');
  }
  const code = errorCodeOf(error);
  if (code === 'GW.IDEM.MISSING' || code === 'GW.IDEM.BAD_VALUE') return translate('wsAccPrefs.errors.generic');
  return errorMessage(error, 'wsAccPrefs', t);
}

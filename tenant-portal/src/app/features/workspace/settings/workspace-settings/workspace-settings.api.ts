import { DestroyRef, Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError } from '../../../../core/api/api-errors';
import { CoreHttp } from '../../../../core/api/core-http';
import { AuthSession } from '../../../../core/auth/auth-session';
import {
  SESSION_POLICY_FIELDS,
  formatTimezoneOffset,
  type ActiveCurrency,
  type SessionPolicy,
  type SessionPolicyResult,
  type TimezoneOption,
  type UpdateSessionPolicyRequest,
  type UpdateWorkspaceSettingsRequest,
  type WorkspaceSettings,
} from './workspace-settings.model';

const BASE = '/api/tenant/core/v1';
const SETTINGS = `${BASE}/workspace-settings`;

@Service()
export class WorkspaceSettingsApi {
  private readonly http = inject(CoreHttp);
  private readonly auth = inject(AuthSession);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.queries.clear());
  }

  getSettings(): Promise<WorkspaceSettings> {
    return this.queries.fetchQuery({
      queryKey: this.key('general'),
      queryFn: async () => checkedSettings(await this.http.read<WorkspaceSettings>(SETTINGS)),
    });
  }

  async updateSettings(
    body: UpdateWorkspaceSettingsRequest,
    key: string,
  ): Promise<WorkspaceSettings> {
    const queryKey = this.key('general');
    const result = await this.http.write<WorkspaceSettings>('PUT', SETTINGS, body, { key });
    const data = checkedSettings(result.data);
    await this.invalidate(queryKey);
    return data;
  }

  getSessionPolicy(): Promise<SessionPolicyResult> {
    return this.queries.fetchQuery({
      queryKey: this.key('session'),
      queryFn: async () => {
        const result = await this.http.readWithEtag<SessionPolicy>(`${SETTINGS}/session-policy`);
        return { data: checkedPolicy(result.data), etag: result.etag };
      },
    });
  }

  async updateSessionPolicy(
    body: UpdateSessionPolicyRequest,
    key: string,
    ifMatch: string,
  ): Promise<SessionPolicyResult> {
    const queryKey = this.key('session');
    const result = await this.http.write<SessionPolicy>('PUT', `${SETTINGS}/session-policy`, body, {
      key,
      ifMatch,
    });
    const data = checkedPolicy(result.data);
    await this.invalidate(queryKey);
    return { data, etag: result.etag };
  }

  listActiveCurrencies(): Promise<ActiveCurrency[]> {
    return this.queries.fetchQuery({
      queryKey: this.key('currencies'),
      queryFn: async () =>
        (
          await this.http.readPage<ActiveCurrency>(`${BASE}/currencies`, {
            status: 'ACTIVE',
            limit: 100,
            sortBy: 'code',
            sortDir: 'ASC',
          })
        ).data,
    });
  }

  async setDefaultCurrency(id: string, key: string): Promise<void> {
    const generalKey = this.key('general');
    const currencyKey = this.key('currencies');
    await this.http.write<ActiveCurrency>(
      'POST',
      `${BASE}/currencies/${encodeURIComponent(id)}/set-default`,
      undefined,
      { key, noBody: true },
    );
    await this.invalidate(generalKey);
    await this.invalidate(currencyKey);
  }

  async listTimezones(): Promise<TimezoneOption[]> {
    const zones = Intl.supportedValuesOf('timeZone');
    const now = new Date();
    return ['UTC', ...zones.filter((zone) => zone !== 'UTC')].map((zone) => ({
      value: zone,
      label: zone,
      offset: formatTimezoneOffset(zone, now),
    }));
  }

  private key(resource: string) {
    return ['ws-settings', this.auth.me()?.id, resource] as const;
  }

  private async invalidate(queryKey: readonly unknown[]): Promise<void> {
    await this.queries.cancelQueries({ queryKey });
    await this.queries.invalidateQueries({ queryKey, refetchType: 'none' });
  }
}

function checkedSettings(data: WorkspaceSettings): WorkspaceSettings {
  if (
    !data ||
    typeof data.id !== 'string' ||
    !['en', 'ar'].includes(data.defaultLanguage) ||
    !(data.defaultCurrencyCode === null || typeof data.defaultCurrencyCode === 'string') ||
    typeof data.timezone !== 'string' ||
    typeof data.allowSupport !== 'boolean' ||
    typeof data.createdAt !== 'string' ||
    typeof data.updatedAt !== 'string'
  ) {
    throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  }
  return data;
}

function checkedPolicy(data: SessionPolicy): SessionPolicy {
  if (
    !data ||
    !SESSION_POLICY_FIELDS.every(
      (field) =>
        Number.isSafeInteger(data.effective?.[field]) &&
        Number.isSafeInteger(data.defaults?.[field]) &&
        Number.isSafeInteger(data.limits?.[field]?.min) &&
        Number.isSafeInteger(data.limits?.[field]?.max) &&
        (data.override === null || Number.isSafeInteger(data.override?.[field])),
    )
  ) {
    throw new ApiError(502, 'COMMON.GENERIC.INTERNAL_ERROR');
  }
  return data;
}

import { Service, inject } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query';
import { ApiError, errorMessage } from '../../../../core/api/api-errors';
import { CoreHttp, type CoreWriteMethod } from '../../../../core/api/core-http';
import type { SettingsTranslator } from '../../../../core/api/settings-translator';
import { AuthSession } from '../../../../core/auth/auth-session';
import type {
  CreateIceEntryBody, CreatePhoneServerBody, IceEntry, PhoneConfig, PhoneSeats,
  PhoneServer, UpdateIceEntryPatch, UpdatePhoneServerPatch,
} from './phone-servers.model';

const BASE = '/api/tenant/webphone/v1';

export function phoneErrorMessage(error: unknown, t: SettingsTranslator, write = false): string {
  const translate = typeof t === 'function' ? t : (key: string, params?: Record<string, unknown>) => t.translate(key, params);
  if (write && error instanceof ApiError && error.status === 401) return translate('wsPhone.errors.notSaved');
  if (error instanceof ApiError && error.code === 'GW.IDEM.IN_FLIGHT') return translate('wsPhone.errors.stillProcessing');
  if (error instanceof ApiError && error.code === 'WEBPHONE_SERVER_LIMIT_REACHED') {
    const limit = error.details?.['limit'];
    return translate('wsPhone.limitReached', { limit: Array.isArray(limit) ? limit[0] : 50 });
  }
  return errorMessage(error, 'wsPhone', t);
}

@Service()
export class PhoneServersApi {
  private readonly http = inject(CoreHttp);
  private readonly session = inject(AuthSession);
  private readonly queries = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, networkMode: 'always' } },
  });

  // CoreHttp unwraps Core's success envelope; DELETE 204 has no response body.
  getPhoneConfig(): Promise<PhoneConfig> { return this.read('/config'); }
  getPhoneSeats(): Promise<PhoneSeats> { return this.read('/seats'); }
  listPhoneServers(): Promise<PhoneServer[]> { return this.read('/servers'); }

  createPhoneServer(body: CreatePhoneServerBody, key: string): Promise<PhoneServer> {
    return this.write('POST', '/servers', body, key);
  }
  updatePhoneServer(id: string, body: UpdatePhoneServerPatch, key: string): Promise<PhoneServer> {
    return this.write('PATCH', `/servers/${encodeURIComponent(id)}`, body, key);
  }
  reorderPhoneServers(ids: string[], key: string): Promise<PhoneServer[]> {
    return this.write('PUT', '/servers/order', { ids }, key);
  }
  deletePhoneServer(id: string, key: string): Promise<void> {
    return this.write('DELETE', `/servers/${encodeURIComponent(id)}`, undefined, key);
  }
  createIceServer(serverId: string, body: CreateIceEntryBody, key: string): Promise<IceEntry> {
    return this.write('POST', `/servers/${encodeURIComponent(serverId)}/ice-servers`, body, key);
  }
  updateIceServer(serverId: string, id: string, body: UpdateIceEntryPatch, key: string): Promise<IceEntry> {
    return this.write('PATCH', `/servers/${encodeURIComponent(serverId)}/ice-servers/${encodeURIComponent(id)}`, body, key);
  }
  deleteIceServer(serverId: string, id: string, key: string): Promise<void> {
    return this.write('DELETE', `/servers/${encodeURIComponent(serverId)}/ice-servers/${encodeURIComponent(id)}`, undefined, key);
  }

  private read<T>(path: string): Promise<T> {
    return this.queries.fetchQuery({
      queryKey: ['ws-phone', this.session.me()?.id, path],
      queryFn: () => this.http.read<T>(BASE + path),
    });
  }

  private async write<T>(method: CoreWriteMethod, path: string, body: unknown, key: string): Promise<T> {
    const result = await this.http.write<T>(method, BASE + path, body, { key });
    await this.queries.invalidateQueries({ queryKey: ['ws-phone'] });
    return result.data;
  }
}

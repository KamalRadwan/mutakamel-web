import { Service, inject } from '@angular/core';
import type { LoginSession, TenantMe } from './auth-session.model';
import { AuthTransport } from './auth-transport';

@Service()
export class AuthSessionApi {
  private readonly transport = inject(AuthTransport);

  getMe(): Promise<TenantMe> {
    return this.transport.requestData('me');
  }

  refreshSession(): Promise<LoginSession> {
    return this.transport.requestData('refresh');
  }

  logout(): Promise<void> {
    return this.transport.requestNoContent('logout');
  }

  recordActivity(): Promise<void> {
    return this.transport.requestNoContent('activity');
  }

  hasCsrfCookie(): boolean {
    return this.transport.hasCsrfCookie();
  }
}

export function getMe(api = inject(AuthSessionApi)): Promise<TenantMe> {
  return api.getMe();
}

export function refreshSession(api = inject(AuthSessionApi)): Promise<LoginSession> {
  return api.refreshSession();
}

export function logout(api = inject(AuthSessionApi)): Promise<void> {
  return api.logout();
}

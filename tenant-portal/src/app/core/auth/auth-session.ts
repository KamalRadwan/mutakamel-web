import { DestroyRef, Service, Signal, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../api/api-errors';
import { Notify } from '../notify/notify';
import { getMe, logout as apiLogout, refreshSession } from './auth-session.api';
import type { LoginSession, SessionStatus, TenantMe } from './auth-session.model';
import { CurrentUser } from './current-user';
import { isRefreshable, isSessionEnded } from './session-errors';

const AUTH_CHANNEL = 'mutakamel-auth';
const REFRESH_LOCK = 'mutakamel-tenant-refresh';
const AUTH_ROUTE_PREFIXES = ['/login', '/verify', '/reset-password', '/tenant/reset-password', '/tenant/accept-invite'] as const;

/** Validates that a returnUrl is a relative same-app path outside auth routes. */
export function safeReturnUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;

  const pathOnly = raw.split(/[?#]/)[0];
  const normalized = pathOnly.length > 1 ? pathOnly.replace(/\/+$/, '') : pathOnly;
  if (AUTH_ROUTE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`))) {
    return null;
  }

  return raw;
}

@Service()
export class AuthSession {
  private readonly currentUser = inject(CurrentUser);
  private readonly notify = inject(Notify);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _status = signal<SessionStatus>('unknown');
  private readonly _me = signal<TenantMe | null>(null);

  readonly status: Signal<SessionStatus> = this._status.asReadonly();
  readonly me: Signal<TenantMe | null> = this._me.asReadonly();

  private generation = 0;
  private loadInFlight: Promise<SessionStatus> | null = null;
  private refreshInFlight: Promise<'ok' | 'ended'> | null = null;
  private logoutInFlight: Promise<void> | null = null;
  private sessionEndedNotified = false;
  private channel: BroadcastChannel | null = null;

  constructor() {
    this.openBroadcastChannel();
    this.destroyRef.onDestroy(() => {
      try {
        this.channel?.close();
      } catch {
        // Ignore close errors in unsupported environments.
      }
      this.channel = null;
    });
  }

  hasPermission(key: string): boolean {
    return this._me()?.permissions.includes(key) ?? false;
  }

  /** Loads /me once per sign-in (shared promise). Refreshes once on a refreshable 401. */
  ensureLoaded(): Promise<SessionStatus> {
    if (this._status() === 'signed-in' && this._me() !== null) {
      return Promise.resolve('signed-in');
    }
    if (this.loadInFlight) {
      return this.loadInFlight;
    }

    const task = this.runLoad().finally(() => {
      if (this.loadInFlight === task) {
        this.loadInFlight = null;
      }
    });
    this.loadInFlight = task;
    return task;
  }

  /** Call after login / mfa verify / accept-invite returned a LoginSession: loads /me, sets CurrentUser. */
  async signedIn(_session: LoginSession): Promise<void> {
    this.sessionEndedNotified = false;
    this.generation += 1;
    this.loadInFlight = null;
    this._me.set(null);
    this._status.set('loading');
    await this.ensureLoaded();
  }

  /** Single-flight refresh: one call per tab (shared promise) and one per browser (navigator.locks when available). */
  refresh(): Promise<'ok' | 'ended'> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const run = async (): Promise<'ok' | 'ended'> => {
      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
      if (locks && typeof locks.request === 'function') {
        return locks.request(REFRESH_LOCK, () => this.executeRefresh());
      }
      return this.executeRefresh();
    };

    const task = run().finally(() => {
      if (this.refreshInFlight === task) {
        this.refreshInFlight = null;
      }
    });
    this.refreshInFlight = task;
    return task;
  }

  /** User action: POST /auth/logout, then clearLocal and go to /login. Never retries. */
  logout(): Promise<void> {
    if (this.logoutInFlight) {
      return this.logoutInFlight;
    }

    const task = this.runLogout().finally(() => {
      if (this.logoutInFlight === task) {
        this.logoutInFlight = null;
      }
    });
    this.logoutInFlight = task;
    return task;
  }

  /** The session ended (expired, password reset, MFA change): clear local state, toast, go to /login?returnUrl. */
  async sessionEnded(returnUrl?: string): Promise<void> {
    const alreadyNotified = this.sessionEndedNotified;
    this.sessionEndedNotified = true;
    this.clearLocal();

    if (!alreadyNotified) {
      this.notify.info(
        this.transloco.translate('session.ended.title'),
        this.transloco.translate('session.ended.text'),
      );
    }

    const safe = safeReturnUrl(returnUrl ?? this.router.url);
    const tree = safe
      ? this.router.createUrlTree(['/login'], { queryParams: { returnUrl: safe } })
      : this.router.createUrlTree(['/login']);
    await this.router.navigateByUrl(tree, { replaceUrl: true });
  }

  /** Clears in-memory session state only (no network, no navigation). */
  clearLocal(): void {
    this.generation += 1;
    this.loadInFlight = null;
    this._me.set(null);
    this._status.set('signed-out');
    this.currentUser.reset();
  }

  private async runLoad(): Promise<SessionStatus> {
    const gen = this.generation;
    this._status.set('loading');

    try {
      const me = await getMe();
      if (gen !== this.generation) return this._status();
      this.applyMe(me);
      return 'signed-in';
    } catch (error) {
      if (gen !== this.generation) return this._status();

      if (isRefreshable(error)) {
        try {
          const outcome = await this.refresh();
          if (gen !== this.generation) return this._status();
          if (outcome === 'ended') return 'signed-out';

          try {
            const me = await getMe();
            if (gen !== this.generation) return this._status();
            this.applyMe(me);
            return 'signed-in';
          } catch (retryError) {
            if (gen !== this.generation) return this._status();
            if (isSessionEnded(retryError) || (retryError instanceof ApiError && retryError.status === 401)) {
              this.clearLocal();
              return 'signed-out';
            }
            this._status.set('failed');
            return 'failed';
          }
        } catch {
          if (gen !== this.generation) return this._status();
          this._status.set('failed');
          return 'failed';
        }
      }

      if (isSessionEnded(error)) {
        this.clearLocal();
        return 'signed-out';
      }

      this._status.set('failed');
      return 'failed';
    }
  }

  private async executeRefresh(): Promise<'ok' | 'ended'> {
    const gen = this.generation;
    try {
      await refreshSession();
      return 'ok';
    } catch (error) {
      if (isSessionEnded(error) || (error instanceof ApiError && (error.status === 401 || error.status === 403))) {
        if (gen === this.generation) {
          this.clearLocal();
        }
        return 'ended';
      }
      throw error;
    }
  }

  private async runLogout(): Promise<void> {
    try {
      await apiLogout();
    } catch {
      // Cookies are HttpOnly; the user still leaves even if the server call fails.
    }
    this.clearLocal();
    try {
      this.channel?.postMessage({ type: 'signed-out' });
    } catch {
      // Ignore broadcast errors.
    }
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private applyMe(me: TenantMe): void {
    this._me.set(me);
    this._status.set('signed-in');
    this.sessionEndedNotified = false;
    this.currentUser.set(me);
  }

  private openBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      const ch = new BroadcastChannel(AUTH_CHANNEL);
      ch.onmessage = (event: MessageEvent<unknown>) => {
        const data = event.data;
        if (data && typeof data === 'object' && (data as { type?: unknown }).type === 'signed-out') {
          this.clearLocal();
          void this.router.navigateByUrl('/login', { replaceUrl: true });
        }
      };
      this.channel = ch;
    } catch {
      this.channel = null;
    }
  }
}

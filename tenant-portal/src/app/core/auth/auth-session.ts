import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Service, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../api/api-errors';
import { Notify } from '../notify/notify';
import { TabLeader } from '../tabs/tab-leader';
import { AuthSessionApi } from './auth-session.api';
import type { LoginSession, SessionStatus, TenantMe } from './auth-session.model';
import { CurrentUser } from './current-user';
import { MfaPending } from './mfa-pending';
import { DEFAULT_SIGNED_IN_URL, safeReturnUrl } from './return-url';
import { isCsrfRejection, isRefreshable, isSessionEnded, refreshExpiresCookies, refreshFailureKind } from './session-errors';

const AUTH_CHANNEL = 'mutakamel-auth';
const REFRESH_LOCK = 'mutakamel-tenant-refresh';
const PENDING_LOGOUT = 'mutakamel-tenant-logout-pending';
const REFRESH_RETRY_DELAY_MS = 30_000;
const ACTIVITY_INTERVAL_MS = 60_000;

type Renewal = 'ok' | 'ended';
type RenewalTrigger = 'manual' | 'request' | 'background';
export type RenewalState = 'ok' | 'retrying';
export type SignInOutcome = 'signed-in' | 'signed-out' | 'failed';
export type ServerSignOutNotice = 'security.mfaChanged' | 'security.allSessionsEnded';

interface AccessTiming {
  issuedAt: number;
  expiresAt: number;
  refreshAt: number;
}

interface RequestVersion {
  generation: number;
  revision: number;
}

function accessTiming(expiresIn: number, issuedAt: number): AccessTiming {
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) throw new Error('Invalid access lifetime');
  const lifetime = expiresIn * 1_000;
  const lead = Math.min(30_000, Math.max(1_000, lifetime * 0.1), lifetime / 2);
  return { issuedAt, expiresAt: issuedAt + lifetime, refreshAt: issuedAt + lifetime - lead };
}

function readTiming(value: unknown): AccessTiming | null {
  if (!value || typeof value !== 'object') return null;
  const timing = value as Partial<AccessTiming>;
  const { issuedAt, expiresAt, refreshAt } = timing;
  if (typeof issuedAt !== 'number' || typeof expiresAt !== 'number' || typeof refreshAt !== 'number') return null;
  return Number.isFinite(issuedAt) && Number.isFinite(expiresAt) && Number.isFinite(refreshAt) &&
    issuedAt <= refreshAt && refreshAt < expiresAt && expiresAt > Date.now()
    ? { issuedAt, expiresAt, refreshAt }
    : null;
}

@Service()
export class AuthSession {
  private readonly api = inject(AuthSessionApi);
  private readonly currentUser = inject(CurrentUser);
  private readonly mfaPending = inject(MfaPending);
  private readonly notify = inject(Notify);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly leader = inject(TabLeader);
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly destroyRef = inject(DestroyRef);

  private readonly _status = signal<SessionStatus>('unknown');
  private readonly _me = signal<TenantMe | null>(null);
  private readonly _renewal = signal<RenewalState>('ok');

  readonly status = this._status.asReadonly();
  readonly me = this._me.asReadonly();
  readonly renewal = this._renewal.asReadonly();

  private generation = 0;
  private revision = 0;
  private loadInFlight: Promise<SessionStatus> | null = null;
  private refreshInFlight: Promise<Renewal> | null = null;
  private logoutInFlight: Promise<void> | null = null;
  private pendingLogoutInFlight: Promise<void> | null = null;
  private fallbackLock: Promise<unknown> | null = null;
  private pendingLogout = false;
  private timing: AccessTiming | null = null;
  private retryAt = 0;
  private meNeedsRefresh = false;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private lastActivityAt = Number.NEGATIVE_INFINITY;
  private sessionEndedNotified = false;
  private channel: BroadcastChannel | null = null;

  private readonly checkDeadline = (): void => {
    if (this._renewal() === 'retrying') this.retryAt = 0;
    this.scheduleRefresh();
  };

  private readonly onOnline = (): void => {
    this.retryPendingLogout();
    this.retryAt = 0;
    this.scheduleRefresh();
    if (this._status() === 'failed') void this.ensureLoaded();
  };

  private readonly onHumanActivity = (event: Event): void => {
    if (!event.isTrusted || (event.type === 'keydown' && (event as KeyboardEvent).repeat)) return;
    if (this._status() !== 'signed-in' || this.document.hidden || this.window?.navigator.onLine === false) return;
    const now = Date.now();
    if (now - this.lastActivityAt < ACTIVITY_INTERVAL_MS) return;
    this.lastActivityAt = now;
    void this.api.recordActivity().catch(() => undefined);
  };

  constructor() {
    this.openBroadcastChannel();
    this.retryPendingLogout();
    effect(() => {
      this.leader.isLeader();
      untracked(() => this.scheduleRefresh());
    });

    this.window?.addEventListener('focus', this.checkDeadline);
    this.window?.addEventListener('pageshow', this.checkDeadline);
    this.window?.addEventListener('online', this.onOnline);
    this.document.addEventListener('visibilitychange', this.checkDeadline);
    this.document.addEventListener('pointerdown', this.onHumanActivity, true);
    this.document.addEventListener('keydown', this.onHumanActivity, true);
    this.destroyRef.onDestroy(() => {
      this.generation += 1;
      this.stopRefreshTimer();
      this.channel?.close();
      this.window?.removeEventListener('focus', this.checkDeadline);
      this.window?.removeEventListener('pageshow', this.checkDeadline);
      this.window?.removeEventListener('online', this.onOnline);
      this.document.removeEventListener('visibilitychange', this.checkDeadline);
      this.document.removeEventListener('pointerdown', this.onHumanActivity, true);
      this.document.removeEventListener('keydown', this.onHumanActivity, true);
    });
  }

  hasPermission(key: string): boolean {
    return this._me()?.permissions.includes(key) ?? false;
  }

  /** Shared bootstrap. Its failed state renders the existing retry view in the shell. */
  ensureLoaded(mode: 'protected' | 'guest' = 'protected'): Promise<SessionStatus> {
    const status = this._status();
    if (status === 'signed-in' || status === 'signed-out') return Promise.resolve(status);
    if (this.loadInFlight) {
      return mode === 'guest' ? this.loadInFlight : this.loadInFlight.then((result) =>
        result === 'unknown' ? this.ensureLoaded() : result,
      );
    }
    if (mode === 'guest' && (status !== 'unknown' || !this.api.hasCsrfCookie())) {
      return Promise.resolve(status);
    }

    const task = this.runLoad(mode).finally(() => {
      if (this.loadInFlight === task) this.loadInFlight = null;
    });
    this.loadInFlight = task;
    return task;
  }

  /** Called only after the browser has accepted the login or MFA session cookies. */
  async signedIn(session: LoginSession): Promise<SignInOutcome> {
    this.resetSession('loading');
    this.sessionEndedNotified = false;
    this.timing = accessTiming(session.expiresIn, Date.now());
    const generation = this.generation;
    const status = await this.ensureLoaded();
    if (generation !== this.generation) return 'signed-out';
    if (status === 'signed-in') this.broadcast({ type: 'renewed', timing: this.timing });
    return status === 'signed-in' || status === 'failed' ? status : 'signed-out';
  }

  requestVersion(): RequestVersion {
    return { generation: this.generation, revision: this.revision };
  }

  /** Cookie-issuing requests share the logout lock so a queued logout cannot revoke their new session. */
  completeSignInRequest<T>(request: () => Promise<T>, issuedSession: (result: T) => boolean): Promise<T> {
    return this.withSessionLock(async () => {
      const result = await request();
      if (issuedSession(result)) this.setPendingLogout(false);
      return result;
    });
  }

  /** A response from an older login must never affect, or be replayed under, the current login. */
  async recoverRequest(error: ApiError, version: RequestVersion): Promise<boolean> {
    if (version.generation !== this.generation || this._status() !== 'signed-in') return false;
    if (error.status !== 401 && !(error.status === 403 && error.code === 'SESSION_IDENTITY_INACTIVE')) return false;

    const hasCsrf = this.api.hasCsrfCookie();
    if (isRefreshable(error, hasCsrf) || (hasCsrf && error.status === 401 && error.code === 'GW.AUTH.SESSION_REVOKED')) {
      const result = await this.renew('request', version);
      return result === 'ok' && version.generation === this.generation;
    }
    if (version.revision === this.revision && isSessionEnded(error)) await this.sessionEnded();
    return false;
  }

  refresh(): Promise<Renewal> {
    return this.renew('manual');
  }

  async reloadProfile(version: RequestVersion): Promise<void> {
    await this.withSessionLock(async () => {
      if (version.generation === this.generation && this._status() === 'signed-in') {
        await this.loadMe(version.generation);
      }
    });
  }

  logout(): Promise<void> {
    if (this.logoutInFlight) return this.logoutInFlight;

    const task = this.runLogout().finally(() => {
      if (this.logoutInFlight === task) this.logoutInFlight = null;
    });
    this.logoutInFlight = task;
    return task;
  }

  async sessionEnded(returnUrl?: string): Promise<void> {
    const alreadyNotified = this.sessionEndedNotified;
    this.sessionEndedNotified = true;
    this.signOutLocally();
    if (!alreadyNotified) {
      this.notify.info(
        this.transloco.translate('session.ended.title'),
        this.transloco.translate('session.ended.text'),
      );
    }
    await this.navigateToLogin(returnUrl ?? this.router.url);
  }

  /** The server has already ended this session (security change). Leave every tab, with no logout call and no returnUrl. */
  async signedOutByServer(notice: ServerSignOutNotice): Promise<void> {
    this.signOutLocally();
    this.notify.info(this.transloco.translate(`${notice}.title`), this.transloco.translate(`${notice}.text`));
    await this.navigateToLogin();
  }

  /** Clears in-memory state only. Server-side termination is a separate operation. */
  clearLocal(): void {
    this.resetSession('signed-out');
  }

  private signOutLocally(): void {
    this.mfaPending.clear();
    this.clearLocal();
    this.broadcast({ type: 'signed-out', at: Date.now() });
  }

  private resetSession(status: 'loading' | 'signed-out'): void {
    this.generation += 1;
    this.loadInFlight = null;
    this.refreshInFlight = null;
    this.timing = null;
    this.retryAt = 0;
    this.meNeedsRefresh = false;
    this._renewal.set('ok');
    this.lastActivityAt = Number.NEGATIVE_INFINITY;
    this.stopRefreshTimer();
    this._me.set(null);
    this._status.set(status);
    this.currentUser.reset();
  }

  private async runLoad(mode: 'protected' | 'guest'): Promise<SessionStatus> {
    if (this.hasPendingLogout()) {
      this.clearLocal();
      this.retryPendingLogout();
      return 'signed-out';
    }

    const generation = this.generation;
    this._status.set('loading');
    try {
      await this.loadMe(generation);
    } catch (error) {
      if (generation !== this.generation) return this._status();
      if (mode === 'guest') {
        if (isRefreshable(error, this.api.hasCsrfCookie())) {
          try {
            await this.refresh();
          } catch {
            if (generation === this.generation) this._status.set('unknown');
          }
        } else {
          this._status.set('unknown');
        }
      } else if (isRefreshable(error, this.api.hasCsrfCookie())) {
        try {
          await this.refresh();
        } catch {
          if (generation === this.generation) this._status.set('failed');
        }
      } else if (isSessionEnded(error) || (error instanceof ApiError && error.status === 401 && error.code === 'COMMON.GENERIC.UNAUTHORIZED')) {
        this.clearLocal();
      } else {
        this._status.set('failed');
      }
    }
    return this._status();
  }

  private renew(trigger: RenewalTrigger, version = this.requestVersion()): Promise<Renewal> {
    if (version.generation !== this.generation || this._status() === 'signed-out') return Promise.resolve('ended');
    if (this.refreshInFlight) return this.refreshInFlight;
    if (version.revision !== this.revision) return Promise.resolve('ok');

    const task = this.withSessionLock((waited) => this.executeRenewal(trigger, version, waited))
      .catch((error: unknown) => {
        if (version.generation === this.generation && this._status() === 'signed-in') {
          const retryAfter = error instanceof ApiError ? error.details?.['retryAfterSeconds'] : undefined;
          const retrySeconds = Number(Array.isArray(retryAfter) ? retryAfter[0] : retryAfter);
          this.retryAt = Date.now() + (Number.isFinite(retrySeconds) && retrySeconds > 0
            ? retrySeconds * 1_000
            : REFRESH_RETRY_DELAY_MS);
          this._renewal.set('retrying');
        }
        throw error;
      })
      .finally(() => {
        if (this.refreshInFlight !== task) return;
        this.refreshInFlight = null;
        this.scheduleRefresh();
      });
    this.refreshInFlight = task;
    return task;
  }

  private async executeRenewal(trigger: RenewalTrigger, version: RequestVersion, waited: boolean): Promise<Renewal> {
    if (version.generation !== this.generation) return 'ended';
    if (this.hasPendingLogout()) return this.endRenewal(false, false);
    if (version.revision !== this.revision) return 'ok';
    if (trigger === 'background' && !this.meNeedsRefresh && !this.refreshIsDue()) return 'ok';

    // Another tab may have refreshed while we waited, even before its broadcast arrives.
    if (this.meNeedsRefresh || (waited && trigger !== 'background')) {
      try {
        return await this.loadMe(version.generation) ? 'ok' : 'ended';
      } catch (error) {
        if (version.generation !== this.generation) return 'ended';
        if (!isRefreshable(error, this.api.hasCsrfCookie())) {
          if (isSessionEnded(error)) return this.endRenewal(false, true);
          if (!(error instanceof ApiError && error.status === 401)) throw error;
        }
      }
    }

    const issuedAt = Date.now();
    let refreshed = false;
    try {
      const session = await this.api.refreshSession();
      refreshed = true;
      if (version.generation !== this.generation) return 'ended';
      this.timing = accessTiming(session.expiresIn, issuedAt);
      if (!await this.loadMe(version.generation, true)) return 'ended';
      this.broadcast({ type: 'renewed', timing: this.timing });
      return 'ok';
    } catch (error) {
      if (version.generation !== this.generation) return 'ended';
      if (refreshed) {
        if (error instanceof ApiError && refreshFailureKind(error) === 'transient') {
          this.meNeedsRefresh = true;
          throw error;
        }
        return this.endRenewal(true, isSessionEnded(error));
      }
      if (refreshFailureKind(error) === 'transient') throw error;
      return this.endRenewal(!refreshExpiresCookies(error) && !isCsrfRejection(error), true);
    }
  }

  private endRenewal(needsLogout: boolean, notify: boolean): Renewal {
    if (needsLogout) this.setPendingLogout(true);
    const signedIn = this._status() === 'signed-in';
    if (signedIn && notify) {
      void this.sessionEnded();
    } else {
      this.signOutLocally();
      if (signedIn) void this.navigateToLogin(this.router.url);
    }
    // The cleanup uses the same lock as renewal and must run after this callback releases it.
    if (needsLogout) this.retryPendingLogout();
    return 'ended';
  }

  private async loadMe(generation: number, afterRefresh = false): Promise<boolean> {
    const me = await this.api.getMe();
    if (generation !== this.generation) return false;
    const previous = this._me();
    if (previous && previous.id !== me.id) {
      if (afterRefresh) throw new Error('Session identity changed during renewal');
      this.clearLocal();
      await this.navigateToLogin(this.router.url);
      return false;
    }

    this._me.set(me);
    this.currentUser.set(me);
    this.revision += 1;
    this.meNeedsRefresh = false;
    this.retryAt = 0;
    this.sessionEndedNotified = false;
    this._status.set('signed-in');
    this._renewal.set('ok');
    this.scheduleRefresh();
    return true;
  }

  private async withSessionLock<T>(work: (waited: boolean) => Promise<T>): Promise<T> {
    const locks = this.window?.navigator.locks;
    if (!locks?.request) {
      const previous = this.fallbackLock;
      const task = previous ? previous.catch(() => undefined).then(() => work(true)) : work(false);
      this.fallbackLock = task;
      try {
        return await task;
      } finally {
        if (this.fallbackLock === task) this.fallbackLock = null;
      }
    }

    // Older shims expose only the basic request overload.
    if (!locks.query) return locks.request(REFRESH_LOCK, () => work(false));
    const immediate = await locks.request(REFRESH_LOCK, { ifAvailable: true }, async (lock) =>
      lock ? { result: await work(false) } : null,
    );
    if (immediate) return immediate.result;
    return locks.request(REFRESH_LOCK, () => work(true));
  }

  private async runLogout(): Promise<void> {
    this.signOutLocally();
    const generation = this.generation;
    try {
      await this.withSessionLock(() => this.api.logout());
    } catch {
      // The local session is closed even when server-side logout cannot be confirmed.
      if (generation === this.generation) this.notify.error(this.transloco.translate('apiErrors.generic'));
    }
    if (generation === this.generation) await this.navigateToLogin();
  }

  private hasPendingLogout(): boolean {
    try {
      return this.window?.localStorage.getItem(PENDING_LOGOUT) === '1';
    } catch {
      return this.pendingLogout;
    }
  }

  private setPendingLogout(pending: boolean): void {
    this.pendingLogout = pending;
    try {
      if (pending) this.window?.localStorage.setItem(PENDING_LOGOUT, '1');
      else this.window?.localStorage.removeItem(PENDING_LOGOUT);
    } catch {
      // The in-memory flag still blocks recovery in this tab when storage is unavailable.
    }
  }

  private retryPendingLogout(): void {
    if (this.pendingLogoutInFlight || !this.hasPendingLogout() ||
        this.window?.navigator.onLine === false || !this.api.hasCsrfCookie()) return;

    this.pendingLogoutInFlight = this.withSessionLock(async () => {
      if (!this.hasPendingLogout() || this.destroyRef.destroyed ||
          this.window?.navigator.onLine === false || !this.api.hasCsrfCookie()) return;
      await this.api.logout();
      this.setPendingLogout(false);
    }).catch(() => {
      // Keep the marker until Core confirms cleanup or the user obtains a new session.
    }).finally(() => {
      this.pendingLogoutInFlight = null;
    });
  }

  private async navigateToLogin(returnUrl?: string): Promise<void> {
    const safe = safeReturnUrl(returnUrl);
    if (!safe && this.router.url === '/login') return;
    const target = safe
      ? this.router.createUrlTree(['/login'], { queryParams: { returnUrl: safe } })
      : returnUrl === undefined ? '/login' : this.router.createUrlTree(['/login']);
    await this.router.navigateByUrl(target, { replaceUrl: true });
  }

  private refreshDeadline(): number | null {
    if (this._status() !== 'signed-in' || this.window?.navigator.onLine === false) return null;
    if (this.meNeedsRefresh || this._renewal() === 'retrying') return this.retryAt;
    if (!this.leader.isLeader() || !this.timing) return null;
    return Math.max(this.timing.refreshAt, this.retryAt);
  }

  private refreshIsDue(): boolean {
    const deadline = this.refreshDeadline();
    return deadline !== null && deadline <= Date.now();
  }

  private scheduleRefresh(): void {
    this.stopRefreshTimer();
    if (this.refreshInFlight || this.destroyRef.destroyed) return;

    const deadline = this.refreshDeadline();
    if (deadline === null) return;
    const delay = Math.min(Math.max(0, deadline - Date.now()), 2_147_483_647);
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = undefined;
      if (this.refreshIsDue()) void this.renew('background').catch(() => undefined);
      else this.scheduleRefresh();
    }, delay);
  }

  private stopRefreshTimer(): void {
    if (this.refreshTimer !== undefined) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  private broadcast(message: { type: 'signed-out'; at: number } | { type: 'renewed'; timing: AccessTiming }): void {
    try {
      this.channel?.postMessage(message);
    } catch {
      // Local recovery still works when cross-tab delivery is unavailable.
    }
  }

  private openBroadcastChannel(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      this.channel = new BroadcastChannel(AUTH_CHANNEL);
      this.channel.onmessage = ({ data }: MessageEvent<unknown>) => {
        if (!data || typeof data !== 'object') return;
        const message = data as { type?: unknown; at?: unknown; timing?: unknown };
        if (message.type === 'signed-out') {
          if (typeof message.at === 'number' && message.at < (this.timing?.issuedAt ?? 0)) return;
          const signedIn = this._status() === 'signed-in';
          if (signedIn) this.mfaPending.clear();
          this.clearLocal();
          if (signedIn) void this.navigateToLogin();
        } else if (message.type === 'renewed' && this._status() !== 'signed-out') {
          const timing = readTiming(message.timing);
          if (!timing || timing.issuedAt <= (this.timing?.issuedAt ?? 0)) return;
          this.timing = timing;
          if (this._status() === 'signed-in') this.meNeedsRefresh = true;
          if (this._renewal() === 'retrying') this.retryAt = 0;
          this.scheduleRefresh();
        }
      };
    } catch {
      this.channel = null;
    }
  }
}

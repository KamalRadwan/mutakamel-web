import { DestroyRef, EnvironmentInjector, Injectable, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/api-errors';
import { Notify } from '../notify/notify';
import { AuthSession, safeReturnUrl } from './auth-session';
import { AuthSessionApi } from './auth-session.api';
import { FAKE_TENANT_ME, fakeGetMe, fakeLogout, fakeRefreshSession, fakeSessionCallCounts, resetFakeSession, setFakeLogoutError, setFakeSessionNext } from './auth-session.fake';
import type { TenantMe } from './auth-session.model';
import { CurrentUser } from './current-user';
import { MfaPending } from './mfa-pending';

const MFA_STEP = { mfaRequired: true, challengeId: 'challenge', expiresIn: 60, resendAfterSeconds: 10 } as const;

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

class FakeBroadcastChannel {
  private static readonly channels = new Map<string, Set<FakeBroadcastChannel>>();

  static reset(): void {
    for (const set of FakeBroadcastChannel.channels.values()) {
      for (const ch of set) {
        ch.closed = true;
        ch.onmessage = null;
      }
    }
    FakeBroadcastChannel.channels.clear();
  }

  onmessage: ((ev: MessageEvent<unknown>) => void) | null = null;
  private closed = false;

  constructor(readonly name: string) {
    let set = FakeBroadcastChannel.channels.get(name);
    if (!set) {
      set = new Set<FakeBroadcastChannel>();
      FakeBroadcastChannel.channels.set(name, set);
    }
    set.add(this);
  }

  postMessage(data: unknown): void {
    if (this.closed) return;
    const cloned = structuredClone(data);
    for (const peer of FakeBroadcastChannel.channels.get(this.name) ?? []) {
      if (peer === this || peer.closed) continue;
      queueMicrotask(() => {
        if (!peer.closed) {
          peer.onmessage?.(new MessageEvent('message', { data: structuredClone(cloned) }));
        }
      });
    }
  }

  close(): void {
    this.closed = true;
    this.onmessage = null;
    FakeBroadcastChannel.channels.get(this.name)?.delete(this);
  }
}

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(2_000);
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

describe('AuthSession', () => {
  const pendingLogout = 'mutakamel-tenant-logout-pending';
  let originalBroadcastChannel: typeof BroadcastChannel | undefined;
  let originalLocksDescriptor: PropertyDescriptor | undefined;
  let extraInjectors: EnvironmentInjector[];
  const api = {
    getMe: vi.fn(fakeGetMe),
    refreshSession: vi.fn(fakeRefreshSession),
    logout: vi.fn(fakeLogout),
    recordActivity: vi.fn(async () => undefined),
    hasCsrfCookie: vi.fn(() => true),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    extraInjectors = [];
    resetFakeSession();
    api.getMe.mockReset();
    api.refreshSession.mockReset();
    api.logout.mockReset();
    api.hasCsrfCookie.mockReset();
    api.recordActivity.mockClear();
    localStorage.removeItem(pendingLogout);

    originalBroadcastChannel = globalThis.BroadcastChannel;
    globalThis.BroadcastChannel = FakeBroadcastChannel as unknown as typeof BroadcastChannel;
    originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSessionApi, useValue: api },
        provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: EmptyLoader,
        }),
      ],
    });
  });

  afterEach(() => {
    for (const injector of extraInjectors) {
      injector.destroy();
    }
    FakeBroadcastChannel.reset();
    resetFakeSession();
    localStorage.removeItem(pendingLogout);

    if (originalBroadcastChannel) {
      globalThis.BroadcastChannel = originalBroadcastChannel;
    } else {
      Reflect.deleteProperty(globalThis, 'BroadcastChannel');
    }

    if (originalLocksDescriptor) {
      Object.defineProperty(navigator, 'locks', originalLocksDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'locks');
    }

    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('restores valid access through /me after reload without refreshing', async () => {
    const session = TestBed.inject(AuthSession);
    const currentUser = TestBed.inject(CurrentUser);

    expect(session.status()).toBe('unknown');
    expect(await settle(session.ensureLoaded())).toBe('signed-in');
    expect(session.status()).toBe('signed-in');
    expect(session.me()?.email).toBe('owner@mutakamel.io');
    expect(session.hasPermission('notifications.notification.read')).toBe(true);
    expect(session.hasPermission('missing.permission')).toBe(false);
    expect(currentUser.user().email).toBe('owner@mutakamel.io');
    expect(fakeSessionCallCounts().me).toBe(1);

    expect(await settle(session.ensureLoaded())).toBe('signed-in');
    await vi.advanceTimersByTimeAsync(6_000);
    expect(fakeSessionCallCounts()).toEqual({ me: 1, refresh: 0, logout: 0 });
  });

  it('refreshes once on 401 COMMON.AUTH.TOKEN_EXPIRED and succeeds', async () => {
    setFakeSessionNext('TOKEN_EXPIRED');
    const session = TestBed.inject(AuthSession);

    expect(await settle(session.ensureLoaded())).toBe('signed-in');
    expect(session.status()).toBe('signed-in');
    await vi.advanceTimersByTimeAsync(6_000);
    expect(fakeSessionCallCounts()).toEqual({ me: 2, refresh: 1, logout: 0 });
  });

  it('marks signed-out when refresh is refused after token expiry', async () => {
    setFakeSessionNext('ENDED');
    const session = TestBed.inject(AuthSession);

    expect(await settle(session.ensureLoaded())).toBe('signed-out');
    expect(session.status()).toBe('signed-out');
    expect(session.me()).toBeNull();
    expect(fakeSessionCallCounts()).toEqual({ me: 1, refresh: 1, logout: 0 });
  });

  it('marks signed-out on 403 SESSION_IDENTITY_INACTIVE without refreshing', async () => {
    setFakeSessionNext('INACTIVE');
    const session = TestBed.inject(AuthSession);

    expect(await settle(session.ensureLoaded())).toBe('signed-out');
    expect(fakeSessionCallCounts()).toEqual({ me: 1, refresh: 0, logout: 0 });
  });

  it('marks failed on 500 without losing the ability to retry', async () => {
    setFakeSessionNext('SERVER_ERROR');
    const session = TestBed.inject(AuthSession);
    const identity = TestBed.inject(CurrentUser);

    expect(await settle(session.ensureLoaded())).toBe('failed');
    expect(session.status()).toBe('failed');
    expect(identity.user()).toMatchObject({ displayName: '', email: '' });

    api.getMe.mockResolvedValueOnce({ ...FAKE_TENANT_ME, firstName: 'Retry', lastName: 'Reviewer' });
    expect(await settle(session.ensureLoaded())).toBe('signed-in');
    expect(session.status()).toBe('signed-in');
    expect(identity.user().displayName).toBe('Retry Reviewer');
  });

  it('rereads the organization scope for the originating login without renewing tokens', async () => {
    const session = TestBed.inject(AuthSession);
    expect(await settle(session.ensureLoaded())).toBe('signed-in');
    const version = session.requestVersion();
    api.getMe.mockResolvedValueOnce({ ...FAKE_TENANT_ME, hasMultipleOrganizationScopes: true });

    await settle(session.reloadProfile(version));
    expect(session.me()?.hasMultipleOrganizationScopes).toBe(true);
    expect(api.refreshSession).not.toHaveBeenCalled();

    session.clearLocal();
    await settle(session.reloadProfile(version));
    expect(api.getMe).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent ensureLoaded() and refresh() calls into single fake requests', async () => {
    const requestSpy = vi.fn(<T>(_name: string, fn: () => Promise<T>) => fn());
    Object.defineProperty(navigator, 'locks', {
      value: { request: requestSpy },
      configurable: true,
      writable: true,
    });

    const session = TestBed.inject(AuthSession);
    const [s1, s2] = await settle(Promise.all([session.ensureLoaded(), session.ensureLoaded()]));
    expect([s1, s2]).toEqual(['signed-in', 'signed-in']);
    expect(fakeSessionCallCounts().me).toBe(1);

    const [r1, r2] = await settle(Promise.all([session.refresh(), session.refresh()]));
    expect([r1, r2]).toEqual(['ok', 'ok']);
    expect(fakeSessionCallCounts().refresh).toBe(1);
    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy).toHaveBeenCalledWith('mutakamel-tenant-refresh', expect.any(Function));
  });

  it('clears the signed-in session on a refresh 500 and requests cookie cleanup', async () => {
    const session = TestBed.inject(AuthSession);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await settle(session.ensureLoaded());
    const mfa = TestBed.inject(MfaPending);
    mfa.set(MFA_STEP, { origin: 'login' });

    setFakeSessionNext('SERVER_ERROR');
    expect(await settle(session.refresh())).toBe('ended');
    expect(session.status()).toBe('signed-out');
    expect(TestBed.inject(CurrentUser).user().email).toBe('');
    expect(mfa.current()).toBeNull();
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(pendingLogout)).toBeNull();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('clears cookies through logout when /me fails after refresh rotated them', async () => {
    const session = TestBed.inject(AuthSession);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await settle(session.ensureLoaded());
    api.getMe.mockRejectedValueOnce(new ApiError(503, 'TENANT_INACTIVE'));

    const failure = new ApiError(401, 'COMMON.AUTH.INVALID_ACCESS_TOKEN');
    const version = session.requestVersion();
    const recovery = [session.recoverRequest(failure, version), session.recoverRequest(failure, version)];
    expect(await settle(Promise.all(recovery))).toEqual([false, false]);
    expect(session.status()).toBe('signed-out');
    expect(session.me()).toBeNull();
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
    expect(api.logout).toHaveBeenCalledTimes(1);
  });

  it('blocks bootstrap on reload after an offline refresh failure and retries cleanup online', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const session = TestBed.inject(AuthSession);
      api.getMe.mockRejectedValueOnce(new ApiError(401, 'COMMON.AUTH.MISSING_BEARER_TOKEN'));
      api.refreshSession.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
      expect(await settle(session.ensureLoaded())).toBe('signed-out');
      expect(localStorage.getItem(pendingLogout)).toBe('1');
      expect(api.logout).not.toHaveBeenCalled();

      const reloaded = createEnvironmentInjector([AuthSession], TestBed.inject(EnvironmentInjector));
      extraInjectors.push(reloaded);
      expect(await settle(reloaded.get(AuthSession).ensureLoaded())).toBe('signed-out');
      expect(api.getMe).toHaveBeenCalledTimes(1);
      expect(api.refreshSession).toHaveBeenCalledTimes(1);

      online.mockReturnValue(true);
      extraInjectors.pop();
      reloaded.destroy();
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(2_000);
      expect(api.logout).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem(pendingLogout)).toBeNull();
    } finally {
      online.mockRestore();
    }
  });

  it('retains the marker after a rejected cleanup and a login challenge', async () => {
    localStorage.setItem(pendingLogout, '1');
    api.logout.mockRejectedValueOnce(new ApiError(403, 'AUTH_CSRF_INVALID'));
    const session = TestBed.inject(AuthSession);
    expect(await settle(session.ensureLoaded())).toBe('signed-out');
    expect(api.logout).toHaveBeenCalledTimes(1);
    expect(await session.completeSignInRequest(async () => 'mfa-challenge', () => false)).toBe('mfa-challenge');
    expect(localStorage.getItem(pendingLogout)).toBe('1');
    expect(api.getMe).not.toHaveBeenCalled();
  });

  it('drops queued cleanup when a new login wins the cookie lock', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      localStorage.setItem(pendingLogout, '1');
      const session = TestBed.inject(AuthSession);
      expect(await settle(session.ensureLoaded())).toBe('signed-out');
      let complete!: (value: string) => void;
      const login = session.completeSignInRequest(() => new Promise<string>(resolve => { complete = resolve; }), () => true);
      online.mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
      complete('session-issued');
      await login;
      await vi.advanceTimersByTimeAsync(2_000);

      expect(api.logout).not.toHaveBeenCalled();
      expect(localStorage.getItem(pendingLogout)).toBeNull();
    } finally {
      online.mockRestore();
    }
  });

  it('shares renewal until /me replaces the old permissions, without navigation or a loading state', async () => {
    const session = TestBed.inject(AuthSession);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const notify = TestBed.inject(Notify);
    const info = vi.spyOn(notify, 'info');
    const error = vi.spyOn(notify, 'error');
    const success = vi.spyOn(notify, 'success');
    const originalScope = { tenantWide: false, companyIds: ['company-one'], branchIds: ['branch-one'] };
    const renewedScope = { tenantWide: false, companyIds: ['company-two'], branchIds: ['branch-two'] };
    api.getMe.mockResolvedValueOnce({
      ...FAKE_TENANT_ME, firstName: 'Active', lastName: 'Reviewer', isTenantOwner: false, permissions: ['crm.leads.read'],
      permissionScopes: { 'crm.leads.read': originalScope },
    });
    await settle(session.ensureLoaded());
    expect(session.hasPermission('crm.leads.read')).toBe(true);
    expect(session.me()?.permissionScopes).toEqual({ 'crm.leads.read': originalScope });
    expect(session.hasPermission('tenant.roles.read')).toBe(false);

    let resolveMe!: (me: TenantMe) => void;
    api.getMe.mockReturnValueOnce(new Promise<TenantMe>(resolve => { resolveMe = resolve; }));
    const renewals = Array.from({ length: 8 }, () => session.refresh());
    let finished = false;
    const completion = Promise.all(renewals).then(outcomes => { finished = true; return outcomes; });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(api.refreshSession).toHaveBeenCalledTimes(1);
    expect(api.getMe).toHaveBeenCalledTimes(2);
    expect(finished).toBe(false);
    expect(session.status()).toBe('signed-in');
    expect(TestBed.inject(CurrentUser).user().displayName).toBe('Active Reviewer');
    resolveMe({
      ...FAKE_TENANT_ME, firstName: 'Renewed', lastName: 'Reviewer', isTenantOwner: false, permissions: ['tenant.roles.read'],
      permissionScopes: { 'tenant.roles.read': renewedScope },
    });
    expect(await completion).toEqual(Array(8).fill('ok'));
    expect(session.hasPermission('crm.leads.read')).toBe(false);
    expect(session.hasPermission('tenant.roles.read')).toBe(true);
    expect(TestBed.inject(CurrentUser).user().displayName).toBe('Renewed Reviewer');
    expect(session.me()?.permissionScopes).toEqual({ 'tenant.roles.read': renewedScope });
    expect(navigate).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it('renews before the server access lifetime elapses and does not report idle time as activity', async () => {
    const session = TestBed.inject(AuthSession);
    const metadata = await settle(fakeRefreshSession());
    await settle(session.signedIn({ ...metadata, expiresIn: 120 }));
    expect(api.refreshSession).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(117_999);
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
    expect(api.getMe).toHaveBeenCalledTimes(2);
    expect(api.recordActivity).not.toHaveBeenCalled();
    expect(session.status()).toBe('signed-in');
  });

  it('logout clears local state and navigates even when the server logout call throws', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());

    setFakeLogoutError(new Error('network down'));
    await settle(session.logout());

    expect(session.status()).toBe('signed-out');
    expect(session.me()).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('clears identity and permissions when the server ends an active session for inactivity', async () => {
    const session = TestBed.inject(AuthSession);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const info = vi.spyOn(TestBed.inject(Notify), 'info');
    await settle(session.ensureLoaded());
    setFakeSessionNext('ENDED');
    expect(await settle(session.refresh())).toBe('ended');
    expect(session.status()).toBe('signed-out');
    expect(session.me()).toBeNull();
    expect(session.hasPermission('crm.leads.read')).toBe(false);
    expect(info).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('broadcasts signed-out across tabs to clear another instance without raising a toast there', async () => {
    const router1 = TestBed.inject(Router);
    const navigate1 = vi.spyOn(router1, 'navigateByUrl').mockResolvedValue(true);
    const session1 = TestBed.inject(AuthSession);
    await settle(session1.ensureLoaded());

    const otherNotify = { info: vi.fn() };
    const otherRouter = {
      url: '/crm/leads',
      navigateByUrl: vi.fn().mockResolvedValue(true),
      createUrlTree: router1.createUrlTree.bind(router1),
    };
    const otherInjector = createEnvironmentInjector(
      [
        AuthSession,
        CurrentUser,
        { provide: Notify, useValue: otherNotify },
        { provide: Router, useValue: otherRouter },
      ],
      TestBed.inject(EnvironmentInjector),
    );
    extraInjectors.push(otherInjector);

    const session2 = otherInjector.get(AuthSession);
    await settle(session2.ensureLoaded());
    expect(session2.status()).toBe('signed-in');

    await settle(session1.logout());
    await Promise.resolve();

    expect(navigate1).toHaveBeenCalledWith('/login', { replaceUrl: true });
    expect(session2.status()).toBe('signed-out');
    expect(session2.me()).toBeNull();
    expect(otherRouter.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
    expect(otherNotify.info).not.toHaveBeenCalled();

    // Ensure DestroyRef cleans up cleanly.
    expect(otherInjector.get(DestroyRef)).toBeTruthy();
  });

  it('leaves a pre-auth MFA challenge active in another tab when the old session signs out', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());

    const guest = createEnvironmentInjector([AuthSession, CurrentUser, MfaPending], TestBed.inject(EnvironmentInjector));
    extraInjectors.push(guest);
    const guestSession = guest.get(AuthSession);
    const guestMfa = guest.get(MfaPending);
    guestMfa.set(MFA_STEP, { origin: 'login' });

    await settle(session.logout());

    expect(guestSession.status()).toBe('signed-out');
    expect(guestMfa.current()?.step).toEqual(MFA_STEP);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('sessionEnded clears state, notifies once, and preserves only safe returnUrl', async () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const info = vi.spyOn(TestBed.inject(Notify), 'info').mockImplementation(() => undefined);
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());

    await session.sessionEnded('/crm/leads?page=2');
    await session.sessionEnded('https://evil.example/phish');

    expect(session.status()).toBe('signed-out');
    expect(info).toHaveBeenCalledTimes(1);
    expect(router.serializeUrl(navigate.mock.calls[0][0] as ReturnType<Router['createUrlTree']>)).toBe(
      '/login?returnUrl=%2Fcrm%2Fleads%3Fpage%3D2',
    );
    const lastTarget = navigate.mock.calls[1][0];
    expect(typeof lastTarget === 'string' ? lastTarget : router.serializeUrl(lastTarget)).toBe('/login');
  });

  it('safeReturnUrl rejects external, protocol-relative, backslash, and auth paths', () => {
    expect(safeReturnUrl('/crm/leads?tab=1')).toBe('/crm/leads?tab=1');
    expect(safeReturnUrl('//evil.com')).toBeNull();
    expect(safeReturnUrl('https://evil.com')).toBeNull();
    expect(safeReturnUrl('/\\evil')).toBeNull();
    expect(safeReturnUrl('/login')).toBeNull();
    expect(safeReturnUrl('/verify')).toBeNull();
    expect(safeReturnUrl('/reset-password')).toBeNull();
    expect(safeReturnUrl('/tenant/reset-password')).toBeNull();
    expect(safeReturnUrl('/tenant/accept-invite')).toBeNull();
  });
});

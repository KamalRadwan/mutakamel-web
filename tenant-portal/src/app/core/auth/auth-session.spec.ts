import { DestroyRef, EnvironmentInjector, Injectable, createEnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/api-errors';
import { Notify } from '../notify/notify';
import { TabLeader } from '../tabs/tab-leader';
import { AuthSession } from './auth-session';
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

  async function announceRenewal(): Promise<void> {
    const issuedAt = Date.now();
    const peer = new FakeBroadcastChannel('mutakamel-auth');
    peer.postMessage({ type: 'renewed', timing: { issuedAt, refreshAt: issuedAt + 108_000, expiresAt: issuedAt + 120_000 } });
    peer.close();
    await Promise.resolve();
  }

  it('ends the session when a peer renewal probes /me with a generic 401 and refresh returns 401', async () => {
    const session = TestBed.inject(AuthSession);
    const router = TestBed.inject(Router);
    const url = vi.spyOn(router, 'url', 'get').mockReturnValue('/crm/leads?page=2');
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const info = vi.spyOn(TestBed.inject(Notify), 'info');
    try {
      await settle(session.ensureLoaded());
      api.getMe.mockRejectedValueOnce(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'));
      api.refreshSession.mockRejectedValueOnce(new ApiError(401, 'INVALID_REFRESH_TOKEN'));
      await announceRenewal();

      expect(await settle(session.refresh())).toBe('ended');
      expect(api.refreshSession).toHaveBeenCalledOnce();
      expect(api.getMe).toHaveBeenCalledTimes(2);
      expect(session.status()).toBe('signed-out');
      expect(session.renewal()).toBe('ok');
      expect(info).toHaveBeenCalledExactlyOnceWith('session.ended.title', 'session.ended.text');
      expect(router.serializeUrl(navigate.mock.calls[0][0] as ReturnType<Router['createUrlTree']>))
        .toBe('/login?returnUrl=%2Fcrm%2Fleads%3Fpage%3D2');
    } finally {
      url.mockRestore();
    }
  });

  it('refreshes after a peer renewal probes /me with a generic 401 and reloads /me successfully', async () => {
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());
    api.getMe.mockRejectedValueOnce(new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED'));
    await announceRenewal();

    expect(await settle(session.refresh())).toBe('ok');
    expect(api.refreshSession).toHaveBeenCalledOnce();
    expect(api.getMe).toHaveBeenCalledTimes(3);
    expect(session.status()).toBe('signed-in');
    expect(session.renewal()).toBe('ok');
  });

  it('keeps retrying refresh after a peer /me generic 401 and refresh 503 instead of looping on /me', async () => {
    const session = TestBed.inject(AuthSession);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await settle(session.ensureLoaded());
    const me = session.me();
    const unauthorized = new ApiError(401, 'COMMON.GENERIC.UNAUTHORIZED');
    api.getMe.mockRejectedValueOnce(unauthorized).mockRejectedValueOnce(unauthorized);
    api.refreshSession.mockRejectedValueOnce(new ApiError(503, 'PLATFORM_MAINTENANCE'));
    await announceRenewal();

    await expect(settle(session.refresh())).rejects.toMatchObject({ status: 503 });
    expect(api.refreshSession).toHaveBeenCalledOnce();
    expect(api.getMe).toHaveBeenCalledTimes(2);
    expect(session.status()).toBe('signed-in');
    expect(session.me()).toBe(me);
    expect(session.renewal()).toBe('retrying');
    expect(navigate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.refreshSession).toHaveBeenCalledTimes(2);
    expect(api.getMe).toHaveBeenCalledTimes(4);
    expect(session.status()).toBe('signed-in');
    expect(session.renewal()).toBe('ok');
  });

  it('tries one refresh for a revoked request with CSRF proof and recovers successfully', async () => {
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());

    expect(await settle(session.recoverRequest(
      new ApiError(401, 'GW.AUTH.SESSION_REVOKED'), session.requestVersion(),
    ))).toBe(true);
    expect(api.hasCsrfCookie).toHaveBeenCalledOnce();
    expect(api.refreshSession).toHaveBeenCalledOnce();
    expect(session.status()).toBe('signed-in');
  });

  it('ends a revoked request session only after its single refresh returns 401', async () => {
    const session = TestBed.inject(AuthSession);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const info = vi.spyOn(TestBed.inject(Notify), 'info');
    await settle(session.ensureLoaded());
    api.refreshSession.mockRejectedValueOnce(new ApiError(401, 'INVALID_REFRESH_TOKEN'));

    expect(await settle(session.recoverRequest(
      new ApiError(401, 'GW.AUTH.SESSION_REVOKED'), session.requestVersion(),
    ))).toBe(false);
    expect(api.refreshSession).toHaveBeenCalledOnce();
    expect(session.status()).toBe('signed-out');
    expect(session.renewal()).toBe('ok');
    expect(info).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledOnce();
  });

  it('rejects a revoked request renewal 503 while keeping the session', async () => {
    const session = TestBed.inject(AuthSession);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await settle(session.ensureLoaded());
    const me = session.me();
    const error = new ApiError(503, 'PLATFORM_MAINTENANCE');
    api.refreshSession.mockRejectedValueOnce(error);

    await expect(settle(session.recoverRequest(
      new ApiError(401, 'GW.AUTH.SESSION_REVOKED'), session.requestVersion(),
    ))).rejects.toBe(error);
    expect(api.refreshSession).toHaveBeenCalledOnce();
    expect(session.status()).toBe('signed-in');
    expect(session.me()).toBe(me);
    expect(session.renewal()).toBe('retrying');
    expect(navigate).not.toHaveBeenCalled();
    expect(api.logout).not.toHaveBeenCalled();
  });

  it('ends a revoked request session without refreshing when CSRF proof is absent', async () => {
    const session = TestBed.inject(AuthSession);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const ended = vi.spyOn(session, 'sessionEnded');
    await settle(session.ensureLoaded());
    api.hasCsrfCookie.mockReturnValue(false);

    expect(await session.recoverRequest(
      new ApiError(401, 'GW.AUTH.SESSION_REVOKED'), session.requestVersion(),
    )).toBe(false);
    expect(ended).toHaveBeenCalledOnce();
    expect(api.refreshSession).not.toHaveBeenCalled();
    expect(session.status()).toBe('signed-out');
  });

  it.each(['focus', 'pageshow', 'visibilitychange'])('retries immediately on %s while renewal is retrying', async (event) => {
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());
    api.refreshSession.mockRejectedValueOnce(new ApiError(503, 'PLATFORM_MAINTENANCE'));
    await expect(session.refresh()).rejects.toMatchObject({ status: 503 });
    expect(session.renewal()).toBe('retrying');

    (event === 'visibilitychange' ? document : window).dispatchEvent(new Event(event));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(api.refreshSession).toHaveBeenCalledTimes(2);
    expect(session.renewal()).toBe('ok');
  });

  it('keeps the access refresh deadline on focus when renewal is not retrying', async () => {
    TestBed.overrideProvider(TabLeader, { useValue: { isLeader: signal(true) } });
    const session = TestBed.inject(AuthSession);
    const metadata = await settle(fakeRefreshSession());
    const issuedAt = Date.now();
    await settle(session.signedIn({ ...metadata, expiresIn: 120 }));

    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(issuedAt + 108_000 - Date.now() - 1);
    expect(api.refreshSession).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(api.refreshSession).toHaveBeenCalledOnce();
  });

  it('reloads /me immediately after a newer peer renewal while this tab is retrying', async () => {
    TestBed.overrideProvider(TabLeader, { useValue: { isLeader: signal(false) } });
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());
    api.refreshSession.mockRejectedValueOnce(new ApiError(503, 'PLATFORM_MAINTENANCE'));
    await expect(session.refresh()).rejects.toMatchObject({ status: 503 });
    expect(session.renewal()).toBe('retrying');
    api.getMe.mockResolvedValueOnce({ ...FAKE_TENANT_ME, firstName: 'Peer', lastName: 'Renewed' });

    await announceRenewal();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(api.getMe).toHaveBeenCalledTimes(2);
    expect(api.refreshSession).toHaveBeenCalledOnce();
    expect(session.me()?.firstName).toBe('Peer');
    expect(session.status()).toBe('signed-in');
    expect(session.renewal()).toBe('ok');
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

  it('propagates authenticated identity and workspace settings through bootstrap and profile reload', async () => {
    const profile: TenantMe = {
      ...FAKE_TENANT_ME,
      id: '019af27b-5e00-7000-8000-000000000001',
      email: 'noura@example.com',
      firstName: 'Noura',
      lastName: 'Saleh',
      workspace: { timezone: 'Pacific/Auckland', defaultLanguage: 'en' },
    };
    api.getMe.mockResolvedValueOnce(profile);
    const session = TestBed.inject(AuthSession);
    const current = TestBed.inject(CurrentUser);
    expect(await settle(session.ensureLoaded())).toBe('signed-in');
    expect(current.userId()).toBe(profile.id);
    expect(current.timeZone()).toBe('Pacific/Auckland');
    expect(session.me()?.workspace).toEqual(profile.workspace);

    api.getMe.mockResolvedValueOnce({ ...profile, workspace: { timezone: 'Asia/Riyadh', defaultLanguage: 'ar' } });
    await settle(session.reloadProfile(session.requestVersion()));
    expect(current.timeZone()).toBe('Asia/Riyadh');
    expect(session.me()?.workspace.defaultLanguage).toBe('ar');
    expect(api.refreshSession).not.toHaveBeenCalled();
    session.clearLocal();
    expect(session.me()).toBeNull();
    expect(current.userId()).toBe('');
    expect(current.timeZone()).toBe('');
  });

  it('fails bootstrap on malformed workspace data and allows a real profile retry', async () => {
    api.getMe.mockResolvedValueOnce({ ...FAKE_TENANT_ME, workspace: { timezone: 'Invalid/Zone', defaultLanguage: 'en' } });
    const session = TestBed.inject(AuthSession);
    const current = TestBed.inject(CurrentUser);
    expect(await settle(session.ensureLoaded())).toBe('failed');
    expect(session.me()).toBeNull();
    expect(current.userId()).toBe('');
    expect(current.timeZone()).toBe('');
    expect(api.refreshSession).not.toHaveBeenCalled();
    expect(await settle(session.ensureLoaded())).toBe('signed-in');
    expect(current.timeZone()).toBe(FAKE_TENANT_ME.workspace.timezone);
  });

  it('keeps verified identity and timezone while retrying a malformed /me after renewal', async () => {
    const session = TestBed.inject(AuthSession);
    const current = TestBed.inject(CurrentUser);
    await settle(session.ensureLoaded());
    const previous = session.me();
    const previousUser = current.user();
    api.getMe.mockResolvedValueOnce({ ...FAKE_TENANT_ME, workspace: { timezone: '', defaultLanguage: 'en' } });
    await expect(settle(session.refresh())).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    expect(session.status()).toBe('signed-in');
    expect(session.renewal()).toBe('retrying');
    expect(session.me()).toBe(previous);
    expect(current.user()).toBe(previousUser);
    const refreshCount = api.refreshSession.mock.calls.length;

    api.getMe.mockResolvedValueOnce({ ...FAKE_TENANT_ME, workspace: { timezone: 'Asia/Dubai', defaultLanguage: 'en' } });
    expect(await settle(session.refresh())).toBe('ok');
    expect(current.timeZone()).toBe('Asia/Dubai');
    expect(session.renewal()).toBe('ok');
    expect(api.refreshSession).toHaveBeenCalledTimes(refreshCount);
  });

  it('does not restore identity or timezone when an in-flight /me finishes after logout', async () => {
    let finish: ((me: TenantMe) => void) | undefined;
    api.getMe.mockReturnValueOnce(new Promise<TenantMe>((resolve) => { finish = resolve; }));
    const session = TestBed.inject(AuthSession);
    const current = TestBed.inject(CurrentUser);
    const loading = session.ensureLoaded();
    session.clearLocal();
    finish?.({ ...FAKE_TENANT_ME, workspace: { timezone: 'Asia/Dubai', defaultLanguage: 'en' } });
    expect(await settle(loading)).toBe('signed-out');
    expect(session.me()).toBeNull();
    expect(current.userId()).toBe('');
    expect(current.timeZone()).toBe('');
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

  it('keeps the signed-in session and MFA state while retrying a refresh 500', async () => {
    const session = TestBed.inject(AuthSession);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await settle(session.ensureLoaded());
    const me = session.me();
    const mfa = TestBed.inject(MfaPending);
    mfa.set(MFA_STEP, { origin: 'login' });

    setFakeSessionNext('SERVER_ERROR');
    await expect(settle(session.refresh())).rejects.toMatchObject({ status: 500 });
    expect(session.status()).toBe('signed-in');
    expect(session.me()).toBe(me);
    expect(session.renewal()).toBe('retrying');
    expect(TestBed.inject(CurrentUser).user().email).toBe(me?.email);
    expect(mfa.current()?.step).toEqual(MFA_STEP);
    expect(api.logout).not.toHaveBeenCalled();
    expect(localStorage.getItem(pendingLogout)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([503, 0])('keeps the session and retries /me after a successful refresh and /me %s', async status => {
    const session = TestBed.inject(AuthSession);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await settle(session.ensureLoaded());
    const me = session.me();
    const post = vi.spyOn(FakeBroadcastChannel.prototype, 'postMessage');
    const issuedAt = Date.now();
    api.getMe.mockRejectedValueOnce(new ApiError(status, status === 0 ? 'NETWORK_ERROR' : 'TENANT_INACTIVE'));

    const failure = new ApiError(401, 'COMMON.AUTH.INVALID_ACCESS_TOKEN');
    const version = session.requestVersion();
    const recovery = [session.recoverRequest(failure, version), session.recoverRequest(failure, version)];
    await expect(settle(Promise.all(recovery))).rejects.toMatchObject({ status });
    expect(session.status()).toBe('signed-in');
    expect(session.me()).toBe(me);
    expect(session.renewal()).toBe('retrying');
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
    expect(api.logout).not.toHaveBeenCalled();
    expect(localStorage.getItem(pendingLogout)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(session.renewal()).toBe('ok');
    expect(api.getMe).toHaveBeenCalledTimes(3);
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(issuedAt + 570_000 - Date.now() - 1);
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(api.refreshSession).toHaveBeenCalledTimes(2);
    post.mockRestore();
  });

  it.each([0, 503])('marks bootstrap failed after refresh %s and reloads the session online without cleanup', async status => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const session = TestBed.inject(AuthSession);
      api.getMe.mockRejectedValueOnce(new ApiError(401, 'COMMON.AUTH.MISSING_BEARER_TOKEN'));
      api.refreshSession.mockRejectedValueOnce(new ApiError(status, status === 0 ? 'NETWORK_ERROR' : 'TENANT_INACTIVE'));
      expect(await settle(session.ensureLoaded())).toBe('failed');
      expect(localStorage.getItem(pendingLogout)).toBeNull();
      expect(api.logout).not.toHaveBeenCalled();
      expect(api.getMe).toHaveBeenCalledTimes(1);
      expect(api.refreshSession).toHaveBeenCalledTimes(1);

      online.mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(2_000);
      expect(session.status()).toBe('signed-in');
      expect(session.renewal()).toBe('ok');
      expect(api.getMe).toHaveBeenCalledTimes(2);
      expect(api.logout).not.toHaveBeenCalled();
      expect(localStorage.getItem(pendingLogout)).toBeNull();
    } finally {
      online.mockRestore();
    }
  });

  it.each([
    [0, 'NETWORK_ERROR'], [408, 'REQUEST_TIMEOUT'], [429, 'GW.RATE.LIMIT_EXCEEDED'],
    [500, 'COMMON.GENERIC.INTERNAL_ERROR'], [502, 'GW.UPSTREAM.BAD_GATEWAY'],
    [503, 'GW.AUTH.SESSION_CHECK_UNAVAILABLE'], [503, 'PLATFORM_MAINTENANCE'],
    [403, 'TENANT_MAINTENANCE_ACTIVE'], [403, 'TENANT_MAINTENANCE_RELEASE_REQUIRED'],
    [403, 'UNKNOWN_CODE'],
  ])('keeps signed-in data without logout, storage, broadcast or navigation after refresh %s %s', async (status, code) => {
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());
    const me = session.me();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const post = vi.spyOn(FakeBroadcastChannel.prototype, 'postMessage');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const error = new ApiError(status, code);
    api.refreshSession.mockRejectedValueOnce(error);
    try {
      await expect(settle(session.refresh())).rejects.toBe(error);
      expect(session.status()).toBe('signed-in');
      expect(session.me()).toBe(me);
      expect(session.renewal()).toBe('retrying');
      expect(api.logout).not.toHaveBeenCalled();
      expect(localStorage.getItem(pendingLogout)).toBeNull();
      expect(write).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      write.mockRestore();
      post.mockRestore();
    }
  });

  it('retries a background refresh failure after 30 seconds and broadcasts the successful renewal', async () => {
    TestBed.overrideProvider(TabLeader, { useValue: { isLeader: signal(true) } });
    const session = TestBed.inject(AuthSession);
    const metadata = await settle(fakeRefreshSession());
    await settle(session.signedIn({ ...metadata, expiresIn: 120 }));
    const post = vi.spyOn(FakeBroadcastChannel.prototype, 'postMessage');
    api.refreshSession.mockRejectedValueOnce(new ApiError(503, 'TENANT_INACTIVE'));
    try {
      await vi.advanceTimersByTimeAsync(106_000);
      expect(api.refreshSession).toHaveBeenCalledTimes(1);
      expect(session.status()).toBe('signed-in');
      expect(session.renewal()).toBe('retrying');
      expect(post).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(29_999);
      expect(api.refreshSession).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(api.refreshSession).toHaveBeenCalledTimes(2);
      expect(session.renewal()).toBe('ok');
      expect(post).toHaveBeenCalledExactlyOnceWith({
        type: 'renewed', timing: expect.objectContaining({ expiresAt: expect.any(Number) }),
      });
      expect(api.logout).not.toHaveBeenCalled();
    } finally {
      post.mockRestore();
    }
  });

  it('retries a request-triggered 429 in a non-leader tab after 90 seconds instead of 30', async () => {
    TestBed.overrideProvider(TabLeader, { useValue: { isLeader: signal(false) } });
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());
    api.refreshSession.mockRejectedValueOnce(new ApiError(429, 'GW.RATE.LIMIT_EXCEEDED', { retryAfterSeconds: ['90'] }));
    await expect(session.recoverRequest(new ApiError(401, 'COMMON.AUTH.TOKEN_EXPIRED'), session.requestVersion()))
      .rejects.toMatchObject({ status: 429 });
    expect(session.renewal()).toBe('retrying');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(api.refreshSession).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(api.refreshSession).toHaveBeenCalledTimes(2);
    expect(session.renewal()).toBe('ok');
  });

  it('retries renewal immediately on online and resets renewal after a manual retry, clearLocal and signedIn', async () => {
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());
    const fail = async () => {
      api.refreshSession.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
      await expect(session.refresh()).rejects.toMatchObject({ status: 0 });
      expect(session.renewal()).toBe('retrying');
    };
    await fail();
    window.dispatchEvent(new Event('online'));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(session.renewal()).toBe('ok');
    expect(api.refreshSession).toHaveBeenCalledTimes(2);
    await fail();
    expect(await settle(session.refresh())).toBe('ok');
    expect(session.renewal()).toBe('ok');
    await fail();
    session.clearLocal();
    expect(session.renewal()).toBe('ok');
    const metadata = await settle(fakeRefreshSession());
    await settle(session.signedIn(metadata));
    await fail();
    expect(await settle(session.signedIn(metadata))).toBe('signed-in');
    expect(session.renewal()).toBe('ok');
  });

  it.each([
    [401, 'AUTH_SESSION_IDLE_EXPIRED', false], [403, 'SESSION_IDENTITY_INACTIVE', false],
    [401, 'COMMON.GENERIC.UNAUTHORIZED', true], [401, 'GW.AUTH.SESSION_REVOKED', true],
    [401, 'UNKNOWN_CODE', true], [403, 'AUTH_CSRF_INVALID', false],
    [403, 'GW.AUTH.CSRF_INVALID', false], [403, 'GW.AUTH.FORBIDDEN', false],
    [403, 'SUBSCRIPTION_PAST_DUE', true],
  ])('ends refresh %s %s with a toast, safe returnUrl and cleanup marker=%s', async (status, code, marker) => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const session = TestBed.inject(AuthSession);
      const router = TestBed.inject(Router);
      const url = vi.spyOn(router, 'url', 'get').mockReturnValue('/crm/leads?page=2');
      const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      const info = vi.spyOn(TestBed.inject(Notify), 'info');
      await settle(session.ensureLoaded());
      api.refreshSession.mockRejectedValueOnce(new ApiError(status, code));
      expect(await session.refresh()).toBe('ended');
      expect(session.status()).toBe('signed-out');
      expect(session.me()).toBeNull();
      expect(session.renewal()).toBe('ok');
      expect(info).toHaveBeenCalledExactlyOnceWith('session.ended.title', 'session.ended.text');
      expect(router.serializeUrl(navigate.mock.calls[0][0] as ReturnType<Router['createUrlTree']>))
        .toBe('/login?returnUrl=%2Fcrm%2Fleads%3Fpage%3D2');
      expect(localStorage.getItem(pendingLogout)).toBe(marker ? '1' : null);
      expect(api.logout).not.toHaveBeenCalled();
      url.mockRestore();
    } finally {
      online.mockRestore();
    }
  });

  it('writes no storage during transient retries and only the existing logout key when refresh ends', async () => {
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    try {
      for (const error of [new ApiError(0, 'NETWORK_ERROR'), new ApiError(503, 'TENANT_INACTIVE')]) {
        api.refreshSession.mockRejectedValueOnce(error);
        await expect(session.refresh()).rejects.toBe(error);
      }
      expect(await settle(session.refresh())).toBe('ok');
      expect(write).not.toHaveBeenCalled();
      api.refreshSession.mockRejectedValueOnce(new ApiError(401, 'UNKNOWN_CODE'));
      expect(await session.refresh()).toBe('ended');
      expect(write).toHaveBeenCalledExactlyOnceWith(pendingLogout, '1');
    } finally {
      write.mockRestore();
      online.mockRestore();
    }
  });

  it('keeps a second tab signed in after a transient failure and serializes both renewals with the shared lock', async () => {
    let held = false;
    let lockTail = Promise.resolve();
    const request = vi.fn((_name: string, work: () => Promise<unknown>) => {
      const task = lockTail.then(async () => {
        expect(held).toBe(false);
        held = true;
        try { return await work(); } finally { held = false; }
      });
      lockTail = task.then(() => undefined, () => undefined);
      return task;
    });
    Object.defineProperty(navigator, 'locks', { value: { request }, configurable: true });
    const session = TestBed.inject(AuthSession);
    const other = createEnvironmentInjector([AuthSession, CurrentUser], TestBed.inject(EnvironmentInjector));
    extraInjectors.push(other);
    const peer = other.get(AuthSession);
    await settle(Promise.all([session.ensureLoaded(), peer.ensureLoaded()]));
    const me = peer.me();
    api.refreshSession.mockRejectedValueOnce(new ApiError(503, 'TENANT_INACTIVE'));
    const outcomes = await settle(Promise.allSettled([session.refresh(), peer.refresh()]));
    expect(outcomes.map(outcome => outcome.status)).toEqual(['rejected', 'fulfilled']);
    expect(request).toHaveBeenCalledTimes(3);
    expect(api.refreshSession).toHaveBeenCalledTimes(2);
    expect(api.getMe).toHaveBeenCalledTimes(4);
    expect(request.mock.calls.every(([name]) => name === 'mutakamel-tenant-refresh')).toBe(true);
    expect(session.status()).toBe('signed-in');
    expect(session.renewal()).toBe('ok');
    expect(peer.status()).toBe('signed-in');
    expect(peer.me()?.id).toBe(me?.id);
    expect(api.logout).not.toHaveBeenCalled();
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

  it('signedOutByServer clears the session and MFA, broadcasts once, and shows the MFA notice without a returnUrl', async () => {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/crm/leads?page=2');
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const info = vi.spyOn(TestBed.inject(Notify), 'info').mockImplementation(() => undefined);
    const translate = vi.spyOn(TestBed.inject(TranslocoService), 'translate')
      .mockReturnValueOnce('Security settings changed')
      .mockReturnValueOnce('Sign in again to continue.');
    const session = TestBed.inject(AuthSession);
    expect(await settle(session.ensureLoaded())).toBe('signed-in');
    const mfa = TestBed.inject(MfaPending);
    mfa.set(MFA_STEP, { origin: 'login' });
    expect(mfa.current()).not.toBeNull();
    const broadcast = vi.spyOn(FakeBroadcastChannel.prototype, 'postMessage');

    await session.signedOutByServer('security.mfaChanged');

    expect(session.status()).toBe('signed-out');
    expect(session.me()).toBeNull();
    expect(mfa.current()).toBeNull();
    expect(broadcast).toHaveBeenCalledExactlyOnceWith({ type: 'signed-out', at: expect.any(Number) });
    expect(translate).toHaveBeenNthCalledWith(1, 'security.mfaChanged.title');
    expect(translate).toHaveBeenNthCalledWith(2, 'security.mfaChanged.text');
    expect(info).toHaveBeenCalledExactlyOnceWith('Security settings changed', 'Sign in again to continue.');
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/login', { replaceUrl: true });
  });

  it('signedOutByServer makes no logout call and leaves the pending-logout marker unset', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Notify), 'info').mockImplementation(() => undefined);
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());
    expect(localStorage.getItem(pendingLogout)).toBeNull();
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    await session.signedOutByServer('security.mfaChanged');

    expect(api.logout).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalledWith(pendingLogout, expect.anything());
    expect(localStorage.getItem(pendingLogout)).toBeNull();
  });

  it('signedOutByServer also makes a signed-in peer tab leave through the existing broadcast handler', async () => {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(TestBed.inject(Notify), 'info').mockImplementation(() => undefined);
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());
    const otherRouter = { url: '/crm/leads', navigateByUrl: vi.fn().mockResolvedValue(true) };
    const other = createEnvironmentInjector(
      [AuthSession, CurrentUser, { provide: Router, useValue: otherRouter }],
      TestBed.inject(EnvironmentInjector),
    );
    extraInjectors.push(other);
    const peer = other.get(AuthSession);
    expect(await settle(peer.ensureLoaded())).toBe('signed-in');

    await session.signedOutByServer('security.mfaChanged');
    await Promise.resolve();

    expect(peer.status()).toBe('signed-out');
    expect(otherRouter.navigateByUrl).toHaveBeenCalledExactlyOnceWith('/login', { replaceUrl: true });
  });

  it('signedOutByServer uses the all-sessions-ended notice keys', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const info = vi.spyOn(TestBed.inject(Notify), 'info').mockImplementation(() => undefined);
    const translate = vi.spyOn(TestBed.inject(TranslocoService), 'translate')
      .mockReturnValueOnce('All sessions ended')
      .mockReturnValueOnce('Sign in again to continue.');
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());

    await session.signedOutByServer('security.allSessionsEnded');

    expect(translate).toHaveBeenNthCalledWith(1, 'security.allSessionsEnded.title');
    expect(translate).toHaveBeenNthCalledWith(2, 'security.allSessionsEnded.text');
    expect(info).toHaveBeenCalledExactlyOnceWith('All sessions ended', 'Sign in again to continue.');
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

});

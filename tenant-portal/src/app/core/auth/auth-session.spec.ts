import { DestroyRef, EnvironmentInjector, Injectable, createEnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Notify } from '../notify/notify';
import { AuthSession, safeReturnUrl } from './auth-session';
import { fakeSessionCallCounts, resetFakeSession, setFakeLogoutError, setFakeSessionNext } from './auth-session.fake';
import { CurrentUser } from './current-user';

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
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

describe('AuthSession', () => {
  let originalBroadcastChannel: typeof BroadcastChannel | undefined;
  let originalLocksDescriptor: PropertyDescriptor | undefined;
  let extraInjectors: EnvironmentInjector[];

  beforeEach(() => {
    vi.useFakeTimers();
    extraInjectors = [];
    resetFakeSession();

    originalBroadcastChannel = globalThis.BroadcastChannel;
    globalThis.BroadcastChannel = FakeBroadcastChannel as unknown as typeof BroadcastChannel;
    originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');

    TestBed.configureTestingModule({
      providers: [
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

  it('bootstraps /me, populates CurrentUser, and caches subsequent calls', async () => {
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
    expect(fakeSessionCallCounts().me).toBe(1);
  });

  it('refreshes once on 401 COMMON.AUTH.TOKEN_EXPIRED and succeeds', async () => {
    setFakeSessionNext('TOKEN_EXPIRED');
    const session = TestBed.inject(AuthSession);

    expect(await settle(session.ensureLoaded())).toBe('signed-in');
    expect(session.status()).toBe('signed-in');
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

    expect(await settle(session.ensureLoaded())).toBe('failed');
    expect(session.status()).toBe('failed');

    expect(await settle(session.ensureLoaded())).toBe('signed-in');
    expect(session.status()).toBe('signed-in');
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

  it('rethrows transient 500 during refresh() without ending the signed-in session', async () => {
    const session = TestBed.inject(AuthSession);
    await settle(session.ensureLoaded());

    setFakeSessionNext('SERVER_ERROR');
    await expect(settle(session.refresh())).rejects.toMatchObject({ status: 500 });
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
    expect(router.serializeUrl(navigate.mock.calls[1][0] as ReturnType<Router['createUrlTree']>)).toBe('/login');
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

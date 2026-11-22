import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type ActivatedRouteSnapshot, Router, type RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app.routes';
import { ApiError } from '../api/api-errors';
import { Notify } from '../notify/notify';
import { AuthSession } from './auth-session';
import { AuthSessionApi } from './auth-session.api';
import { fakeGetMe, fakeRefreshSession, fakeSessionCallCounts, resetFakeSession, setFakeSessionNext } from './auth-session.fake';
import { authGuard, guestGuard } from './auth.guards';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(500);
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

describe('authGuard & guestGuard', () => {
  const getMe = vi.fn(fakeGetMe);
  const refresh = vi.fn(fakeRefreshSession);
  const hasCsrfCookie = vi.fn(() => true);

  beforeEach(() => {
    vi.useFakeTimers();
    resetFakeSession();
    getMe.mockReset();
    refresh.mockReset();
    hasCsrfCookie.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSessionApi, useValue: { getMe, refreshSession: refresh, hasCsrfCookie } },
        provideRouter([]),
        provideTransloco({
          config: { availableLangs: ['ar', 'en'], defaultLang: 'en', missingHandler: { logMissingKey: false } },
          loader: EmptyLoader,
        }),
      ],
    });
  });

  afterEach(() => {
    resetFakeSession();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  function runAuthGuard(url: string) {
    return settle(
      Promise.resolve(
        TestBed.runInInjectionContext(() =>
          authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
        ),
      ),
    );
  }

  function runGuestGuard(queryParams: Record<string, string> = {}) {
    const result = TestBed.runInInjectionContext(() =>
      guestGuard(
        { queryParams } as unknown as ActivatedRouteSnapshot,
        { url: '/login' } as RouterStateSnapshot,
      ),
    );
    return settle(Promise.resolve(result));
  }

  it('allows signed-in users and redirects signed-out users to /login?returnUrl=…', async () => {
    expect(await runAuthGuard('/crm/leads')).toBe(true);

    setFakeSessionNext('INACTIVE');
    TestBed.inject(AuthSession).clearLocal();
    const router = TestBed.inject(Router);
    const result = await runAuthGuard('/crm/leads');
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fcrm%2Fleads');
  });

  it('allows entering layout when session bootstrap fails so the retry state renders', async () => {
    setFakeSessionNext('SERVER_ERROR');
    expect(await runAuthGuard('/workspace')).toBe(true);
    expect(TestBed.inject(AuthSession).status()).toBe('failed');
  });

  it.each(['/workspace/home', '/crm/leads', '/trade/foundation/items'])(
    'redirects a direct anonymous visit to %s through the application router',
    async (destination) => {
      const router = TestBed.inject(Router);
      router.resetConfig(routes);
      hasCsrfCookie.mockReturnValue(false);
      getMe.mockRejectedValueOnce(new ApiError(401, 'GW.AUTH.MISSING_SESSION'));

      await router.navigateByUrl(destination);

      const redirected = router.parseUrl(router.url);
      expect(redirected.root.children['primary'].segments.map(segment => segment.path)).toEqual(['login']);
      expect(redirected.queryParams['returnUrl']).toBe(destination);
      expect(getMe).toHaveBeenCalledTimes(1);
      expect(refresh).not.toHaveBeenCalled();
    },
  );

  it.each([
    'GW.AUTH.MISSING_SESSION',
    'COMMON.AUTH.MISSING_BEARER_TOKEN',
    'COMMON.AUTH.INVALID_ACCESS_TOKEN',
  ])('refreshes once on direct navigation after %s', async code => {
    getMe.mockRejectedValueOnce(new ApiError(401, code));
    expect(await runAuthGuard('/crm/leads')).toBe(true);
    expect(TestBed.inject(AuthSession).status()).toBe('signed-in');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(getMe).toHaveBeenCalledTimes(2);
  });

  it('uses the protected destination as returnUrl when terminal refresh fails on direct navigation', async () => {
    getMe.mockRejectedValueOnce(new ApiError(401, 'COMMON.AUTH.INVALID_ACCESS_TOKEN'));
    refresh.mockRejectedValueOnce(new ApiError(401, 'INVALID_REFRESH_TOKEN'));
    const result = await runAuthGuard('/crm/leads?page=2');

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login?returnUrl=%2Fcrm%2Fleads%3Fpage%3D2');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it('guestGuard makes no network call for an anonymous visit without a session cookie hint', async () => {
    hasCsrfCookie.mockReturnValue(false);
    expect(await runGuestGuard()).toBe(true);
    expect(fakeSessionCallCounts()).toEqual({ me: 0, refresh: 0, logout: 0 });
  });

  it('redirects a signed-in browser opening /login before Angular has loaded its session', async () => {
    const session = TestBed.inject(AuthSession);
    const router = TestBed.inject(Router);
    expect(session.status()).toBe('unknown');

    const result = await runGuestGuard();
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/workspace/home');
    expect(session.status()).toBe('signed-in');
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it.each(['/workspace/home', '/crm/leads?view=cards'])(
    'refreshes expired guest access and redirects to %s', async destination => {
    const expired = new ApiError(401, 'COMMON.AUTH.TOKEN_EXPIRED');
    getMe.mockRejectedValueOnce(expired);

    const result = await runGuestGuard(destination === '/workspace/home' ? {} : { returnUrl: destination });
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(destination);
    expect(getMe).toHaveBeenCalledTimes(2);
    expect(TestBed.inject(AuthSession).status()).toBe('signed-in');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([0, 503])('shows the login page when guest refresh fails with %s', async status => {
    getMe.mockRejectedValueOnce(new ApiError(401, 'COMMON.AUTH.TOKEN_EXPIRED'));
    refresh.mockRejectedValueOnce(new ApiError(status, 'UNAVAILABLE'));

    expect(await runGuestGuard()).toBe(true);
    expect(TestBed.inject(AuthSession).status()).toBe('unknown');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(getMe).toHaveBeenCalledTimes(1);
  });

  it('shows the login page without a toast or navigation when guest refresh ends the session', async () => {
    getMe.mockRejectedValueOnce(new ApiError(401, 'COMMON.AUTH.TOKEN_EXPIRED'));
    refresh.mockRejectedValueOnce(new ApiError(401, 'INVALID_REFRESH_TOKEN'));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const info = vi.spyOn(TestBed.inject(Notify), 'info');

    expect(await runGuestGuard()).toBe(true);
    expect(TestBed.inject(AuthSession).status()).toBe('signed-out');
    expect(navigate).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it('allows the login page to handle tenant provisioning when the session probe is unavailable', async () => {
    getMe.mockRejectedValueOnce(new ApiError(503, 'TENANT_INACTIVE'));
    expect(await runGuestGuard()).toBe(true);
    expect(getMe).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(TestBed.inject(AuthSession).status()).toBe('unknown');
  });

  it('lets protected bootstrap continue when it joins a cancelled login probe', async () => {
    const session = TestBed.inject(AuthSession);
    const expired = new ApiError(401, 'COMMON.AUTH.TOKEN_EXPIRED');
    getMe.mockRejectedValueOnce(expired).mockRejectedValueOnce(expired);

    refresh.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR'));
    const guest = session.ensureLoaded('guest');
    const protectedLoad = session.ensureLoaded();

    expect(await settle(Promise.all([guest, protectedLoad]))).toEqual(['unknown', 'signed-in']);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('guestGuard redirects signed-in users to a safe returnUrl and rejects unsafe ones', async () => {
    const session = TestBed.inject(AuthSession);
    const router = TestBed.inject(Router);
    await settle(session.ensureLoaded());

    const safe = await runGuestGuard({ returnUrl: '/crm/leads?view=cards' });
    expect(safe).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(safe as UrlTree)).toBe('/crm/leads?view=cards');

    for (const bad of ['//evil.com', 'https://evil.com/steal', '/login', '/verify', '/tenant/accept-invite']) {
      const redirected = await runGuestGuard({ returnUrl: bad });
      expect(redirected, bad).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(redirected as UrlTree), bad).toBe('/workspace/home');
    }
    expect(getMe).toHaveBeenCalledTimes(1);
  });
});

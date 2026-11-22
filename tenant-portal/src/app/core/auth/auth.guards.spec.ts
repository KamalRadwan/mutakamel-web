import { Injectable } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type ActivatedRouteSnapshot, Router, type RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from './auth-session';
import { fakeSessionCallCounts, resetFakeSession, setFakeSessionNext } from './auth-session.fake';
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
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

describe('authGuard & guestGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetFakeSession();
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
    return TestBed.runInInjectionContext(() =>
      guestGuard(
        { queryParams } as unknown as ActivatedRouteSnapshot,
        { url: '/login' } as RouterStateSnapshot,
      ),
    );
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

  it('guestGuard makes no network call when not signed in', () => {
    expect(runGuestGuard()).toBe(true);
    expect(fakeSessionCallCounts()).toEqual({ me: 0, refresh: 0, logout: 0 });
  });

  it('guestGuard redirects signed-in users to a safe returnUrl and rejects unsafe ones', async () => {
    const session = TestBed.inject(AuthSession);
    const router = TestBed.inject(Router);
    await settle(session.ensureLoaded());

    const safe = runGuestGuard({ returnUrl: '/crm/leads?view=cards' });
    expect(safe).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(safe as UrlTree)).toBe('/crm/leads?view=cards');

    for (const bad of ['//evil.com', 'https://evil.com/steal', '/login', '/verify', '/tenant/accept-invite']) {
      const redirected = runGuestGuard({ returnUrl: bad });
      expect(redirected, bad).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(redirected as UrlTree), bad).toBe('/');
    }
  });
});

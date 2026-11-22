import { TestBed } from '@angular/core/testing';
import { type ActivatedRouteSnapshot, Router, type RouterStateSnapshot, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { guestGuard } from '../../core/auth/auth.guards';
import { AuthSession } from '../../core/auth/auth-session';
import { authRoutes } from './auth.routes';

afterEach(() => TestBed.resetTestingModule());

describe('auth routes', () => {
  it.each(['login', 'verify'])('protects %s with guestGuard', (path) => {
    expect(authRoutes.find((route) => route.path === path)?.canActivate).toEqual([guestGuard]);
  });

  it.each(['reset-password', 'tenant/reset-password', 'tenant/accept-invite'])(
    'keeps %s reachable while signed in',
    (path) => {
      const route = authRoutes.find((entry) => entry.path === path);
      expect(route).toBeDefined();
      expect(route?.canActivate).toBeUndefined();
    },
  );

  it('redirects a signed-in visitor on /verify to workspace home', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthSession, useValue: { ensureLoaded: vi.fn().mockResolvedValue('signed-in') } },
      ],
    });
    const router = TestBed.inject(Router);
    const result = await TestBed.runInInjectionContext(() => guestGuard(
      { queryParams: {} } as ActivatedRouteSnapshot,
      { url: '/verify' } as RouterStateSnapshot,
    ));

    expect(result).toEqual(router.parseUrl('/workspace/home'));
  });
});

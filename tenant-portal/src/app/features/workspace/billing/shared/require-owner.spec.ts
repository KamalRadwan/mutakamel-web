import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type ActivatedRouteSnapshot, RedirectCommand, Router, type RouterStateSnapshot, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../../../../core/auth/auth-session';
import { billingRoutes } from '../billing.routes';
import { requireOwner } from './require-owner';

describe('requireOwner', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('require owner guard', async () => {
    const me = signal<{ isTenantOwner: boolean } | null>({ isTenantOwner: true });
    const ensureLoaded = vi.fn().mockResolvedValue('signed-in');
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthSession, useValue: { me, ensureLoaded } }] });
    const run = () => TestBed.runInInjectionContext(() => requireOwner({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    expect(await run()).toBe(true);
    expect(ensureLoaded).toHaveBeenCalledOnce();
    me.set({ isTenantOwner: false });
    const denied = await run();
    expect(denied).toBeInstanceOf(RedirectCommand);
    if (!(denied instanceof RedirectCommand)) throw new Error('Expected a redirect');
    expect(TestBed.inject(Router).serializeUrl(denied.redirectTo)).toBe('/forbidden');
    expect(denied.navigationBehaviorOptions?.skipLocationChange).toBe(true);
    me.set(null);
    expect(await run()).toBeInstanceOf(RedirectCommand);
    for (const status of ['signed-out', 'failed', 'unknown', 'loading']) {
      ensureLoaded.mockResolvedValue(status);
      expect(await run()).toBe(true);
    }
    expect(billingRoutes[0].canActivate).toContain(requireOwner);
  });
});

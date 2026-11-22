import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  Router,
  type RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthSession } from '../auth/auth-session';
import type { SessionStatus, TenantMe } from '../auth/auth-session.model';
import { requireApp } from './app-entitlement.guard';

describe('requireApp', () => {
  let status: SessionStatus;
  let me: Pick<TenantMe, 'seats'> | null;
  const session = {
    ensureLoaded: vi.fn(async (): Promise<SessionStatus> => status),
    status: () => status,
    me: vi.fn(() => me),
    hasPermission: vi.fn(),
  };

  beforeEach(() => {
    status = 'signed-in';
    me = { seats: [{ moduleKey: 'crm', accessState: 'ACTIVE' }] };
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthSession, useValue: session }, provideRouter([])],
    });
  });

  function runGuard(appId = 'crm') {
    return TestBed.runInInjectionContext(() =>
      requireApp(appId)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  function expectWorkspace(result: unknown) {
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/workspace');
  }

  it('allows an ACTIVE seat', async () => {
    expect(await runGuard()).toBe(true);
  });

  it('allows an OVER_CAPACITY seat', async () => {
    me = { seats: [{ moduleKey: 'crm', accessState: 'OVER_CAPACITY' }] };
    expect(await runGuard()).toBe(true);
  });

  it('redirects to workspace when only another module has a seat', async () => {
    me = { seats: [{ moduleKey: 'trade', accessState: 'ACTIVE' }] };
    expectWorkspace(await runGuard());
  });

  it('allows an owner with ACTIVE seats for every subscribed module', async () => {
    me = {
      seats: [
        { moduleKey: 'crm', accessState: 'ACTIVE' },
        { moduleKey: 'trade', accessState: 'ACTIVE' },
      ],
    };
    expect(await runGuard('crm')).toBe(true);
    expect(await runGuard('trade')).toBe(true);
  });

  it.each(['failed', 'unknown', 'loading', 'signed-out'] as const)(
    'leaves %s handling to the parent without reading seats',
    async (sessionStatus) => {
      status = sessionStatus;
      expect(await runGuard()).toBe(true);
      expect(session.me).not.toHaveBeenCalled();
    },
  );

  it('redirects a signed-in session with null me to workspace defensively', async () => {
    me = null;
    expectWorkspace(await runGuard());
  });

  it('uses the loaded session without making an HTTP request', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    expect(await runGuard()).toBe(true);
    expect(session.ensureLoaded).toHaveBeenCalledOnce();
    expect(session.me).toHaveBeenCalledOnce();
    TestBed.inject(HttpTestingController).verify();
  });
});

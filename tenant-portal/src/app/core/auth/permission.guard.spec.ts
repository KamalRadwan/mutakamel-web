import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  RedirectCommand,
  Router,
  type RouterStateSnapshot,
  provideRouter,
  withComponentInputBinding,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import en from '../../../../public/i18n/en.json';
import { RouteError } from '../../shared/ui/route-error/route-error';
import { AuthSession } from './auth-session';
import type { SessionStatus } from './auth-session.model';
import { requirePermission } from './permission.guard';

describe('requirePermission', () => {
  let status: SessionStatus;
  let permissions: string[];
  const session = {
    ensureLoaded: vi.fn(async (): Promise<SessionStatus> => status),
    status: () => status,
    me: () => ({ permissions }),
    hasPermission: vi.fn((key: string) => permissions.includes(key)),
  };

  beforeEach(() => {
    status = 'signed-in';
    permissions = ['crm.customer_profiles.read.all'];
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: session },
        provideRouter([], withComponentInputBinding()),
        provideLocationMocks(),
      ],
    });
  });

  function runGuard(guard: CanActivateFn) {
    return TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, { url: '/crm/customers' } as RouterStateSnapshot),
    );
  }

  function expectForbidden(result: unknown) {
    expect(result).toBeInstanceOf(RedirectCommand);
    const redirect = result as RedirectCommand;
    expect(TestBed.inject(Router).serializeUrl(redirect.redirectTo)).toBe('/forbidden');
    expect(redirect.navigationBehaviorOptions?.skipLocationChange).toBe(true);
  }

  it('allows an owner with only suffixed CRM permissions through a scoped guard', async () => {
    permissions = ['crm.customer_profiles.read.all', 'crm.customer_profiles.status.manage.all', 'crm.leads.read.all'];
    expect(await runGuard(requirePermission('crm.customer_profiles.read', { scoped: true }))).toBe(true);
  });

  it.each(['team', 'own'])('allows a sales rep with only the %s scope', async (scope) => {
    permissions = [`crm.customer_profiles.read.${scope}`];
    expect(await runGuard(requirePermission('crm.customer_profiles.read', { scoped: true }))).toBe(true);
  });

  it('denies an unrelated scoped permission with the same prefix', async () => {
    permissions = ['crm.customer_profiles.status.manage.all'];
    expectForbidden(await runGuard(requirePermission('crm.customer_profiles.read', { scoped: true })));
  });

  it('denies a scoped key when none of its variants is held', async () => {
    permissions = [];
    expectForbidden(await runGuard(requirePermission('crm.customer_profiles.read', { scoped: true })));
  });

  it('does not expand scopes unless scoped is enabled', async () => {
    expectForbidden(await runGuard(requirePermission('crm.customer_profiles.read')));
  });

  it('combines any with scoped when one key is held as own', async () => {
    permissions = ['crm.customer_profiles.read.own'];
    expect(await runGuard(requirePermission(
      ['crm.customer_profiles.read', 'crm.customer_profiles.status.manage'],
      { scoped: true, any: true },
    ))).toBe(true);
  });

  it('requires every scoped key unless any is enabled', async () => {
    permissions = ['crm.customer_profiles.read.team'];
    const guard = requirePermission(
      ['crm.customer_profiles.read', 'crm.customer_profiles.status.manage'],
      { scoped: true },
    );
    expectForbidden(await runGuard(guard));
    permissions.push('crm.customer_profiles.status.manage.all');
    expect(await runGuard(guard)).toBe(true);
  });

  it('allows one present exact key', async () => {
    expect(await runGuard(requirePermission('crm.customer_profiles.read.all'))).toBe(true);
    expect(session.hasPermission).toHaveBeenCalledWith('crm.customer_profiles.read.all');
    expect(session.ensureLoaded).toHaveBeenCalledOnce();
  });

  it('redirects one missing key to forbidden without changing the address bar', async () => {
    permissions = [];
    expectForbidden(await runGuard(requirePermission('crm.customer_profiles.read.all')));
  });

  it('denies two required keys when one is missing', async () => {
    expectForbidden(
      await runGuard(
        requirePermission(['crm.customer_profiles.read.all', 'crm.customer_profiles.write.all']),
      ),
    );
  });

  it('allows two required keys when both are present', async () => {
    permissions.push('crm.customer_profiles.write.all');
    expect(
      await runGuard(
        requirePermission(['crm.customer_profiles.read.all', 'crm.customer_profiles.write.all']),
      ),
    ).toBe(true);
  });

  it('allows any of two keys when one is present', async () => {
    expect(
      await runGuard(
        requirePermission(['crm.customer_profiles.write.all', 'crm.customer_profiles.read.all'], {
          any: true,
        }),
      ),
    ).toBe(true);
  });

  it('denies any of two keys when neither is present', async () => {
    permissions = [];
    expectForbidden(
      await runGuard(
        requirePermission(['crm.customer_profiles.read.all', 'crm.customer_profiles.write.all'], {
          any: true,
        }),
      ),
    );
  });

  it.each(['failed', 'unknown', 'loading', 'signed-out'] as const)(
    'leaves %s handling to the parent without checking permissions',
    async (sessionStatus) => {
      status = sessionStatus;
      expect(await runGuard(requirePermission('crm.customer_profiles.read.all'))).toBe(true);
      expect(session.hasPermission).not.toHaveBeenCalled();
    },
  );

  it('renders the forbidden route while preserving the denied child URL on direct navigation', async () => {
    permissions = [];
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
    });
    TestBed.inject(Router).resetConfig([
      {
        path: 'crm',
        children: [
          {
            path: 'customers',
            canActivate: [requirePermission('crm.customer_profiles.read', { scoped: true })],
            component: RouteError,
            data: { kind: 'notFound' },
          },
        ],
      },
      { path: 'forbidden', component: RouteError, data: { kind: 'forbidden' } },
    ]);
    const deniedUrl = '/crm/customers?page=2';
    const location = TestBed.inject(Location);
    // A direct visit already has the denied URL in the browser before guards run.
    location.go(deniedUrl);
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(deniedUrl, RouteError);

    expect(page.kind()).toBe('forbidden');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe(
      en.errors.forbidden.title,
    );
    expect(location.path()).toBe(deniedUrl);
  });
});

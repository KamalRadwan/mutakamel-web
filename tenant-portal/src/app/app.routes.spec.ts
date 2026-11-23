import { Component, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Mock } from 'vitest';
import { AuthSession } from './core/auth/auth-session';
import type { SessionStatus } from './core/auth/auth-session.model';
import { authGuard } from './core/auth/auth.guards';
import { routes } from './app.routes';

@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
class TestLayout {}

@Component({ template: '' })
class TestPage {}

@Component({ template: 'not found' })
class TestNotFound {}

describe('app routes', () => {
  const layout = routes[1];
  const redirect = layout.children!.find((route) => route.path === 'core/activities')!;
  const activityId = '0193a7f0-1234-7000-8000-000000000001';
  let status: WritableSignal<SessionStatus>;
  let targetGuard: Mock<() => boolean>;
  let ensureLoaded: Mock<() => Promise<SessionStatus>>;
  let router: Router;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    status = signal<SessionStatus>('signed-in');
    ensureLoaded = vi.fn(async () => status());
    targetGuard = vi.fn(() => true);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: { status, ensureLoaded } },
        provideRouter([
          { path: 'login', component: TestPage },
          {
            ...layout,
            loadComponent: undefined,
            component: TestLayout,
            children: [
              redirect,
              { path: 'workspace/operations/activities', component: TestPage, canActivate: [targetGuard] },
              { path: '**', component: TestNotFound },
            ],
          },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  it('core activities redirects and keeps activityId', async () => {
    await harness.navigateByUrl(`/core/activities?activityId=${activityId}`);

    expect(router.url).toBe(`/workspace/operations/activities?activityId=${activityId}`);
    expect(targetGuard).toHaveBeenCalledOnce();
    expect(ensureLoaded.mock.invocationCallOrder[0]).toBeLessThan(targetGuard.mock.invocationCallOrder[0]);

    await harness.navigateByUrl(`/core/activities?activityId=${activityId}&source=reminder#details`);

    expect(router.url).toBe(`/workspace/operations/activities?activityId=${activityId}&source=reminder#details`);
  });

  it('core activities redirects without a query', async () => {
    await harness.navigateByUrl('/core/activities');

    expect(router.url).toBe('/workspace/operations/activities');
    expect(targetGuard).toHaveBeenCalledOnce();
  });

  it('only the exact core activities path redirects', async () => {
    await harness.navigateByUrl('/core/activities/extra');

    expect(router.url).toBe('/core/activities/extra');
    expect(harness.routeNativeElement?.textContent).toBe('not found');
    expect(targetGuard).not.toHaveBeenCalled();
    const redirectIndex = layout.children!.indexOf(redirect);
    for (const path of ['forbidden', 'not-found', '**']) {
      expect(redirectIndex).toBeLessThan(layout.children!.findIndex((route) => route.path === path));
    }
  });

  it('redirect stays behind the auth guard', async () => {
    status.set('signed-out');
    await harness.navigateByUrl(`/core/activities?activityId=${activityId}`);

    expect(layout.canActivate).toContain(authGuard);
    expect(ensureLoaded).toHaveBeenCalledOnce();
    expect(router.parseUrl(router.url).root.children['primary'].segments.map((segment) => segment.path)).toEqual(['login']);
    expect(router.parseUrl(router.url).queryParams['returnUrl']).toBe(
      `/workspace/operations/activities?activityId=${activityId}`,
    );
    expect(targetGuard).not.toHaveBeenCalled();
  });
});

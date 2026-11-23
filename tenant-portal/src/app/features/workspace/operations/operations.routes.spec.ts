import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AuthSession } from '../../../core/auth/auth-session';
import type { SessionStatus } from '../../../core/auth/auth-session.model';
import { operationsRoutes } from './operations.routes';

@Component({ template: '' })
class OperationsRouteTestPage {
  canDeactivate(): boolean { return true; }
}

@Component({ template: '' })
class ForbiddenRouteTestPage {}

describe('operations routes', () => {
  const pages = operationsRoutes[0].children!;
  let permissions: string[];
  let status: SessionStatus;
  let harness: RouterTestingHarness;
  let router: Router;
  let location: Location;

  beforeEach(async () => {
    permissions = [];
    status = 'signed-in';
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: {
          ensureLoaded: async () => status,
          hasPermission: (key: string) => permissions.includes(key),
        } },
        provideLocationMocks(),
        provideRouter([
          { path: 'workspace/operations', children: operationsRoutes.map((route) => ({
            ...route,
            children: route.children?.map((page) => page.loadComponent
              ? { ...page, loadComponent: undefined, component: OperationsRouteTestPage }
              : page),
          })) },
          { path: 'outside', component: OperationsRouteTestPage },
          { path: 'forbidden', component: ForbiddenRouteTestPage },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    harness = await RouterTestingHarness.create();
  });

  async function expectAccess(path: string, keys: string[], allowed: boolean): Promise<void> {
    await harness.navigateByUrl('/outside');
    permissions = keys;
    const url = `/workspace/operations/${path}`;
    // A direct visit already has the requested URL in the address bar before guards run.
    location.go(url);
    const component = await harness.navigateByUrl(url);
    expect(component).toBeInstanceOf(allowed ? OperationsRouteTestPage : ForbiddenRouteTestPage);
    expect(router.url).toBe(allowed ? url : '/forbidden');
    expect(location.path()).toBe(url);
  }

  async function expectRequiredKeys(path: string, keys: string[]): Promise<void> {
    expect(pages.find((page) => page.path === path)?.canActivate).toHaveLength(1);
    for (const key of keys) await expectAccess(path, [key], true);
    await expectAccess(path, [], false);
  }

  it('party-directory needs directory.party.read', async () => {
    await expectRequiredKeys('party-directory', ['directory.party.read']);
  });

  it('directory-settings needs directory.settings.manage', async () => {
    await expectRequiredKeys('directory-settings', ['directory.settings.manage']);
    expect(pages.find((page) => page.path === 'directory-settings')?.canDeactivate).toHaveLength(1);
  });

  it('activities needs activities.read', async () => {
    await expectRequiredKeys('activities', ['activities.read']);
  });

  it('audit-log accepts any audit read key', async () => {
    await expectRequiredKeys('audit-log', ['audit.read.own', 'audit.read.branch', 'audit.read']);
  });

  it('activation accepts read or manage', async () => {
    await expectRequiredKeys('application-activation', [
      'applications.activation.manage', 'applications.activation.read',
    ]);
  });

  it('addon-seats accepts read or manage', async () => {
    await expectRequiredKeys('addon-seats', [
      'applications.addon_seats.read', 'applications.addon_seats.manage',
    ]);
  });

  it('guards defer to the auth guard when signed out', async () => {
    status = 'signed-out';
    for (const page of pages.filter((page) => page.loadComponent)) {
      await expectAccess(page.path!, [], true);
    }
  });

  it('translation scopes are unchanged', () => {
    expect(operationsRoutes[0].providers).toBeUndefined();
    expect(pages.map((page) => page.path)).toEqual([
      '', 'party-directory', 'directory-settings', 'activities', 'audit-log', 'application-activation', 'addon-seats',
    ]);
    const scopes = [
      provideTranslocoScope('settings', { scope: 'ws-party-directory', alias: 'wsParty' },
        { scope: 'ws-party-modal', alias: 'wsPartyModal' }),
      provideTranslocoScope('settings', { scope: 'ws-directory-settings', alias: 'wsDirSettings' }),
      provideTranslocoScope('settings', 'activities', { scope: 'ws-activities', alias: 'wsActivities' }),
      provideTranslocoScope('settings', { scope: 'ws-audit-log', alias: 'wsAudit' }),
      provideTranslocoScope('settings', { scope: 'ws-app-activation', alias: 'wsActivation' }),
      provideTranslocoScope('settings', { scope: 'ws-addon-seats', alias: 'wsAddonSeats' }),
    ];
    expect(pages.filter((page) => page.loadComponent).map((page) => page.providers))
      .toEqual(scopes.map((scope) => [scope]));
    expect(pages[0]).toEqual({ path: '', pathMatch: 'full', redirectTo: 'party-directory' });
  });
});

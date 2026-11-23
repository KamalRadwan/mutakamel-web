import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoScope } from '@jsverse/transloco';
import { AuthSession } from '../../../core/auth/auth-session';
import { templatesRoutes } from './templates.routes';

@Component({ template: '' })
class TemplateRouteTestPage {
  canLeave = true;
  canDeactivate(): boolean { return this.canLeave; }
}

@Component({ template: '' })
class ForbiddenRouteTestPage {}

describe('templates routes', () => {
  const pages = templatesRoutes[0].children!;
  let permissions: string[];
  let harness: RouterTestingHarness;
  let router: Router;
  let location: Location;

  beforeEach(async () => {
    permissions = [];
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthSession, useValue: {
          ensureLoaded: async () => 'signed-in',
          hasPermission: (key: string) => permissions.includes(key),
        } },
        provideLocationMocks(),
        provideRouter([
          { path: 'workspace/operations', children: templatesRoutes.map((route) => ({
            ...route,
            children: route.children?.map((page) => ({
              ...page, loadComponent: undefined, component: TemplateRouteTestPage,
            })),
          })) },
          { path: 'outside', component: TemplateRouteTestPage },
          { path: 'forbidden', component: ForbiddenRouteTestPage },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    harness = await RouterTestingHarness.create();
  });

  it('every template page needs templates.read', async () => {
    expect(pages.map((page) => page.path)).toEqual([
      'template-platform', 'template-platform/:id/:tab', 'template-platform/:id',
      'template-assets', 'template-assignments',
    ]);
    expect(templatesRoutes[0].providers).toEqual([provideTranslocoScope('templates')]);
    for (const page of pages) {
      expect(page.providers).toBeUndefined();
      expect(page.canActivate).toHaveLength(1);
      const url = `/workspace/operations/${page.path!.replace(':id', 'template-a').replace(':tab', 'design')}`;
      for (const allowed of [true, false]) {
        await harness.navigateByUrl('/outside');
        permissions = allowed ? ['templates.read'] : [];
        location.go(url);
        const component = await harness.navigateByUrl(url);
        expect(component).toBeInstanceOf(allowed ? TemplateRouteTestPage : ForbiddenRouteTestPage);
        expect(router.url).toBe(allowed ? url : '/forbidden');
        expect(location.path()).toBe(url);
      }
    }
  });

  it('template page keeps its deactivate guard', async () => {
    permissions = ['templates.read'];
    for (const path of ['template-platform/:id', 'template-platform/:id/:tab']) {
      expect(pages.find((page) => page.path === path)?.canDeactivate).toHaveLength(1);
      const url = `/workspace/operations/${path.replace(':id', 'template-a').replace(':tab', 'design')}`;
      const component = await harness.navigateByUrl(url, TemplateRouteTestPage);
      component.canLeave = false;
      await harness.navigateByUrl('/outside');
      expect(router.url).toBe(url);
      component.canLeave = true;
      await harness.navigateByUrl('/outside');
      expect(router.url).toBe('/outside');
    }
  });
});

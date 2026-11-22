import { Routes, UrlSegment } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { matchesRegisteredRoute } from './registered-route';

const lazyRoutes: Routes = [{ path: '', children: [{ path: 'list' }, { path: ':id', children: [{ path: 'tab' }] }] }];

const routes: Routes = [
  {
    path: '',
    children: [
      { path: '', pathMatch: 'full' },
      { path: 'feature', loadChildren: () => Promise.resolve(lazyRoutes) },
      { path: 'default', loadChildren: () => Promise.resolve({ default: lazyRoutes }) },
      { path: 'guarded', canMatch: [(_: unknown, segments: UrlSegment[]) => segments.length === 1], children: [] },
      { path: 'full', pathMatch: 'full', children: [{ path: 'child' }] },
      { path: '**' },
    ],
  },
];

describe('matchesRegisteredRoute', () => {
  it('matches declared paths, params and lazy children', async () => {
    expect(await matchesRegisteredRoute(routes, '/')).toBe(true);
    expect(await matchesRegisteredRoute(routes, '/feature')).toBe(true);
    expect(await matchesRegisteredRoute(routes, '/feature/list')).toBe(true);
    expect(await matchesRegisteredRoute(routes, '/feature/42/tab?x=1#top')).toBe(true);
    expect(await matchesRegisteredRoute(routes, '/default/list')).toBe(true);
  });

  it('does not count the wildcard fallback as a match', async () => {
    expect(await matchesRegisteredRoute(routes, '/nope')).toBe(false);
    expect(await matchesRegisteredRoute(routes, '/feature/42/other')).toBe(false);
  });

  it('honours canMatch and pathMatch full', async () => {
    expect(await matchesRegisteredRoute(routes, '/guarded')).toBe(true);
    expect(await matchesRegisteredRoute(routes, '/guarded/extra')).toBe(false);
    expect(await matchesRegisteredRoute(routes, '/full')).toBe(true);
    expect(await matchesRegisteredRoute(routes, '/full/child')).toBe(false);
  });
});

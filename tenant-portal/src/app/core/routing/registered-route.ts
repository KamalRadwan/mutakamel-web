import { Injector, runInInjectionContext } from '@angular/core';
import { DefaultUrlSerializer, PRIMARY_OUTLET, Route, Routes, UrlSegment } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';

/**
 * True when `url` reaches a declared route in `routes` (the router config), loading lazy children as
 * needed. Wildcard (`**`) routes do not count: in this app they are the Not Found / Not Ready fallbacks.
 * `canMatch` guards are honoured (run in `injector` when given); `canActivate` guards are not.
 */
export async function matchesRegisteredRoute(routes: Routes, url: string, injector?: Injector): Promise<boolean> {
  const segments = new DefaultUrlSerializer().parse(url).root.children[PRIMARY_OUTLET]?.segments ?? [];
  return matchAny(routes, segments, injector);
}

async function matchAny(routes: Routes, segments: UrlSegment[], injector?: Injector): Promise<boolean> {
  for (const route of routes) {
    if (await matchOne(route, segments, injector)) return true;
  }
  return false;
}

async function matchOne(route: Route, segments: UrlSegment[], injector?: Injector): Promise<boolean> {
  if (route.path === '**' || route.matcher || (route.outlet && route.outlet !== PRIMARY_OUTLET)) return false;
  const parts = route.path ? route.path.split('/') : [];
  if (parts.length > segments.length) return false;
  if (parts.some((part, i) => !part.startsWith(':') && part !== segments[i].path)) return false;
  const rest = segments.slice(parts.length);
  if (route.pathMatch === 'full' && rest.length > 0) return false;
  if (!(await passesCanMatch(route, segments, injector))) return false;
  if (rest.length === 0) return true;
  const children = route.children ?? (route.loadChildren ? await loadChildRoutes(route) : undefined);
  return children ? matchAny(children, rest, injector) : false;
}

async function loadChildRoutes(route: Route): Promise<Routes | undefined> {
  let loaded: unknown = route.loadChildren?.();
  if (isObservable(loaded)) loaded = await firstValueFrom(loaded);
  loaded = await loaded;
  if (loaded && typeof loaded === 'object' && 'default' in loaded) loaded = loaded.default;
  return Array.isArray(loaded) ? (loaded as Routes) : undefined;
}

async function passesCanMatch(route: Route, segments: UrlSegment[], injector?: Injector): Promise<boolean> {
  for (const guard of route.canMatch ?? []) {
    if (typeof guard !== 'function') continue;
    try {
      const call = () => (guard as (route: Route, segments: UrlSegment[]) => unknown)(route, segments);
      let result = injector ? runInInjectionContext(injector, call) : call();
      if (isObservable(result)) result = await firstValueFrom(result);
      if ((await result) === false) return false;
    } catch {
      return false;
    }
  }
  return true;
}

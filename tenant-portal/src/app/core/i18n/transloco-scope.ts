import { type Provider, inject } from '@angular/core';
import { TRANSLOCO_SCOPE, type TranslocoScope } from '@jsverse/transloco';

/**
 * `provideTranslocoScope` for a component that takes `<ng-content>`: its own scopes are ADDED to
 * the scopes its parent already sees (route and parent component scopes), instead of replacing them.
 * Put it in `viewProviders`.
 *
 * Why: Angular lets an embedded view (`@if`, `@for`, `ng-template`) declared in the PARENT's
 * template see the wrapper's `viewProviders` when the wrapper's host is the nearest element injector
 * above it (the view-provider check only asks "did the lookup come from another TView?"). So a
 * `| transloco` pipe in `<app-bulk-run-modal> @if (...) { ... } </app-bulk-run-modal>` got only the
 * wrapper's scope, translated before the page scope loaded and stayed a raw key. With the parent's
 * scopes kept in the list, that pipe waits for the page scope as well.
 */
export function provideTranslocoScopeInherited(...scopes: TranslocoScope[]): Provider {
  return {
    provide: TRANSLOCO_SCOPE,
    useFactory: () => {
      const parent = inject(TRANSLOCO_SCOPE, { skipSelf: true, optional: true });
      const inherited = ([] as TranslocoScope[]).concat(parent ?? []);
      return [...inherited, ...scopes] as unknown as TranslocoScope;
    },
  };
}

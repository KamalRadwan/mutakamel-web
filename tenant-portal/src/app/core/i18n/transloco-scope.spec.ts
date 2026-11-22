import { Component, Directive, Injectable, Type, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  TRANSLOCO_SCOPE,
  Translation,
  TranslocoLoader,
  TranslocoPipe,
  provideTransloco,
  provideTranslocoScope,
} from '@jsverse/transloco';
import { Observable, from, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { provideTranslocoScopeInherited } from './transloco-scope';

/** The page scope answers later (like HTTP); the wrapper's scope answers at once (already cached). */
@Injectable()
class Loader implements TranslocoLoader {
  getTranslation(path: string): Observable<Translation> {
    if (path.startsWith('page/')) {
      return from(new Promise<Translation>((resolve) => setTimeout(() => resolve({ shown: 'Shown', inIf: 'In if' }), 5)));
    }
    if (path.startsWith('wrap/')) return of({ ok: 'OK' });
    return of({});
  }
}

/** Records the TRANSLOCO_SCOPE the element sees: the same lookup a pipe on that element makes. */
@Directive({ selector: '[scopeProbe]' })
class ScopeProbe {
  readonly scope = inject(TRANSLOCO_SCOPE, { optional: true });
}

const WRAP_TEMPLATE = `<button>{{ 'wrap.ok' | transloco }}</button><ng-content />`;
const PAGE_TEMPLATE = `
  <test-wrap>
    <span id="static" scopeProbe>{{ 'page.shown' | transloco }}</span>
    @if (show()) {
      <span id="cond" scopeProbe>{{ 'page.inIf' | transloco }}</span>
    }
  </test-wrap>
`;

/** A wrapper like app-bulk-run-modal before the fix: plain provideTranslocoScope in viewProviders. */
@Component({
  selector: 'test-wrap',
  imports: [TranslocoPipe],
  viewProviders: [provideTranslocoScope({ scope: 'wrap', alias: 'wrap' })],
  template: WRAP_TEMPLATE,
})
class PlainWrap {}

/** The same wrapper with the fix. */
@Component({
  selector: 'test-wrap',
  imports: [TranslocoPipe],
  viewProviders: [provideTranslocoScopeInherited({ scope: 'wrap', alias: 'wrap' })],
  template: WRAP_TEMPLATE,
})
class InheritedWrap {}

/** Pages like customer-bulk-activity-modal: own scope, a static field and an @if field, projected. */
@Component({
  imports: [TranslocoPipe, PlainWrap, ScopeProbe],
  providers: [provideTranslocoScope({ scope: 'page', alias: 'page' })],
  template: PAGE_TEMPLATE,
})
class PlainPage {
  readonly show = signal(true);
}

@Component({
  imports: [TranslocoPipe, InheritedWrap, ScopeProbe],
  providers: [provideTranslocoScope({ scope: 'page', alias: 'page' })],
  template: PAGE_TEMPLATE,
})
class InheritedPage {
  readonly show = signal(true);
}

const names = (scope: unknown) =>
  ([] as unknown[]).concat(scope ?? []).map((s) => (typeof s === 'string' ? s : (s as { scope: string }).scope));

async function render(page: Type<unknown>) {
  TestBed.configureTestingModule({
    providers: [provideTransloco({ config: { availableLangs: ['en'], defaultLang: 'en' }, loader: Loader })],
  });
  const fixture = TestBed.createComponent(page);
  fixture.detectChanges();
  await new Promise((resolve) => setTimeout(resolve, 20));
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const scopeOf = (id: string) =>
    names(fixture.debugElement.query((d) => d.attributes['id'] === id).injector.get(ScopeProbe).scope);
  const text = (selector: string) => el.querySelector(selector)!.textContent;
  return { fixture, scopeOf, text };
}

describe('Transloco scope in content projected into a wrapper', () => {
  it('reproduces the leak: an @if in projected content sees only the wrapper viewProviders scope', async () => {
    const { fixture, scopeOf, text } = await render(PlainPage);
    expect(scopeOf('static')).toEqual(['page']);
    expect(scopeOf('cond')).toEqual(['wrap']);
    expect(text('#static')).toBe('Shown');
    expect(text('#cond')).toBe('page.inIf');
    fixture.destroy();
  });

  it('provideTranslocoScopeInherited keeps the page scope for the @if pipe and the wrapper still translates', async () => {
    const { fixture, scopeOf, text } = await render(InheritedPage);
    expect(scopeOf('static')).toEqual(['page']);
    expect(scopeOf('cond')).toEqual(['page', 'wrap']);
    expect(text('#static')).toBe('Shown');
    expect(text('#cond')).toBe('In if');
    expect(text('button')).toBe('OK');
    fixture.destroy();
  });
});

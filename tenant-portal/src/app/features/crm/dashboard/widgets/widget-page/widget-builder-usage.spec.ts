import { NO_ERRORS_SCHEMA, type Signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { convertToParamMap } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon } from '@ng-icons/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Badge } from '../../../../../shared/ui/badge/badge';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { Tabs } from '../../../../../shared/ui/tabs/tabs';
import { BuilderState } from '../builder/builder-state';
import { WidgetBuilder } from '../builder/widget-builder';
import { setupWidgetTest, widgetDetail, widgetId } from '../builder/builder-test-support';
import { WidgetPage } from './widget-page';
import { UsageTab } from './usage-tab/usage-tab';

interface UsageControls {
  nextCursor: Signal<string | null>;
  rows: Signal<unknown[]>;
  loadMore(): Promise<void>;
}

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`WidgetPage ${language} ${theme}`, () => {
    let setup: ReturnType<typeof setupWidgetTest>;
    let fixture: ComponentFixture<WidgetPage> | undefined;
    beforeEach(() => {
      setup = setupWidgetTest(language, theme);
      // Lifecycle, sharing and versions belong to WG-1c; retain the actual page, builder and usage views.
      TestBed.overrideComponent(WidgetPage, { set: {
        imports: [TranslocoPipe, NgIcon, Badge, FullState, Tabs, WidgetBuilder, UsageTab], schemas: [NO_ERRORS_SCHEMA],
      } });
    });
    afterEach(() => { fixture?.destroy(); fixture = undefined; setup.restore(); });

    function assertHints(element: HTMLElement) {
      for (const input of element.querySelectorAll<HTMLInputElement>('app-usage-tab input[readonly]')) {
        expect(input.id).toBeTruthy();
        const hint = input.getAttribute('aria-describedby')?.split(' ').find((id) => id.endsWith('-hint'));
        expect(hint).toBeTruthy();
        expect(element.querySelector(`[id="${hint}"]`)?.textContent?.trim()).toBeTruthy();
        expect(input.value).toMatch(/^[0-9]+$/);
      }
    }

    it('usage from the widget', async () => {
      const warnings = vi.spyOn(console, 'warn');
      fixture = setup.create(WidgetPage);
      fixture.detectChanges();
      await vi.waitFor(() => {
        fixture!.detectChanges();
        const builder = fixture!.debugElement.query(By.directive(WidgetBuilder));
        expect(builder).toBeTruthy();
        expect(builder.injector.get(BuilderState).widget()?.usage).toEqual(widgetDetail().usage);
      });
      await fixture.whenStable(); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-usage-tab').textContent)
        .toContain(setup.transloco.translate('widgetPage.usage.dashboards'));
      expect([...fixture.nativeElement.querySelectorAll('app-usage-tab input[readonly]')].map((input) => (input as HTMLInputElement).value))
        .toEqual(['3', '4', '2', '1']);
      assertHints(fixture.nativeElement);
      setup.params.next(convertToParamMap({ id: widgetId, tab: 'usage' }));
      fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
      const usage = fixture.debugElement.queryAll(By.directive(UsageTab)).at(-1)!;
      const controls = usage.componentInstance as UsageControls;
      await controls.loadMore(); fixture.detectChanges();
      expect(setup.stub.recordedReads().some((read) => read.path === `/widgets/${widgetId}`
        && read.query?.['usageCursor'] === widgetDetail().usage.nextCursor)).toBe(true);
      expect(controls.nextCursor()).toBeNull();
      expect(controls.rows()).toHaveLength(3);
      expect(usage.nativeElement.textContent).toContain('Pipeline');
      expect(usage.nativeElement.textContent).toContain(setup.transloco.translate('widgetPage.usage.moreHidden', { count: 2 }));
      const ids = [...fixture.nativeElement.querySelectorAll('app-usage-tab input[readonly]')].map((input) => (input as HTMLInputElement).id);
      expect(new Set(ids).size).toBe(ids.length);
      assertHints(fixture.nativeElement);
      expect(document.documentElement.dir).toBe(language === 'ar' ? 'rtl' : 'ltr');
      expect(document.documentElement.dataset['theme']).toBe(theme);
      expect(warnings.mock.calls.flat().join(' ')).not.toMatch(/Missing hint|Missing translation/i);
    });
  });
}

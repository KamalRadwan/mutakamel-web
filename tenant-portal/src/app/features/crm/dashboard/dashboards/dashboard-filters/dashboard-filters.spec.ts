import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Field } from '../../../../../shared/ui/field/field';
import { setupDashboardTest, actorId } from '../dashboard-page/dashboard-test-support';
import { DashboardFilters, defaultFilterValue, toRuntimeFilters } from './dashboard-filters';

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`DashboardFilters ${language} ${theme}`, () => {
    let setup: ReturnType<typeof setupDashboardTest>;
    let fixture: ComponentFixture<DashboardFilters> | undefined;
    beforeEach(() => { setup = setupDashboardTest(language, theme); });
    afterEach(() => { fixture?.destroy(); fixture = undefined; setup.restore(); });

    it('invalid filter', async () => {
      fixture = setup.create(DashboardFilters);
      fixture.componentRef.setInput('value', defaultFilterValue({}));
      const message = setup.transloco.translate('analytics.error.CRM_DASHBOARD_FILTER_INVALID');
      fixture.componentRef.setInput('error', message);
      fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
      const fields = fixture.debugElement.queryAll(By.directive(Field));
      expect(fields.length).toBeGreaterThan(1);
      for (const field of fields) expect((field.componentInstance as Field).hint()).not.toBe('');
      const error = fixture.nativeElement.querySelector('[id$="-period-error"]') as HTMLElement;
      expect(error.textContent).toContain(message);
      const periodControl = fixture.nativeElement.querySelector('ui-date-range button') as HTMLElement;
      expect(periodControl.getAttribute('aria-describedby')).toContain(error.id);
      expect(fixture.nativeElement.textContent).not.toContain('dashFilters.period');
      for (const icon of fixture.nativeElement.querySelectorAll('ui-field ng-icon[name="tablerExclamationCircle"]')) {
        expect(icon.tabIndex).toBe(-1);
      }
    });

    it('uses the real user and server teams for population filters', () => {
      const value = defaultFilterValue({ currencyCode: 'USD', pipelineId: 'pipeline' });
      expect(toRuntimeFilters({ ...value, scope: 'own' }, [], actorId)).toHaveProperty('ownerUserIds', [actorId]);
      expect(toRuntimeFilters({ ...value, scope: 'team' }, ['server-team'], actorId)).toHaveProperty('teamIds', ['server-team']);
      expect(toRuntimeFilters({ ...value, scope: 'team' }, [], actorId)).not.toHaveProperty('teamIds');
      expect(toRuntimeFilters(value, [], actorId, { currencyCode: 'USD', pipelineId: 'pipeline' }))
        .toMatchObject({ currencyCode: 'USD', pipelineId: 'pipeline' });
    });

    it('resolves today in the settings zone and UTC fallback', () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-11-23T23:30:00Z'));
      expect(defaultFilterValue({ datePreset: 'TODAY' }, 'Pacific/Kiritimati').period?.from).toContain('2026-11-24');
      expect(defaultFilterValue({ datePreset: 'TODAY' }).period?.from).toContain('2026-11-23');
    });
  });
}

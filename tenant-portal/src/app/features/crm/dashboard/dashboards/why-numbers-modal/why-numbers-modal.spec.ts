import { type Signal } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { Field } from '../../../../../shared/ui/field/field';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import type { Receipt } from '../../../../../shared/widgets/dashboard/analytics.model';
import { ExplainModal } from '../explain-modal/explain-modal';
import { dashboardId, dashboardRun, receiptId, setupDashboardTest } from '../dashboard-page/dashboard-test-support';
import { WhyNumbersModal } from './why-numbers-modal';

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`WhyNumbersModal ${language} ${theme}`, () => {
    let setup: ReturnType<typeof setupDashboardTest>;
    let fixture: ComponentFixture<WhyNumbersModal> | undefined;
    beforeEach(() => { setup = setupDashboardTest(language, theme); });
    afterEach(() => { fixture?.destroy(); fixture = undefined; setup.restore(); });

    async function open() {
      fixture = setup.create(WhyNumbersModal);
      fixture.detectChanges();
      fixture.componentInstance.open(dashboardId, dashboardRun());
      await vi.waitFor(() => expect((fixture!.componentInstance as unknown as { loading: Signal<boolean> }).loading()).toBe(false));
      fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
    }

    it('receipt', async () => {
      setup.permissions.splice(1, 1);
      await open();
      expect((fixture!.componentInstance as unknown as { receipts: Signal<Receipt[]> }).receipts()[0].id).toBe(receiptId);
      expect(setup.stub.recordedReads().some((read) => read.path === `/dashboards/receipts/${receiptId}`)).toBe(true);
      expect(setup.stub.recordedReads().some((read) => read.path.includes('readiness') || read.path.includes('scope-inspector'))).toBe(false);
      for (const field of fixture!.debugElement.queryAll(By.directive(Field))) {
        expect((field.componentInstance as Field).hint()).not.toBe('');
      }
      const explain = fixture!.debugElement.query(By.directive(ExplainModal)).componentInstance as ExplainModal;
      const button = [...fixture!.nativeElement.querySelectorAll('button')].find((element) =>
        (element as HTMLElement).textContent?.trim() === setup.transloco.translate('dashFilters.explainTitle')) as HTMLButtonElement;
      expect(button).toBeTruthy(); button.click();
      await vi.waitFor(() => expect((explain as unknown as { receipt: Signal<Receipt | null> }).receipt()?.id).toBe(receiptId));
      fixture!.detectChanges();
      expect(setup.stub.recordedReads().some((read) => read.path === `/dashboards/receipts/${receiptId}/explain`)).toBe(true);
      expect(fixture!.nativeElement.textContent).toContain('42');
      expect(fixture!.nativeElement.textContent).not.toContain('dashFilters.receipts');
    });

    it('keeps a failed receipt open with Retry and its correlation id', async () => {
      setup.stub.readFailures.set(`/dashboards/receipts/${receiptId}`,
        new ApiError(0, 'NETWORK_ERROR', undefined, { correlationId: 'receipt-read' }));
      await open();
      const full = fixture!.debugElement.query(By.directive(FullState)).componentInstance as FullState;
      expect(full.kind()).toBe('load-failure'); expect(full.text()).toContain('receipt-read');
      setup.stub.readFailures.clear(); full.action.emit();
      await vi.waitFor(() => expect((fixture!.componentInstance as unknown as { receipts: Signal<Receipt[]> }).receipts()).toHaveLength(1));
      fixture!.detectChanges();
      expect(fixture!.nativeElement.querySelector('dialog[open]')).toBeTruthy();
    });
  });
}

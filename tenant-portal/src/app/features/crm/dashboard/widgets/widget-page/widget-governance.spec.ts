import { type Signal, type WritableSignal } from '@angular/core';
import { type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { ConfirmDialog } from '../../../../../shared/ui/confirm-dialog/confirm-dialog';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { ArchiveModal } from '../lifecycle-modals/archive-modal';
import { CloneModal } from '../lifecycle-modals/clone-modal';
import { TransferModal } from '../lifecycle-modals/transfer-modal';
import type { LifecycleImpact, TransferImpact, VersionCompare } from '../widgets.model';
import { AccessTab } from './access-tab/access-tab';
import { VersionsTab } from './versions-tab/versions-tab';
import { compareFixture, lifecycleFixture, render, setupGovernanceTest, targetId, transferFixture,
  widgetDetail, widgetId, widgetPath } from './governance-test-support';

interface ArchiveControls {
  reason: WritableSignal<string>;
  impact: Signal<LifecycleImpact | null>;
  conflictOpen: Signal<boolean>;
  canSubmit: Signal<boolean>;
  placementCount: Signal<number>;
  submit(): Promise<void>;
  resolveConflict(keep: boolean): Promise<void>;
  close(): void;
}
interface TransferControls {
  reason: WritableSignal<string>;
  acknowledged: WritableSignal<boolean>;
  impact: Signal<TransferImpact | null>;
  ownerError: Signal<string | null>;
  conflictOpen: Signal<boolean>;
  selectTarget(id: string): void;
  submit(): Promise<void>;
  resolveConflict(keep: boolean): Promise<void>;
}
interface VersionControls {
  comparison: Signal<VersionCompare | null>;
  conflictOpen: Signal<boolean>;
  toggleVersion(version: number): void;
  compareSelected(): Promise<void>;
  restoreLeft(): Promise<void>;
  resolveConflict(keep: boolean): Promise<void>;
}
interface CloneControls { name: WritableSignal<string>; submit(): Promise<void>; canSubmit: Signal<boolean>; }

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`${language} ${theme}`, () => {
    let setup: ReturnType<typeof setupGovernanceTest>;
    let fixture: ComponentFixture<unknown> | undefined;
    let warnings: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      setup = setupGovernanceTest(language, theme);
      warnings = vi.spyOn(console, 'warn');
    });
    afterEach(() => {
      expect(document.documentElement.dir).toBe(language === 'ar' ? 'rtl' : 'ltr');
      expect(document.documentElement.dataset['theme']).toBe(theme);
      expect(warnings.mock.calls.flat().join(' ')).not.toMatch(/Missing hint|Missing translation/i);
      fixture?.destroy(); fixture = undefined; setup.restore();
    });

    function assertHints(element: HTMLElement): void {
      for (const input of element.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[id], textarea[id]')) {
        if (input.type === 'checkbox') continue;
        const hint = input.getAttribute('aria-describedby')?.split(' ').find((id) => id.endsWith('-hint'));
        expect(hint).toBeTruthy();
        expect(element.querySelector(`[id="${hint}"]`)?.textContent?.trim()).toBeTruthy();
      }
    }

    describe('LifecycleModals', () => {
      it('archive flow', async () => {
        const current = setup.create(ArchiveModal); fixture = current;
        await render(current);
        const done = current.componentInstance.open(widgetDetail());
        await render(current);
        const controls = current.componentInstance as unknown as ArchiveControls;
        expect(controls.canSubmit()).toBe(false);
        controls.reason.set('Retired');
        assertHints(current.nativeElement);
        const normal = setup.stub.respond;
        let stale = true;
        setup.stub.respond = (path, body) => {
          if (path.endsWith('/lifecycle') && stale) {
            stale = false;
            throw new ApiError(409, 'CRM_WIDGET_LIFECYCLE_IMPACT_STALE');
          }
          if (path.endsWith('/lifecycle-impact')) return { ...lifecycleFixture(),
            widgetRevision: setup.stub.detail.revision, governanceRevision: setup.stub.detail.governanceRevision };
          return normal(path, body);
        };
        await controls.submit(); await render(current);
        expect(controls.conflictOpen()).toBe(true);
        expect(current.debugElement.query(By.directive(ConflictDialog))).toBeTruthy();
        expect(setup.stub.recordedWrites().filter((w) => w.path.endsWith('/lifecycle'))).toHaveLength(1);
        setup.stub.detail.revision = 8; setup.stub.detail.governanceRevision = 4;
        await controls.resolveConflict(true); await render(current);
        expect(controls.reason()).toBe('Retired');
        await controls.submit(); await render(current);
        expect(await done).toBe(true);
        const writes = setup.stub.recordedWrites().filter((w) => w.path.endsWith('/lifecycle'));
        expect(writes[1].body).toMatchObject({ impactId: lifecycleFixture().impactId,
          expectedWidgetRevision: 8, expectedGovernanceRevision: 4, reason: 'Retired' });
        expect(writes[1].options.key).not.toBe(writes[0].options.key);
      });

      it('confirm lists the impact usage', async () => {
        const current = setup.create(ArchiveModal); fixture = current; await render(current);
        const controls = current.componentInstance as unknown as ArchiveControls;
        for (const status of ['PUBLISHED', 'ARCHIVED'] as const) {
          const done = current.componentInstance.open({ ...widgetDetail(), status });
          await render(current);
          const text = current.nativeElement.textContent as string;
          for (const placement of lifecycleFixture().placements) expect(text).toContain(placement.dashboardName);
          expect(text).toContain(`+3 ${setup.transloco.translate('widgetPage.usage.hiddenPlacements')}`);
          expect(text).toContain('Revenue alert'); expect(text).toContain('Leads alert');
          expect(controls.placementCount()).toBe(status === 'ARCHIVED' ? 1 : 9);
          expect(text).toContain(setup.transloco.translate(status === 'ARCHIVED'
            ? 'widgets.archiveModal.ownerMustResume' : 'widgets.archiveModal.willSuspend'));
          assertHints(current.nativeElement);
          controls.close(); await done;
        }
      });

      it.each(['CRM_WIDGETS_DISABLED', 'CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY'])('locks fields after %s', async (code) => {
        const current = setup.create(ArchiveModal); fixture = current; await render(current);
        void current.componentInstance.open(widgetDetail()); await render(current);
        const controls = current.componentInstance as unknown as ArchiveControls;
        controls.reason.set('Retired');
        const locked = vi.spyOn(current.componentInstance.becameReadOnly, 'emit');
        const normal = setup.stub.respond;
        setup.stub.respond = (path, body) => {
          if (path.endsWith('/lifecycle')) throw new ApiError(403, code);
          return normal(path, body);
        };
        await controls.submit(); await render(current);
        expect(controls.reason()).toBe('Retired');
        expect(controls.canSubmit()).toBe(false);
        expect(current.nativeElement.querySelector('textarea').disabled).toBe(true);
        expect(locked).toHaveBeenCalledOnce();
      });
    });

    describe('WidgetPage', () => {
      it('versions', async () => {
        vi.spyOn(ConfirmDialog.prototype, 'open').mockResolvedValue(true);
        const current = setup.create(VersionsTab); fixture = current;
        current.componentRef.setInput('widget', widgetDetail()); await render(current);
        const controls = current.componentInstance as unknown as VersionControls;
        controls.toggleVersion(1); controls.toggleVersion(2);
        await controls.compareSelected(); await render(current);
        expect(current.nativeElement.textContent).toContain('Original leads');
        expect(current.nativeElement.textContent).toContain('Current leads');
        const normal = setup.stub.respond;
        for (const code of ['CRM_WIDGET_VERSION_RESTORE_STALE', 'CRM_WIDGET_VERSION_CONFLICT']) {
          setup.stub.respond = (path, body) => {
            if (path.endsWith('/restore-draft')) throw new ApiError(409, code);
            return normal(path, body);
          };
          await controls.restoreLeft(); await render(current);
          expect(controls.conflictOpen()).toBe(true);
          await controls.resolveConflict(true); await render(current);
          expect(controls.comparison()?.proof).toEqual(compareFixture().proof);
        }
        setup.stub.respond = normal;
        const restored = vi.spyOn(current.componentInstance.restored, 'emit');
        await controls.restoreLeft();
        expect(restored).toHaveBeenCalledOnce();
        expect(setup.stub.recordedWrites().at(-1)?.body).toEqual({ leftVersionNumber: 1, rightVersionNumber: 2,
          sourceVersionNumber: 1, expectedWidgetRevision: 7, expectedGovernanceRevision: 3,
          impactId: compareFixture().proof!.impactId, acknowledged: true });
      });

      it('ownership transfer', async () => {
        const current = setup.create(TransferModal); fixture = current; await render(current);
        void current.componentInstance.open(widgetDetail()); await render(current);
        const controls = current.componentInstance as unknown as TransferControls;
        controls.selectTarget(targetId); await render(current);
        controls.reason.set('New owner'); controls.acknowledged.set(true);
        expect(current.nativeElement.textContent).toContain('Recipient');
        assertHints(current.nativeElement);
        const normal = setup.stub.respond;
        for (const code of ['CRM_OWNERSHIP_TARGET_INACTIVE', 'CRM_WIDGET_TRANSFER_TARGET_INELIGIBLE']) {
          setup.stub.respond = (path, body) => {
            if (path.endsWith('/ownership-transfer')) throw new ApiError(422, code);
            return normal(path, body);
          };
          await controls.submit(); await render(current);
          expect(controls.ownerError()).toBe(setup.transloco.translate(`analytics.error.${code}`));
          const owner = current.nativeElement.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement;
          expect(owner.getAttribute('aria-invalid')).toBe('true');
          expect(controls.impact()).toBeNull();
          controls.selectTarget(targetId); await render(current); controls.acknowledged.set(true);
        }
        setup.stub.respond = (path, body) => {
          if (path.endsWith('/ownership-transfer')) throw new ApiError(409, 'CRM_WIDGET_TRANSFER_IMPACT_STALE');
          return normal(path, body);
        };
        await controls.submit(); expect(controls.conflictOpen()).toBe(true);
        setup.stub.detail.revision = 9;
        setup.stub.respond = (path, body) => path.endsWith('/ownership-transfer/impact')
          ? { ...transferFixture(), widget: { ...transferFixture().widget, widgetRevision: 9 } } : normal(path, body);
        await controls.resolveConflict(true); controls.acknowledged.set(true);
        await controls.submit();
        expect(setup.stub.recordedWrites().at(-1)?.body).toMatchObject({ expectedWidgetRevision: 9,
          expectedGovernanceRevision: 3, reason: 'New owner', targetUserId: targetId, acknowledged: true });
      });

      it.each([
        [0, 'NETWORK_ERROR', 'load-failure'], [503, 'CRM_ANALYTICS_SOURCE_UNAVAILABLE', 'provisioning'],
        [403, 'CRM_DASHBOARD_DEFINITION_ACCESS_DENIED', 'forbidden'], [404, 'CRM_WIDGET_NOT_FOUND', 'not-found'],
      ] as const)('versions load state for %i', async (status, code, kind) => {
        setup.stub.readFailures.set(`${widgetPath}/versions`, new ApiError(status, code, undefined, { correlationId: 'trace-wg1c' }));
        const current = setup.create(VersionsTab); fixture = current;
        current.componentRef.setInput('widget', widgetDetail()); await render(current);
        const state = current.debugElement.query(By.directive(FullState));
        expect((state.componentInstance as FullState).kind()).toBe(kind);
        expect(state.nativeElement.textContent).toContain('trace-wg1c');
      });

      it('access loads live shares and requires the share permission', async () => {
        const current = setup.create(AccessTab); fixture = current;
        current.componentRef.setInput('widget', widgetDetail()); await render(current);
        expect(current.nativeElement.textContent).toContain('Recipient');
        expect(setup.stub.recordedReads().some((r) => r.path.endsWith('/shares') && r.scope === undefined)).toBe(true);
        setup.permissions.splice(setup.permissions.indexOf('crm.widgets.share'), 1);
        current.componentRef.setInput('widget', { ...widgetDetail(), revision: 8 }); await render(current);
        expect(current.nativeElement.querySelector('button')?.textContent).not.toContain(setup.transloco.translate('widgetPage.access.manageAccess'));
      });
    });

    it('clone keeps the key and entered name for a retry', async () => {
      const current = setup.create(CloneModal); fixture = current; await render(current);
      void current.componentInstance.open(widgetDetail()); await render(current);
      const controls = current.componentInstance as unknown as CloneControls;
      controls.name.set('Copy'); assertHints(current.nativeElement);
      const normal = setup.stub.respond;
      setup.stub.respond = () => { throw new ApiError(0, 'NETWORK_ERROR'); };
      await controls.submit();
      const firstKey = setup.stub.recordedWrites().at(-1)?.options.key;
      expect(controls.name()).toBe('Copy');
      setup.stub.respond = normal;
      await controls.submit();
      expect(setup.stub.recordedWrites().at(-1)?.options.key).toBe(firstKey);
    });
  });
}

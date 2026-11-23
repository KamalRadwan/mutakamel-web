import { type Signal } from '@angular/core';
import { type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { FullState } from '../../../../../shared/ui/full-state/full-state';
import { setupWidgetTest, widgetDetail, widgetDraft, widgetId, widgetImpact } from '../builder/builder-test-support';
import type { PublishImpact } from '../widgets.model';
import { PublishModal } from './publish-modal';

interface PublishControls {
  impact: Signal<PublishImpact | null>;
  conflictOpen: Signal<boolean>;
  confirmPublish(): Promise<void>;
  reloadImpact(): Promise<void>;
}

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`PublishModal ${language} ${theme}`, () => {
    let setup: ReturnType<typeof setupWidgetTest>;
    let fixture: ComponentFixture<PublishModal> | undefined;
    let controls: PublishControls;
    beforeEach(() => { setup = setupWidgetTest(language, theme); });
    afterEach(() => { fixture?.destroy(); fixture = undefined; setup.restore(); });

    async function open() {
      fixture = setup.create(PublishModal);
      fixture.detectChanges();
      controls = fixture.componentInstance as unknown as PublishControls;
      const result = fixture.componentInstance.open(widgetId, widgetDraft(), widgetDetail().usage);
      await vi.waitFor(() => { fixture!.detectChanges(); expect(controls.impact()).not.toBeNull(); });
      await fixture.whenStable(); fixture.detectChanges();
      return { result };
    }
    const publishes = () => setup.stub.recordedWrites().filter((call) => call.path.endsWith('/publish'));

    it('publish flow', async () => {
      const warnings = vi.spyOn(console, 'warn');
      const { result } = await open();
      const impactCall = setup.stub.recordedWrites().find((call) => call.path.endsWith('/publish-impact'))!;
      expect(impactCall.body).toEqual({ expectedWidgetRevision: 7, expectedGovernanceRevision: 3,
        expectedDraftId: widgetDraft().draft!.draftId, expectedDraftRevision: 5 });
      expect(fixture!.nativeElement.textContent).toContain('Sales');
      const inputs = [...fixture!.nativeElement.querySelectorAll('input[id^="widget-publish-"][readonly]')] as HTMLInputElement[];
      expect(inputs.map((input) => input.value)).toEqual(['3', '4', '2']);
      for (const input of inputs) {
        const hint = input.getAttribute('aria-describedby')?.split(' ').find((id) => id.endsWith('-hint'));
        expect(hint).toBeTruthy();
        expect(fixture!.nativeElement.querySelector(`[id="${hint}"]`)?.textContent?.trim()).toBeTruthy();
      }
      expect([...fixture!.nativeElement.querySelectorAll('span.cursor-help[tabindex="0"]')]).toHaveLength(0);
      await controls.confirmPublish();
      expect(await result).toBe(true);
      expect(publishes()[0].body).toEqual({ ...impactCall.body as object, impactId: widgetImpact().impactId });
      expect(publishes()[0].options.key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f-]+$/i);
      expect(publishes()[0].options.scope).toBeUndefined();
      expect(fixture!.componentInstance.lastPublishedVersion()).toBe(3);
      expect(warnings.mock.calls.flat().join(' ')).not.toMatch(/Missing hint|Missing translation/i);
    });

    it('stale impact', async () => {
      const { result } = await open();
      let inspect = 0;
      setup.stub.respond = (path) => {
        if (path.endsWith('/publish-impact')) {
          inspect++;
          return { ...widgetImpact(), impactId: 'new-impact', widgetRevision: 8, governanceRevision: 4, draftRevision: 6 };
        }
        if (publishes().length === 1) throw new ApiError(409, 'CRM_WIDGET_PUBLISH_IMPACT_STALE');
        return { widgetId, versionNumber: 3 };
      };
      const first = controls.confirmPublish();
      await vi.waitFor(() => { fixture!.detectChanges(); expect(controls.conflictOpen()).toBe(true); });
      expect(controls.impact()).toBeNull();
      setup.stub.draft.widgetRevision = 8;
      setup.stub.draft.governanceRevision = 4;
      setup.stub.draft.draft!.revision = 6;
      const dialog = fixture!.debugElement.query(By.directive(ConflictDialog)).componentInstance as ConflictDialog;
      dialog.reload.emit(); fixture!.detectChanges();
      await first;
      fixture!.detectChanges();
      expect(inspect).toBe(1);
      expect(controls.impact()?.impactId).toBe('new-impact');
      expect(setup.stub.recordedReads().at(-1)?.path).toBe(`/widgets/${widgetId}/draft`);
      const impactCalls = setup.stub.recordedWrites().filter((call) => call.path.endsWith('/publish-impact'));
      expect(impactCalls[1].body).toMatchObject({ expectedWidgetRevision: 8, expectedGovernanceRevision: 4, expectedDraftRevision: 6 });
      await controls.confirmPublish();
      expect(await result).toBe(true);
      expect(publishes()[1].body).toMatchObject({ impactId: 'new-impact', expectedWidgetRevision: 8,
        expectedGovernanceRevision: 4, expectedDraftRevision: 6 });
      expect(publishes()[1].options.key).not.toBe(publishes()[0].options.key);
    });

    it.each([[0, 'NETWORK_ERROR'], [500, 'COMMON.GENERIC.INTERNAL_ERROR'], [409, 'GW.IDEM.IN_FLIGHT'],
      [401, 'GW.AUTH.UNAUTHORIZED']])('retains publish key and body after %s %s', async (status, code) => {
      const { result } = await open();
      setup.stub.respond = () => {
        if (publishes().length === 1) throw new ApiError(Number(status), String(code));
        return { widgetId, versionNumber: 3 };
      };
      await controls.confirmPublish();
      expect(controls.impact()).not.toBeNull();
      await controls.confirmPublish();
      expect(await result).toBe(true);
      expect(publishes()[1].options.key).toBe(publishes()[0].options.key);
      expect(publishes()[1].body).toEqual(publishes()[0].body);
      if (status === 401) expect(setup.notify.error).toHaveBeenCalledWith(setup.transloco.translate('builder2.requests.notSaved'));
    });

    it.each(['GW.IDEM.MISMATCH', 'CRM_WIDGET_PUBLISH_IDEMPOTENCY_MISMATCH'])('never resends %s before reloading', async (code) => {
      await open();
      setup.stub.respond = () => { throw new ApiError(409, code); };
      await controls.confirmPublish(); await controls.confirmPublish();
      expect(publishes()).toHaveLength(1);
      expect(controls.impact()).toBeNull();
      fixture!.detectChanges();
      expect(fixture!.debugElement.query(By.directive(FullState))).toBeTruthy();
      expect(setup.notify.error).toHaveBeenCalledWith(setup.transloco.translate('builder2.requests.reloadRequired'));
    });

    it('returns validation to the owning builder and does not leave an inline error banner', async () => {
      const { result } = await open();
      const received: ApiError[] = [];
      fixture!.componentInstance.validationError.subscribe((error) => received.push(error));
      setup.stub.respond = () => { throw new ApiError(422, 'CRM_WIDGET_METRIC_INVALID'); };
      await controls.confirmPublish();
      expect(await result).toBe(false);
      expect(received[0].code).toBe('CRM_WIDGET_METRIC_INVALID');
      expect(fixture!.nativeElement.querySelector('[role="alert"]')).toBeNull();
    });

    it('locks the form after a read-only write rejection', async () => {
      const { result } = await open();
      const readOnly = vi.fn();
      fixture!.componentInstance.becameReadOnly.subscribe(readOnly);
      setup.stub.respond = () => { throw new ApiError(403, 'CRM_SUBSCRIPTION_READ_ONLY'); };
      await controls.confirmPublish();
      expect(await result).toBe(false);
      expect(readOnly).toHaveBeenCalledOnce();
    });

    it.each(['CRM_TARGET_SOURCE_NOT_READY', 'CRM_ANALYTICS_SOURCE_UNAVAILABLE', 'CRM_TEAM_SCOPE_NOT_READY',
      'CRM_DASHBOARD_BLUEPRINTS_NOT_READY', 'CRM_INQUIRY_SOURCE_NOT_READY'])('shows provisioning for %s', async (code) => {
      setup.stub.respond = () => { throw new ApiError(503, code, undefined, { correlationId: 'publish-ref' }); };
      fixture = setup.create(PublishModal); fixture.detectChanges();
      void fixture.componentInstance.open(widgetId, widgetDraft(), widgetDetail().usage);
      await vi.waitFor(() => {
        fixture!.detectChanges();
        const fullState = fixture!.debugElement.query(By.directive(FullState))?.componentInstance as FullState;
        expect(fullState?.kind()).toBe('provisioning');
        expect(fullState.text()).toContain('publish-ref');
        expect(fullState.actionLabel()).toBe(setup.transloco.translate('builder2.requests.readiness'));
      });
    });
  });
}

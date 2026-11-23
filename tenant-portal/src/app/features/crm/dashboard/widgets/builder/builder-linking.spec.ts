import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../../core/api/api-errors';
import { ConflictDialog } from '../../../../../shared/ui/conflict-dialog/conflict-dialog';
import { BuilderState, type StepId } from './builder-state';
import { WidgetBuilder } from './widget-builder';
import { networkError, setupWidgetTest, widgetDraft, widgetId, widgetPreview } from './builder-test-support';

const validationCases: [string, StepId, string][] = [
  ['AXIS_REQUIRED', 'metrics', 'series'], ['METRIC_INVALID', 'metrics', 'series.0.metricKey'],
  ['DIMENSION_INVALID', 'metrics', 'dimension'], ['FILTER_INVALID', 'scope', 'filterTree'],
  ['FILTER_TOO_COMPLEX', 'scope', 'filterTree'], ['SERIES_INVALID', 'metrics', 'series'],
  ['SHAPE_INCOMPATIBLE', 'presentation', 'visualizationType'], ['TARGET_REQUIRED', 'compare', 'comparison.target'],
  ['TARGET_INVALID', 'compare', 'comparison.target'], ['TARGET_CURRENCY_INVALID', 'compare', 'comparison'],
  ['TIME_GRAIN_REQUIRED', 'metrics', 'dimension'], ['UNITS_INCOMPATIBLE', 'metrics', 'series'],
  ['VISUALIZATION_INVALID', 'presentation', 'visualizationType'], ['COMPARISON_UNSUPPORTED', 'compare', 'comparison'],
  ['COMPARISON_DATASETS_INVALID', 'compare', 'comparison.datasets'], ['ENGINE_INVALID', 'data', 'source'],
  ['DRAFT_INVALID', 'review', 'changeSummary'], ['PUBLISH_INVALID', 'review', 'changeSummary'],
  ['UNAVAILABLE', 'metrics', 'series.0.metricKey'], ['DISPLAY_INVALID', 'presentation', 'displaySpec.references'],
];

for (const language of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) {
  describe(`Builder ${language} ${theme}`, () => {
    let setup: ReturnType<typeof setupWidgetTest>;
    let fixture: ComponentFixture<WidgetBuilder> | undefined;
    beforeEach(() => { setup = setupWidgetTest(language, theme); });
    afterEach(() => { fixture?.destroy(); fixture = undefined; setup.restore(); });

    async function loadState() {
      const state = setup.state;
      await state.load(widgetId);
      TestBed.tick();
      await vi.waitFor(() => expect(state.preview().execution?.value).toBe(42));
      return state;
    }

    it('preview latest wins', async () => {
      const state = await loadState();
      const pending: ((value: ReturnType<typeof widgetPreview>) => void)[] = [];
      setup.stub.respond = () => new Promise((resolve) => pending.push(resolve));
      vi.useFakeTimers();
      state.patch({ name: 'First' }); TestBed.tick();
      await vi.advanceTimersByTimeAsync(599);
      expect(pending).toHaveLength(0);
      state.patch({ name: 'Second' }); TestBed.tick();
      await vi.advanceTimersByTimeAsync(599);
      expect(pending).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(pending).toHaveLength(1);
      state.patch({ name: 'Latest' }); TestBed.tick();
      await vi.advanceTimersByTimeAsync(600);
      expect(pending).toHaveLength(2);
      pending[1](widgetPreview(99)); await vi.advanceTimersByTimeAsync(0);
      expect(state.preview().execution?.value).toBe(99);
      pending[0](widgetPreview(1)); await vi.advanceTimersByTimeAsync(0);
      expect(state.preview().execution?.value).toBe(99);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(pending).toHaveLength(2);
      const calls = setup.stub.recordedWrites().filter((call) => call.path === '/widgets/preview');
      expect(calls.at(-1)?.body).toHaveProperty('name', 'Latest');
      expect(calls.at(-1)?.options).not.toHaveProperty('scope');
      expect(calls.at(-1)?.options).not.toHaveProperty('signal');
    });

    it.each(validationCases)('validation codes: CRM_WIDGET_%s', (suffix, step, field) => {
      const state = setup.state;
      state.applyValidationError(new ApiError(422, `CRM_WIDGET_${suffix}`));
      expect(state.lastServerErrorStep()).toBe(step);
      expect(state.step()).toBe(step);
      expect(state.errors()[step]?.[field]).toBeTruthy();
      expect(state.formError()).toBeNull();
    });

    it('routes DTO paths and business paths without treating metadata as fields', () => {
      const state = setup.state;
      state.applyValidationError(ApiError.fromResponse(400, { errorCode: 'CRM_VALIDATION_FAILED',
        details: { 'querySpec.series.0.metricKey': ['invalid'], name: ['required'] } }));
      expect(Object.keys(state.errors().metrics ?? {})).toContain('series.0.metricKey');
      expect(Object.keys(state.errors().presentation ?? {})).toContain('name');
      state.applyValidationError(new ApiError(422, 'CRM_WIDGET_FILTER_INVALID', {
        path: ['querySpec.filterTree.children.0'], code: ['invalid'],
      }));
      expect(state.lastServerErrorStep()).toBe('scope');
      expect(Object.keys(state.errors().scope ?? {})).toContain('filterTree');
      expect(state.formError()).toBeNull();
    });

    it('draft conflict', async () => {
      fixture = setup.create(WidgetBuilder);
      fixture.componentRef.setInput('widgetId', widgetId);
      fixture.detectChanges();
      const state = fixture.debugElement.injector.get(BuilderState);
      await vi.waitFor(() => { fixture!.detectChanges(); expect(state.loading()).toBe(false); expect(state.widgetId()).toBe(widgetId); });
      state.patch({ name: 'My unsaved edits' });
      setup.stub.respond = (path) => {
        if (path.endsWith('/preview')) return widgetPreview();
        throw new ApiError(409, 'CRM_WIDGET_DRAFT_CONFLICT');
      };
      const save = state.saveDraft();
      const dialog = fixture.debugElement.query(By.directive(ConflictDialog)).componentInstance as ConflictDialog;
      await vi.waitFor(() => { fixture!.detectChanges(); expect(dialog.open()).toBe(true); });
      setup.stub.draft.widgetRevision = 8;
      setup.stub.draft.draft!.revision = 6;
      dialog.keepEditing.emit();
      fixture.detectChanges();
      expect(await save).toBe(false);
      expect(state.draft().name).toBe('My unsaved edits');
      expect(state.draftState()?.draft?.revision).toBe(6);
      expect(state.draftState()?.widgetRevision).toBe(8);
      expect(state.dirty()).toBe(true);
      const calls = setup.stub.recordedWrites().filter((call) => call.method === 'PATCH');
      expect(calls).toHaveLength(1);
      expect(calls[0].body).toMatchObject({ expectedWidgetRevision: 7, expectedDraftRevision: 5 });
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    });

    it.each(['CRM_WIDGET_DRAFT_BASE_CONFLICT', 'CRM_WIDGET_REVISION_CONFLICT'])('opens conflict recovery for %s', async (code) => {
      const state = await loadState();
      const resolve = vi.fn(async () => 'keep' as const);
      state.registerConflictResolver(resolve);
      setup.stub.respond = () => { throw new ApiError(409, code); };
      state.patch({ name: 'Kept' });
      expect(await state.saveDraft()).toBe(false);
      expect(resolve).toHaveBeenCalledOnce();
      expect(state.draft().name).toBe('Kept');
      expect(setup.stub.recordedWrites().filter((call) => call.method === 'PATCH')).toHaveLength(1);
    });

    it('retains create keys for uncertain retries and replaces the key when the body changes', async () => {
      const state = setup.state;
      await state.load(null);
      state.patch({ source: 'leads', name: 'New', visualizationType: 'METRIC_CARD' });
      state.patchQuery({ series: [{ metricKey: 'crm.leads.count' }] });
      setup.stub.respond = () => { throw networkError(); };
      expect(await state.saveDraft()).toBe(false);
      expect(await state.saveDraft()).toBe(false);
      state.patch({ name: 'Changed body' });
      expect(await state.saveDraft()).toBe(false);
      const calls = setup.stub.recordedWrites().filter((call) => call.path === '/widgets');
      expect(calls).toHaveLength(3);
      expect(calls[1].options.key).toBe(calls[0].options.key);
      expect(calls[1].body).toEqual(calls[0].body);
      expect(calls[2].options.key).not.toBe(calls[0].options.key);
      expect(state.dirty()).toBe(true);
    });

    it.each(['GW.IDEM.MISMATCH', 'CRM_WIDGET_PUBLISH_IDEMPOTENCY_MISMATCH'])('requires reload after %s', async (code) => {
      const state = await loadState();
      state.patch({ name: 'Keep this form' });
      setup.stub.respond = () => { throw new ApiError(409, code); };
      expect(await state.saveDraft()).toBe(false);
      expect(state.reloadRequired()).toBe(true);
      expect(await state.saveDraft()).toBe(false);
      expect(setup.stub.recordedWrites().filter((call) => call.method === 'PATCH')).toHaveLength(1);
      expect(state.draft().name).toBe('Keep this form');
      expect(setup.notify.error).toHaveBeenLastCalledWith(setup.transloco.translate('builder.requests.reloadRequired'));
    });

    it.each(['CRM_MODULE_DISABLED', 'CRM_SUBSCRIPTION_READ_ONLY', 'SEAT_OVER_CAPACITY_READ_ONLY'])('makes writes read-only after %s', async (code) => {
      const state = await loadState();
      setup.stub.respond = () => { throw new ApiError(403, code); };
      state.patch({ name: 'Kept' });
      expect(await state.saveDraft()).toBe(false);
      expect(state.readOnly()).toBe(true);
      expect(state.draft().name).toBe('Kept');
    });

    it('keeps the form and key after 401 and shows not saved', async () => {
      const state = await loadState();
      state.patch({ name: 'Session ended' });
      setup.stub.respond = () => { throw new ApiError(401, 'GW.AUTH.UNAUTHORIZED'); };
      await state.saveDraft(); await state.saveDraft();
      const calls = setup.stub.recordedWrites().filter((call) => call.method === 'PATCH');
      expect(calls[1].options.key).toBe(calls[0].options.key);
      expect(state.draft().name).toBe('Session ended');
      expect(setup.notify.error).toHaveBeenLastCalledWith(setup.transloco.translate('builder.requests.notSaved'));
    });

    it('does not read a private draft without update permission', async () => {
      setup.permissions.splice(setup.permissions.indexOf('crm.widgets.update'), 1);
      const state = setup.state;
      await state.load(widgetId);
      expect(state.readOnly()).toBe(true);
      expect(state.draft().name).toBe('Leads');
      expect(setup.stub.recordedReads().some((call) => call.path.endsWith('/draft'))).toBe(false);
      expect(await state.saveDraft()).toBe(false);
      expect(setup.stub.recordedWrites().some((call) => call.method === 'PATCH')).toBe(false);
    });

    it('refreshes every token while keeping local edits and respects a revoked edit grant', async () => {
      const state = await loadState();
      state.patch({ name: 'Local edits' });
      setup.stub.draft.widgetRevision = 9;
      setup.stub.draft.governanceRevision = 6;
      setup.stub.draft.draft!.revision = 8;
      await state.refreshRevisions();
      expect(state.draftState()).toMatchObject({ widgetRevision: 9, governanceRevision: 6, draft: { revision: 8 } });
      expect(state.draft().name).toBe('Local edits');
      setup.stub.detail.accessLevel = 'VIEW';
      const before = setup.stub.recordedReads().filter((call) => call.path.endsWith('/draft')).length;
      await state.refreshRevisions();
      expect(state.readOnly()).toBe(true);
      expect(setup.stub.recordedReads().filter((call) => call.path.endsWith('/draft'))).toHaveLength(before);
    });

    it('shows the owner limit of 500 as an action toast', () => {
      const state = setup.state;
      state.applyValidationError(new ApiError(422, 'CRM_WIDGET_OWNER_LIMIT'));
      expect(setup.notify.error.mock.calls.at(-1)?.[0]).toContain('500');
      expect(state.formError()).toBeNull();
    });

    it('preserves unloaded published notes and clears a loaded note only when edited', async () => {
      setup.stub.draft.draft = null;
      const state = await loadState();
      state.patch({ name: 'Renamed' });
      expect(await state.saveDraft()).toBe(true);
      const first = setup.stub.recordedWrites().find((call) => call.method === 'PATCH')!;
      expect(first.body).not.toHaveProperty('description');
      expect(first.body).not.toHaveProperty('internalNotes');
      expect(first.body).not.toHaveProperty('changeSummary');
      setup.stub.draft = widgetDraft();
      setup.stub.draft.draft!.description = 'Existing description';
      await state.reload();
      state.patch({ description: '' });
      expect(await state.saveDraft()).toBe(true);
      expect(setup.stub.recordedWrites().filter((call) => call.method === 'PATCH').at(-1)?.body)
        .toMatchObject({ description: null });
    });

    it('can publish a draft just created without granting update permission', async () => {
      setup.permissions.splice(setup.permissions.indexOf('crm.widgets.update'), 1);
      setup.stub.draft.activeVersionNumber = null;
      setup.stub.detail.status = 'DRAFT';
      const state = setup.state;
      await state.load(null);
      state.patch({ source: 'leads', name: 'New widget', visualizationType: 'METRIC_CARD' });
      state.patchQuery({ series: [{ metricKey: 'crm.leads.count' }] });
      expect(await state.saveDraft()).toBe(true);
      expect(state.canSave()).toBe(false);
      expect(state.canPublish()).toBe(true);
      expect(state.publishReady()).toBe(true);
    });

    it.each([
      [404, 'CRM_WIDGET_NOT_FOUND', 'not-found'], [403, 'CRM_SCOPED_PERMISSION_DENIED', 'forbidden'],
      [0, 'NETWORK_ERROR', 'load-failure'], [500, 'COMMON.GENERIC.INTERNAL_ERROR', 'load-failure'],
      [503, 'CRM_TARGET_SOURCE_NOT_READY', 'provisioning'], [503, 'CRM_ANALYTICS_SOURCE_UNAVAILABLE', 'provisioning'],
      [503, 'CRM_DASHBOARD_BLUEPRINTS_NOT_READY', 'provisioning'], [503, 'CRM_TEAM_SCOPE_NOT_READY', 'provisioning'],
      [503, 'CRM_INQUIRY_SOURCE_NOT_READY', 'provisioning'],
    ])('keeps read state and reference for %s %s', async (status, code, kind) => {
      setup.stub.readFailures.set(`/widgets/${widgetId}`, new ApiError(Number(status), String(code), undefined, { correlationId: 'reference-1' }));
      const state = setup.state;
      await state.load(widgetId);
      expect(state.loadError()).toBe(kind);
      expect(state.readFailure()?.correlationId).toBe('reference-1');
    });
  });
}

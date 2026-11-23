import { TestBed } from '@angular/core/testing';
import { TranslocoLoader, TranslocoService, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Injectable } from '@angular/core';
import type { ManualReference } from '../../../../../shared/widgets/dashboard/analytics.model';
import { ApiError } from '../../../../../core/api/api-errors';
import { bindCrmHttpForTest, crmQueries } from '../../../shared/crm-http';
import { WidgetHttpStub } from './builder-test-support';
import { RUN_CONCURRENCY_CODE } from '../../../../../shared/widgets/dashboard/panel-state';
import builderEn from '../../../../../../../public/i18n/crm-widget-builder/en.json';
import analyticsEn from '../../../../../../../public/i18n/analytics/en.json';
import { BuilderState } from './builder-state';

@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({} as Translation);
  }
}

function ref(seriesIndex: number, label: string): ManualReference {
  return { kind: 'MANUAL', seriesIndex, unit: 'COUNT', value: 1, label };
}

describe('BuilderState', () => {
  let state: BuilderState;
  let stub: WidgetHttpStub;
  let dispose: () => void;

  beforeEach(() => {
    stub = new WidgetHttpStub();
    dispose = bindCrmHttpForTest(stub);
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({ config: { availableLangs: ['ar', 'en'], defaultLang: 'en' }, loader: EmptyLoader }),
        BuilderState,
      ],
    });
    TestBed.inject(TranslocoService).setTranslation({ builder: builderEn, analytics: analyticsEn }, 'en');
    state = TestBed.inject(BuilderState);
  });

  afterEach(() => {
    vi.useRealTimers();
    crmQueries().clear();
    dispose();
    TestBed.resetTestingModule();
  });

  describe('series removal re-indexes references', () => {
    const a = { metricKey: 'crm.leads.count' };
    const b = { metricKey: 'crm.leads.qualified' };
    const c = { metricKey: 'crm.leads.lost' };

    beforeEach(() => {
      state.patchQuery({ series: [a, b, c] });
      state.patchDisplay({ references: [ref(0, 'A'), ref(1, 'B'), ref(2, 'C')] });
    });

    it('drops the removed series reference and shifts later ones down', () => {
      state.patchQuery({ series: [a, c] });
      expect(state.draft().displaySpec.references?.map((r) => [r.label, r.seriesIndex])).toEqual([
        ['A', 0],
        ['C', 1],
      ]);
    });

    it('follows a reordered series to its new position', () => {
      state.patchQuery({ series: [c, a, b] });
      expect(state.draft().displaySpec.references?.map((r) => [r.label, r.seriesIndex])).toEqual([
        ['A', 1],
        ['B', 2],
        ['C', 0],
      ]);
    });

    it('keeps the position of a series edited in place and refreshes its unit', () => {
      const ratio = { metricKey: 'crm.leads.qualified', calculation: { operation: 'RATIO' as const, operandMetricKey: 'crm.leads.count' } };
      state.patchQuery({ series: [a, ratio, c] });
      const refs = state.draft().displaySpec.references!;
      expect(refs.map((r) => [r.label, r.seriesIndex, r.unit])).toEqual([
        ['A', 0, 'COUNT'],
        ['B', 1, 'RATIO'],
        ['C', 2, 'COUNT'],
      ]);
    });

    it('removes the references key when every referenced series is gone', () => {
      state.patchQuery({ series: [] });
      expect('references' in state.draft().displaySpec).toBe(false);
    });
  });

  it('drops the filter tree when a calculation operand leaves the record family', () => {
    state.patchQuery({
      series: [{ metricKey: 'crm.leads.count' }],
      filterTree: { kind: 'AND', children: [{ field: 'leads.rating', operator: 'GT', value: 3 }] },
    });
    expect(state.draft().querySpec.filterTree).toBeDefined();
    state.patchQuery({
      series: [{ metricKey: 'crm.leads.count', calculation: { operation: 'RATIO', operandMetricKey: 'crm.opportunities.count' } }],
    });
    expect(state.draft().querySpec.filterTree).toBeUndefined();
  });

  describe('preview errors', () => {
    it('maps a concurrency refusal (429) to the busy state without polling', async () => {
      vi.useFakeTimers();
      stub.respond = () => { throw new ApiError(429, RUN_CONCURRENCY_CODE, { retryAfterSeconds: ['9'] }); };

      state.patchQuery({ series: [{ metricKey: 'crm.leads.count' }] });
      state.refreshPreview();
      expect(state.preview().status).toBe('loading');

      await vi.advanceTimersByTimeAsync(0);
      expect(state.preview()).toMatchObject({ status: 'ERROR', reasonCode: RUN_CONCURRENCY_CODE, execution: null });
      // Not a server field error and not a form banner.
      expect(state.errors()).toEqual({});
      expect(state.formError()).toBeNull();

      await vi.advanceTimersByTimeAsync(120_000);
      expect(stub.recordedWrites()).toHaveLength(1);
    });

    it('maps any other failure to UNAVAILABLE with its own code, not busy', async () => {
      vi.useFakeTimers();
      stub.respond = () => { throw new ApiError(503, 'GW.UPSTREAM.UNAVAILABLE'); };
      state.patchQuery({ series: [{ metricKey: 'crm.leads.count' }] });
      state.refreshPreview();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(state.preview()).toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'GW.UPSTREAM.UNAVAILABLE' });
    });
  });
});

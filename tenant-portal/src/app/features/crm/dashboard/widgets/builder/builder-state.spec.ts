import { TestBed } from '@angular/core/testing';
import { TranslocoLoader, type Translation, provideTransloco } from '@jsverse/transloco';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Injectable } from '@angular/core';
import type { ManualReference } from '../../../../../shared/widgets/dashboard/analytics.model';
import { FAKE_FAIL, withRunSlot } from '../../../../../shared/widgets/dashboard/analytics-api';
import { RUN_CONCURRENCY_CODE } from '../../../../../shared/widgets/dashboard/panel-state';
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({ config: { availableLangs: ['ar', 'en'], defaultLang: 'en' }, loader: EmptyLoader }),
        BuilderState,
      ],
    });
    state = TestBed.inject(BuilderState);
  });

  afterEach(() => {
    vi.useRealTimers();
    FAKE_FAIL.nextCall = false;
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
    it('maps a concurrency refusal (429) to the busy state after retries run out', async () => {
      vi.useFakeTimers();
      const releases: (() => void)[] = [];
      const blockers = Array.from({ length: 3 }, () =>
        withRunSlot(() => new Promise<void>((resolve) => releases.push(resolve))),
      );

      state.patchQuery({ series: [{ metricKey: 'crm.leads.count' }] });
      state.refreshPreview();
      expect(state.preview().status).toBe('loading');

      await vi.advanceTimersByTimeAsync(100);
      expect(state.preview()).toMatchObject({ status: 'loading', retrying: true });

      await vi.advanceTimersByTimeAsync(10_000);
      expect(state.preview()).toMatchObject({ status: 'ERROR', reasonCode: RUN_CONCURRENCY_CODE, execution: null });
      // Not a server field error and not a form banner.
      expect(state.errors()).toEqual({});
      expect(state.formError()).toBeNull();

      releases.forEach((r) => r());
      await Promise.all(blockers);
    });

    it('maps any other failure to UNAVAILABLE with its own code, not busy', async () => {
      vi.useFakeTimers();
      FAKE_FAIL.nextCall = true;
      state.patchQuery({ series: [{ metricKey: 'crm.leads.count' }] });
      state.refreshPreview();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(state.preview()).toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'GW.UPSTREAM.UNAVAILABLE' });
    });
  });
});

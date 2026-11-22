import { describe, expect, it } from 'vitest';
import type { GovernedTargetResult, WidgetExecution } from '../analytics.model';
import { applyFakeGovernedTarget, applyFakeTopN, applyFakeWinRate } from './fake-closure';

const scalar = (value: number): WidgetExecution => ({
  widgetId: 'w',
  state: 'READY',
  shape: 'SCALAR',
  value,
  series: [],
  meta: { generatedAt: '2026-11-21T09:00:00Z', warnings: [] },
});

describe('applyFakeTopN', () => {
  it('folds the tail into OTHER with foldedBucketCount and keeps UNSPECIFIED last', () => {
    const exec: WidgetExecution = {
      ...scalar(0),
      shape: 'CATEGORY',
      series: [
        {
          key: 's',
          label: 's',
          unit: 'COUNT',
          axis: 'LEFT',
          points: [
            { key: 'a', label: 'a', value: 10 },
            { key: 'UNSPECIFIED', label: 'u', value: 50 },
            { key: 'b', label: 'b', value: 7 },
            { key: 'c', label: 'c', value: 3 },
            { key: 'd', label: 'd', value: 2 },
          ],
        },
      ],
    };
    const points = applyFakeTopN(exec, 2, true).series[0].points;
    expect(points.map((p) => p.key)).toEqual(['a', 'b', 'OTHER', 'UNSPECIFIED']);
    expect(points[2].value).toBe(5);
    expect(points[2].meta?.['foldedBucketCount']).toBe(2);
  });
});

describe('applyFakeWinRate', () => {
  it('carries the pooled scalar value and numerator/denominator on a dimensioned result', () => {
    const out = applyFakeWinRate(scalar(0), 'source', 3, true);
    const points = out.series[0].points;
    expect(out.value).not.toBeNull();
    expect(out.details?.['denominator']).toBeGreaterThan(0);
    expect(points.at(-1)?.key).toBe('UNSPECIFIED');
    const other = points.find((p) => p.key === 'OTHER');
    expect(other?.meta?.['numerator']).toBeGreaterThan(0);
    expect(other?.meta?.['foldedBucketCount']).toBeGreaterThan(0);
  });
});

describe('applyFakeGovernedTarget', () => {
  it('returns decimal-string amounts and a working pace for a money target', () => {
    const out = applyFakeGovernedTarget(scalar(400000), {
      unit: 'MONEY',
      currencyCode: 'EGP',
      displayCurrency: 'EGP',
      targetValue: '1200000.00',
    });
    const gt = out.governedTarget as unknown as GovernedTargetResult;
    expect(gt.targetMeasure).toBe('MONEY');
    expect(gt.amounts?.targetValue).toBe('1200000.00');
    expect(gt.amounts?.remainingValue).toBe('800000.00');
    expect(gt.workingPace?.requiredPerWorkday).toBe('133333.33');
    expect(gt.elapsedPace?.state).toBe('READY');
  });

  it('marks the elapsed pace unavailable with CALENDAR_HOURS_MISSING and still shows the target', () => {
    const out = applyFakeGovernedTarget(scalar(400000), {
      unit: 'MONEY',
      currencyCode: 'EGP',
      displayCurrency: 'EGP',
      targetValue: '1200000.00',
      scenario: 'PACE_UNAVAILABLE',
    });
    const gt = out.governedTarget as unknown as GovernedTargetResult;
    expect(gt.amounts?.targetValue).toBe('1200000.00');
    expect(gt.elapsedPace).toEqual({ state: 'UNAVAILABLE', reason: 'CALENDAR_HOURS_MISSING', workingDays: null, elapsedWorkingDays: null });
  });

  it('is TARGET_NOT_SET with OTHER_CURRENCIES when the target currency differs from the display currency', () => {
    const out = applyFakeGovernedTarget(scalar(10), {
      unit: 'MONEY',
      currencyCode: 'EGP',
      displayCurrency: 'USD',
      targetValue: '1200000.00',
    });
    const gt = out.governedTarget as unknown as GovernedTargetResult;
    expect(gt.state).toBe('TARGET_NOT_SET');
    expect(gt.amounts).toBeNull();
    expect(out.meta.warnings).toEqual(expect.arrayContaining(['TARGET_NOT_SET', 'OTHER_CURRENCIES']));
  });

  it('gives a rate target a decimal-string gap in percentage points and no pace', () => {
    const out = applyFakeGovernedTarget(scalar(27.5), { unit: 'PERCENT', displayCurrency: 'EGP', targetValue: '35.00' });
    const gt = out.governedTarget as unknown as GovernedTargetResult;
    expect(gt.targetMeasure).toBe('RATE');
    expect(gt.gapPercentagePoints).toBe('-7.5');
    expect(gt.elapsedPace?.state).toBe('NOT_PRORATED');
    expect(gt.workingPace).toBeNull();
  });
});

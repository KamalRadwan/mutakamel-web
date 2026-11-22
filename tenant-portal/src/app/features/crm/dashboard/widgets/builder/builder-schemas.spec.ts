import { describe, expect, it } from 'vitest';
import type { Catalog, CatalogMetric, FilterGroup, FilterLeaf } from '../../../../../shared/widgets/dashboard/analytics.model';
import { compatibleOperands, isNaturalDimension, validateStepWithZod, type BuilderDraft } from './builder-schemas';

function metric(key: string, overrides: Partial<CatalogMetric> = {}): CatalogMetric {
  return {
    key,
    availability: 'AVAILABLE',
    labelAr: key,
    labelEn: key,
    unit: 'COUNT',
    shape: 'SCALAR',
    dimensions: ['none', 'stage', 'owner', 'status'],
    supportsPeriodComparison: true,
    timeModel: 'EVENT',
    dateField: 'createdAt',
    formulaKey: key,
    supportedFilters: [],
    comparisonTypes: ['NONE'],
    currencyPolicy: 'NOT_APPLICABLE',
    accessResources: ['leads'],
    emptyValuePolicy: 'ZERO',
    readiness: { basis: 'EVENT', sources: [] },
    ...overrides,
  };
}

function catalog(metrics: CatalogMetric[], dimensions: Catalog['dimensions'] = []): Catalog {
  return { metrics, dimensions, visualizations: [] } as unknown as Catalog;
}

function draft(querySpec: Partial<BuilderDraft['querySpec']>): BuilderDraft {
  return {
    source: 'leads',
    name: 'W',
    description: '',
    visualizationType: null,
    querySpec: { series: [{ metricKey: 'crm.leads.count' }], filters: { datePreset: 'CURRENT_MONTH' }, ...querySpec },
    displaySpec: {},
  };
}

describe('compatibleOperands', () => {
  const base = metric('crm.leads.count');
  const cat = catalog([
    base,
    metric('crm.leads.qualified'),
    metric('crm.opportunities.count'),
    metric('crm.activities.count'),
    metric('crm.leads.value', { unit: 'MONEY' }),
    metric('crm.leads.trend', { shape: 'TIME_SERIES' }),
    metric('crm.leads.snapshot', { timeModel: 'SNAPSHOT' }),
    metric('crm.leads.current', { readiness: { basis: 'CURRENT', sources: [] } }),
    metric('crm.leads.retired', { availability: 'RETIRED' }),
    metric('crm.leads.report', { reportOnly: true }),
  ]);

  it('offers only same-family metrics of the same shape, unit, time model and basis', () => {
    expect(compatibleOperands(base, cat).map((m) => m.key)).toEqual(['crm.leads.qualified']);
  });

  it('never offers another record family even when everything else matches', () => {
    const opp = cat.metrics.find((m) => m.key === 'crm.opportunities.count')!;
    expect(compatibleOperands(opp, cat)).toEqual([]);
  });

  it('refuses without a catalog and for non-scalar/time-series or non count/money metrics', () => {
    expect(compatibleOperands(base, null)).toEqual([]);
    expect(compatibleOperands(metric('crm.leads.rate', { unit: 'PERCENT' }), cat)).toEqual([]);
    expect(compatibleOperands(metric('crm.leads.rank', { shape: 'CATEGORY' as CatalogMetric['shape'] }), cat)).toEqual([]);
  });

  it('metrics step refuses a cross-family calculation operand', () => {
    const issues = validateStepWithZod(
      'metrics',
      draft({
        dimension: { key: 'none' },
        series: [{ metricKey: 'crm.leads.count', calculation: { operation: 'RATIO', operandMetricKey: 'crm.opportunities.count' } }],
      }),
      cat,
    );
    expect(issues).toContainEqual({ path: 'series.0.calculation', code: 'calculationIncompatible' });
  });
});

describe('Top-N on NATURAL dimensions', () => {
  const m = metric('crm.leads.count');

  it('isNaturalDimension reads only the catalog cardinality, never the key name', () => {
    const cat = catalog([m], [
      { key: 'stage', grains: [], cardinality: 'OPEN' },
      { key: 'owner', grains: [], cardinality: 'NATURAL' },
    ]);
    expect(isNaturalDimension(cat, 'owner')).toBe(true);
    expect(isNaturalDimension(cat, 'stage')).toBe(false);
    expect(isNaturalDimension(cat, 'status')).toBe(false); // not in catalog: no name-based default
    expect(isNaturalDimension(null, 'owner')).toBe(false);
    expect(isNaturalDimension(cat, undefined)).toBe(false);
  });

  it('refuses topN on a NATURAL dimension', () => {
    const cat = catalog([m], [{ key: 'owner', grains: [], cardinality: 'NATURAL' }]);
    const issues = validateStepWithZod('metrics', draft({ dimension: { key: 'owner', topN: 5 } }), cat);
    expect(issues).toContainEqual({ path: 'dimension', code: 'topNNotAllowed' });
  });

  it('allows topN on an OPEN dimension even if its key sounds bounded', () => {
    const cat = catalog([m], [{ key: 'stage', grains: [], cardinality: 'OPEN' }]);
    const issues = validateStepWithZod('metrics', draft({ dimension: { key: 'stage', topN: 5 } }), cat);
    expect(issues.find((i) => i.path === 'dimension')).toBeUndefined();
  });

  it('refuses breakdown topN, limit or groupRest on a NATURAL dimension', () => {
    const cat = catalog([m], [{ key: 'status', grains: [], cardinality: 'NATURAL' }]);
    for (const breakdown of [{ key: 'status', topN: 3 }, { key: 'status', limit: 3 }, { key: 'status', groupRest: true }]) {
      const issues = validateStepWithZod('metrics', draft({ dimension: { key: 'owner' }, breakdown }), cat);
      expect(issues).toContainEqual({ path: 'breakdown', code: 'topNNotAllowed' });
    }
  });

  it('range-checks topN on an OPEN dimension', () => {
    const cat = catalog([m], [{ key: 'owner', grains: [], cardinality: 'OPEN' }]);
    const issues = validateStepWithZod('metrics', draft({ dimension: { key: 'owner', topN: 51 } }), cat);
    expect(issues).toContainEqual({ path: 'dimension', code: 'range', params: { min: 1, max: 50 } });
  });
});

describe('scope step filter tree', () => {
  const tree: FilterGroup = { kind: 'AND', children: [{ field: 'leads.rating', operator: 'GT', value: 3 }] };

  it('accepts a leads tree on leads series', () => {
    expect(validateStepWithZod('scope', draft({ filterTree: tree }), null)).toEqual([]);
  });

  it('refuses the tree when a calculation operand is from another family', () => {
    const issues = validateStepWithZod(
      'scope',
      draft({
        filterTree: tree,
        series: [{ metricKey: 'crm.leads.count', calculation: { operation: 'RATIO', operandMetricKey: 'crm.opportunities.count' } }],
      }),
      null,
    );
    expect(issues).toEqual([{ path: 'filterTree', code: 'filterTreeUnsupported' }]);
  });

  it('refuses a tree deeper than 4 group levels', () => {
    let deep: FilterGroup = { kind: 'AND', children: [{ field: 'leads.rating', operator: 'EQ', value: 1 } as FilterLeaf] };
    for (let i = 0; i < 4; i++) deep = { kind: 'AND', children: [deep] };
    const issues = validateStepWithZod('scope', draft({ filterTree: deep }), null);
    expect(issues).toEqual([{ path: 'filterTree', code: 'filterTreeTooDeep' }]);
  });
});

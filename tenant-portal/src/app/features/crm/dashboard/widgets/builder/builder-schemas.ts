import {
  type RefinementCtx,
  unknown,
} from 'zod';
import type {
  Catalog,
  CatalogMetric,
  CatalogVisualization,
  DatePreset,
  DisplaySpec,
  QuerySpec,
  SeriesUnit,
  Visualization,
} from '../../../../../shared/widgets/dashboard/analytics.model';
import {
  FILTER_TREE_LIMITS,
  countFilterLeaves,
  filterTreeBytes,
  filterTreeDepth,
  filterTreeMetricKeys,
  filterTreeSupported,
  maxInListLength,
} from './filter-tree';

export const STEP_ORDER = [
  'data',
  'metrics',
  'scope',
  'compare',
  'presentation',
  'review',
] as const;

export type StepId = (typeof STEP_ORDER)[number];

export const BUILDER_SOURCES = [
  'leads',
  'opportunities',
  'activities',
  'customer_profiles',
  'documents',
] as const;

export type BuilderSource = (typeof BUILDER_SOURCES)[number];

export interface BuilderDraft {
  source: BuilderSource | null;
  name: string;
  description: string;
  visualizationType: Visualization | null;
  querySpec: QuerySpec;
  displaySpec: DisplaySpec;
  changeSummary?: string;
  internalNotes?: string;
}

export const DATE_PRESETS: readonly DatePreset[] = [
  'TODAY',
  'CURRENT_WEEK',
  'CURRENT_MONTH',
  'CURRENT_QUARTER',
  'CURRENT_YEAR',
  'LAST_MONTH',
  'LAST_3_COMPLETE_MONTHS',
  'LAST_QUARTER',
  'LAST_YEAR',
  'LAST_7_DAYS',
  'LAST_30_DAYS',
  'LAST_90_DAYS',
  'CUSTOM',
] as const;

export const TIME_GRAINS = ['DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR'] as const;
export const LEGEND_POSITIONS = ['top', 'bottom', 'start', 'end', 'none'] as const;
export const NUMBER_FORMATS = [
  'auto',
  'full',
  'duration-auto',
  'duration-minutes',
  'duration-hours',
  'duration-days',
] as const;

export interface ValidationIssue {
  path: string;
  code: string;
  params?: Record<string, unknown>;
}

const METRIC_KEY_RE = /^crm\.[a-z0-9_.]+$/;
const DIMENSION_KEY_RE = /^[a-z_]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodeIssue(code: string, params?: Record<string, unknown>): string {
  return JSON.stringify(params ? { code, params } : { code });
}

function addIssue(
  ctx: RefinementCtx,
  path: (string | number)[],
  code: string,
  params?: Record<string, unknown>,
): void {
  ctx.addIssue({
    code: 'custom',
    path,
    message: encodeIssue(code, params),
  });
}

function decodeIssueMessage(raw: string): { code: string; params?: Record<string, unknown> } {
  try {
    const parsed = JSON.parse(raw) as { code?: unknown; params?: unknown };
    if (typeof parsed.code === 'string') {
      return {
        code: parsed.code,
        ...(parsed.params && typeof parsed.params === 'object'
          ? { params: parsed.params as Record<string, unknown> }
          : {}),
      };
    }
  } catch {
    // plain message fallback
  }
  return { code: raw || 'required' };
}

/** Enum or bounded dimensions (stage, status, type, ...): Top-N and group-rest are refused on them. */
export function isNaturalDimension(catalog: Catalog | null, key: string | undefined): boolean {
  return Boolean(key && catalog?.dimensions.find((d) => d.key === key)?.cardinality === 'NATURAL');
}

export function metricMatchesSource(metric: CatalogMetric, source: BuilderSource): boolean {
  // A reportOnly metric (derived from the result shape) is never offered in the builder.
  if (metric.reportOnly) return false;
  if (metric.requiredResource) {
    return metric.requiredResource === source;
  }
  return (metric.accessResources as readonly string[]).includes(source);
}

export function inferSourceFromQuery(
  querySpec: QuerySpec,
  catalog: Catalog | null,
): BuilderSource | null {
  const firstKey = querySpec.series?.[0]?.metricKey;
  if (!firstKey) return null;

  const metric = catalog?.metrics.find((m) => m.key === firstKey);
  if (metric) {
    if (metric.requiredResource) return metric.requiredResource;
    const match = metric.accessResources.find((r) => r !== 'targets');
    if (match && (BUILDER_SOURCES as readonly string[]).includes(match)) {
      return match as BuilderSource;
    }
  }

  if (firstKey.startsWith('crm.leads.') || firstKey.startsWith('crm.alerts.')) return 'leads';
  if (firstKey.startsWith('crm.opportunities.') || firstKey.startsWith('crm.team.')) {
    return 'opportunities';
  }
  if (firstKey.startsWith('crm.activities.')) return 'activities';
  if (firstKey.startsWith('crm.customers.') || firstKey.startsWith('crm.customer_profiles.')) {
    return 'customer_profiles';
  }
  if (firstKey.startsWith('crm.documents.')) return 'documents';
  return null;
}

export function isVisualizationCompatibleWithMetric(
  viz: CatalogVisualization,
  metric: CatalogMetric,
): boolean {
  if (metric.rowKind && metric.visualizations?.length) {
    return metric.visualizations.includes(viz.key);
  }
  if (metric.visualizations?.length) {
    return metric.visualizations.includes(viz.key);
  }
  return viz.shapes.includes(metric.shape);
}

export type DatasetBasis = 'PERIOD' | 'BRANCH' | 'COMPANY' | 'TEAM';

/** Metric family = record family of the key (crm.leads, crm.opportunities, ...). A calculation stays in one family. */
function metricFamily(key: string): string {
  return key.split('.').slice(0, 2).join('.');
}

export function compatibleOperands(
  metric: CatalogMetric,
  catalog: Catalog | null,
  visualizationType?: Visualization | null,
): CatalogMetric[] {
  if (!catalog) return [];
  if (metric.shape !== 'SCALAR' && metric.shape !== 'TIME_SERIES') return [];
  if (metric.unit !== 'COUNT' && metric.unit !== 'MONEY') return [];

  const viz = visualizationType ? findVisualization(catalog, visualizationType) : undefined;
  const family = metricFamily(metric.key);

  return catalog.metrics.filter((candidate) => {
    if (candidate.key === metric.key) return false;
    if (candidate.availability !== 'AVAILABLE' || candidate.reportOnly) return false;
    if (candidate.shape !== metric.shape) return false;
    if (candidate.unit !== metric.unit) return false;
    if (metricFamily(candidate.key) !== family) return false;
    if (candidate.timeModel !== metric.timeModel) return false;
    if (candidate.readiness.basis !== metric.readiness.basis) return false;
    if (viz && !isVisualizationCompatibleWithMetric(viz, candidate)) return false;
    return true;
  });
}

export function effectiveSeriesUnit(
  seriesItem: QuerySpec['series'][number] | undefined,
  catalog: Catalog | null,
): SeriesUnit {
  if (seriesItem?.calculation?.operation === 'RATIO') {
    return 'RATIO';
  }
  const metric = seriesItem?.metricKey ? findMetric(catalog, seriesItem.metricKey) : undefined;
  return metric?.unit ?? 'COUNT';
}

export function allowedDatasetBasesForMetric(metric: CatalogMetric): readonly DatasetBasis[] {
  if (metric.datasetComparison?.bases?.length) {
    return metric.datasetComparison.bases;
  }
  return ['PERIOD', 'BRANCH', 'COMPANY'];
}

export function defaultVisualizationForDraft(
  draft: BuilderDraft,
  catalog: Catalog | null,
): Visualization {
  if (draft.visualizationType) return draft.visualizationType;
  const firstKey = draft.querySpec.series[0]?.metricKey;
  const firstMetric = firstKey ? catalog?.metrics.find((m) => m.key === firstKey) : undefined;
  if (!firstMetric || !catalog) return 'LINE';

  const lineViz = catalog.visualizations.find((v) => v.key === 'LINE');
  if (lineViz && isVisualizationCompatibleWithMetric(lineViz, firstMetric)) {
    return 'LINE';
  }
  const compatible = catalog.visualizations.find((v) =>
    isVisualizationCompatibleWithMetric(v, firstMetric),
  );
  return compatible?.key ?? firstMetric.visualizations?.[0] ?? 'LINE';
}

function findMetric(catalog: Catalog | null, key: string): CatalogMetric | undefined {
  return catalog?.metrics.find((m) => m.key === key);
}

function findVisualization(
  catalog: Catalog | null,
  key: Visualization | null,
): CatalogVisualization | undefined {
  if (!key) return undefined;
  return catalog?.visualizations.find((v) => v.key === key);
}

function createDataSchema() {
  return unknown().superRefine((val, ctx) => {
    const draft = val as BuilderDraft;
    if (!draft.source || !(BUILDER_SOURCES as readonly string[]).includes(draft.source)) {
      addIssue(ctx, ['source'], 'required');
    }
  });
}

function createMetricsSchema(catalog: Catalog | null) {
  return unknown().superRefine((val, ctx) => {
    const draft = val as BuilderDraft;
    const series = draft.querySpec?.series ?? [];
    const viz = findVisualization(catalog, draft.visualizationType);
    const minSeries = viz ? viz.minSeries : 1;
    const maxSeries = viz ? Math.min(4, viz.maxSeries) : 4;

    if (series.length === 0) {
      addIssue(ctx, ['series'], 'required');
      return;
    }

    if (series.length < minSeries || series.length > maxSeries) {
      addIssue(ctx, ['series'], 'seriesCount', { min: minSeries, max: maxSeries });
    }

    const resolvedMetrics: CatalogMetric[] = [];
    for (let i = 0; i < series.length; i++) {
      const item = series[i];
      if (!item?.metricKey || !METRIC_KEY_RE.test(item.metricKey)) {
        addIssue(ctx, ['series', i, 'metricKey'], 'metricInvalid');
        continue;
      }
      if (catalog) {
        const metric = findMetric(catalog, item.metricKey);
        if (!metric) {
          addIssue(ctx, ['series', i, 'metricKey'], 'metricInvalid');
          continue;
        }
        if (metric.availability !== 'AVAILABLE') {
          addIssue(ctx, ['series', i, 'metricKey'], 'metricUnavailable');
          continue;
        }
        resolvedMetrics.push(metric);

        if (item.calculation) {
          const op = item.calculation.operation;
          if (op !== 'RATIO' && op !== 'DIFFERENCE') {
            addIssue(ctx, ['series', i, 'calculation'], 'calculationIncompatible');
          } else if (!item.calculation.operandMetricKey) {
            addIssue(ctx, ['series', i, 'calculation', 'operandMetricKey'], 'required');
          } else {
            const allowed = compatibleOperands(metric, catalog, draft.visualizationType);
            if (!allowed.some((cand) => cand.key === item.calculation!.operandMetricKey)) {
              addIssue(ctx, ['series', i, 'calculation'], 'calculationIncompatible');
            }
          }
        }
      } else if (item.calculation && !item.calculation.operandMetricKey) {
        addIssue(ctx, ['series', i, 'calculation', 'operandMetricKey'], 'required');
      }
    }

    if (viz && !viz.supportsMixedUnits && resolvedMetrics.length > 1) {
      const units = new Set(resolvedMetrics.map((m) => m.unit));
      if (units.size > 1) {
        addIssue(ctx, ['series'], 'unitsMixed');
      }
    }

    if (viz && !viz.supportsDualAxis && series.some((s) => s.axis === 'RIGHT')) {
      addIssue(ctx, ['series'], 'axisNotSupported');
    }

    const firstMetric = resolvedMetrics[0];
    const dim = draft.querySpec?.dimension;
    if (dim?.key) {
      if (dim.key.length > 40 || !DIMENSION_KEY_RE.test(dim.key)) {
        addIssue(ctx, ['dimension'], 'dimensionInvalid');
      } else if (firstMetric && !firstMetric.dimensions.includes(dim.key)) {
        addIssue(ctx, ['dimension'], 'dimensionInvalid');
      }

      if (dim.key === 'time') {
        if (!dim.grain || !(TIME_GRAINS as readonly string[]).includes(dim.grain)) {
          addIssue(ctx, ['dimension'], 'grainRequired');
        } else if (
          resolvedMetrics.some((m) => m.requiredGrain === 'DAY') &&
          dim.grain !== 'DAY'
        ) {
          addIssue(ctx, ['dimension'], 'grainDayRequired');
        }
      }

      if (dim.topN !== undefined && isNaturalDimension(catalog, dim.key)) {
        addIssue(ctx, ['dimension'], 'topNNotAllowed');
      } else if (dim.topN !== undefined) {
        if (!Number.isInteger(dim.topN) || dim.topN < 1 || dim.topN > 50) {
          addIssue(ctx, ['dimension'], 'range', { min: 1, max: 50 });
        }
      }
    } else if (
      firstMetric &&
      firstMetric.dimensions.length > 0 &&
      !firstMetric.dimensions.includes('none')
    ) {
      addIssue(ctx, ['dimension'], 'required');
    }

    if (
      resolvedMetrics.some((m) => m.requiredGrain === 'DAY') &&
      firstMetric?.dimensions.includes('time') &&
      dim?.key !== 'time'
    ) {
      addIssue(ctx, ['dimension'], 'grainDayRequired');
    }

    const brk = draft.querySpec?.breakdown;
    if (brk?.key && brk.key !== 'none') {
      if (
        brk.key.length > 40 ||
        !DIMENSION_KEY_RE.test(brk.key) ||
        (firstMetric && !firstMetric.dimensions.includes(brk.key)) ||
        brk.key === dim?.key
      ) {
        addIssue(ctx, ['breakdown'], 'dimensionInvalid');
      }
      const topN = brk.topN ?? brk.limit;
      if ((topN !== undefined || brk.groupRest) && isNaturalDimension(catalog, brk.key)) {
        addIssue(ctx, ['breakdown'], 'topNNotAllowed');
      } else if (topN !== undefined && (!Number.isInteger(topN) || topN < 1 || topN > 50)) {
        addIssue(ctx, ['breakdown'], 'range', { min: 1, max: 50 });
      }
    }
  });
}

function createScopeSchema() {
  return unknown().superRefine((val, ctx) => {
    const draft = val as BuilderDraft;
    const filters = draft.querySpec?.filters;
    const preset = filters?.datePreset;

    if (!preset || !(DATE_PRESETS as readonly string[]).includes(preset)) {
      addIssue(ctx, ['filters', 'datePreset'], 'required');
    } else if (preset === 'CUSTOM') {
      const from = filters?.dateFrom?.trim() ?? '';
      const to = filters?.dateTo?.trim() ?? '';
      if (!from || !to) {
        addIssue(ctx, ['filters', 'datePreset'], 'dateRangeRequired');
      } else if (from.slice(0, 10) > to.slice(0, 10)) {
        addIssue(ctx, ['filters', 'datePreset'], 'dateRangeOrder');
      }
    }

    if (filters?.branchId) {
      if (!UUID_RE.test(filters.branchId)) {
        addIssue(ctx, ['filters', 'branchId'], 'invalidUuid');
      }
    }

    if (filters?.staleDays !== undefined) {
      if (!Number.isInteger(filters.staleDays) || filters.staleDays < 1 || filters.staleDays > 365) {
        addIssue(ctx, ['filters', 'staleDays'], 'range', { min: 1, max: 365 });
      }
    }

    if (filters?.closingWindowDays !== undefined) {
      if (
        !Number.isInteger(filters.closingWindowDays) ||
        filters.closingWindowDays < 1 ||
        filters.closingWindowDays > 365
      ) {
        addIssue(ctx, ['filters', 'closingWindowDays'], 'range', { min: 1, max: 365 });
      }
    }

    const binding = draft.querySpec?.scopeBinding;
    if (binding?.kind === 'FIXED_REQUESTED') {
      const c = binding.ceiling;
      const count =
        (c?.companyIds?.length ?? 0) +
        (c?.branchIds?.length ?? 0) +
        (c?.teamIds?.length ?? 0) +
        (c?.ownerUserIds?.length ?? 0);
      if (count === 0) {
        addIssue(ctx, ['scopeBinding'], 'scopeCeilingRequired');
      }
    }

    const filterTree = draft.querySpec?.filterTree;
    if (filterTree) {
      if (!filterTreeSupported(filterTreeMetricKeys(draft.querySpec?.series ?? []))) {
        addIssue(ctx, ['filterTree'], 'filterTreeUnsupported');
      } else if (filterTreeDepth(filterTree) > FILTER_TREE_LIMITS.maxDepth) {
        addIssue(ctx, ['filterTree'], 'filterTreeTooDeep');
      } else if (
        countFilterLeaves(filterTree) > FILTER_TREE_LIMITS.maxLeaves ||
        maxInListLength(filterTree) > FILTER_TREE_LIMITS.maxInValues ||
        filterTreeBytes(filterTree) > FILTER_TREE_LIMITS.maxBytes
      ) {
        addIssue(ctx, ['filterTree'], 'filterTreeTooLarge');
      }
    }
  });
}

function createCompareSchema(catalog: Catalog | null) {
  return unknown().superRefine((val, ctx) => {
    const draft = val as BuilderDraft;
    const comparison = draft.querySpec?.comparison;
    const type = comparison?.type ?? 'NONE';
    const series = draft.querySpec?.series ?? [];
    const metrics = series
      .map((s) => findMetric(catalog, s.metricKey))
      .filter((m): m is CatalogMetric => m !== undefined);
    const viz = findVisualization(catalog, draft.visualizationType);

    if (metrics.some((m) => m.requiredComparison === 'GOVERNED_TARGET') && type !== 'GOVERNED_TARGET') {
      addIssue(ctx, ['comparison'], 'governedTargetRequired');
      return;
    }

    if (type !== 'NONE' && metrics.some((m) => !m.comparisonTypes.includes(type))) {
      addIssue(ctx, ['comparison'], 'comparisonUnsupported');
    }

    if (viz) {
      if (viz.requiresTarget && type !== 'TARGET' && type !== 'GOVERNED_TARGET') {
        addIssue(ctx, ['comparison'], 'targetRequired');
      }
      if ((type === 'PREVIOUS_PERIOD' || type === 'PREVIOUS_YEAR') && !viz.supportsPeriodComparison) {
        addIssue(ctx, ['comparison'], 'comparisonUnsupported');
      }
    }

    if (type === 'TARGET') {
      const target = comparison?.target;
      if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) {
        addIssue(ctx, ['comparison', 'target'], 'targetPositive');
      }
    } else if (type === 'DATASETS') {
      const basis = (comparison?.basis ?? 'PERIOD') as DatasetBasis;
      if (basis === 'TEAM' && metrics.some((m) => !allowedDatasetBasesForMetric(m).includes('TEAM'))) {
        addIssue(ctx, ['comparison'], 'comparisonUnsupported');
      }
      const datasets = comparison?.datasets ?? [];
      if (datasets.length < 2 || datasets.length > 3) {
        addIssue(
          ctx,
          ['comparison', 'datasets'],
          basis === 'TEAM' ? 'datasetsTeamsCount' : 'datasetsCount',
        );
      }
      if (basis === 'TEAM') {
        const seenTeams = new Set<string>();
        for (let i = 0; i < datasets.length; i++) {
          const ds = datasets[i];
          const teamId = ds?.teamId?.trim() ?? '';
          if (!teamId || !UUID_RE.test(teamId)) {
            addIssue(ctx, ['comparison', 'datasets', i, 'teamId'], 'required');
          } else if (seenTeams.has(teamId)) {
            addIssue(ctx, ['comparison', 'datasets', i, 'teamId'], 'teamsDistinct');
          } else {
            seenTeams.add(teamId);
          }
          const label = (ds?.label ?? '').trim();
          if (!label) {
            addIssue(ctx, ['comparison', 'datasets', i, 'label'], 'labelRequired');
          } else if (label.length > 80) {
            addIssue(ctx, ['comparison', 'datasets', i, 'label'], 'labelTooLong', { max: 80 });
          }
        }
      }
    } else if (type === 'GOVERNED_TARGET') {
      const gt = comparison?.governedTarget;
      // Money targets need a currency; a rate (percent) target has none.
      const needsCurrency = metrics.some((m) => m.unit === 'MONEY');
      if (
        !gt ||
        !gt.branchId ||
        !gt.subjectType ||
        !gt.subjectId ||
        (needsCurrency && !gt.currencyCode) ||
        !gt.periodGrain
      ) {
        addIssue(ctx, ['comparison', 'governedTarget'], 'governedTargetRequired');
      }
    }
  });
}

function createPresentationSchema(catalog: Catalog | null) {
  return unknown().superRefine((val, ctx) => {
    const draft = val as BuilderDraft;
    const vizKey = draft.visualizationType;

    if (!vizKey) {
      addIssue(ctx, ['visualizationType'], 'required');
    } else {
      const viz = findVisualization(catalog, vizKey);
      if (catalog && !viz) {
        addIssue(ctx, ['visualizationType'], 'visualizationInvalid');
      } else if (viz) {
        const series = draft.querySpec?.series ?? [];
        const metrics = series
          .map((s) => findMetric(catalog, s.metricKey))
          .filter((m): m is CatalogMetric => m !== undefined);
        const firstMetric = metrics[0];
        if (firstMetric && !isVisualizationCompatibleWithMetric(viz, firstMetric)) {
          addIssue(ctx, ['visualizationType'], 'shapeIncompatible');
        }
        if (series.length > 0 && (series.length < viz.minSeries || series.length > viz.maxSeries)) {
          addIssue(ctx, ['visualizationType'], 'seriesCount', {
            min: viz.minSeries,
            max: viz.maxSeries,
          });
        }
        if (!viz.supportsMixedUnits && metrics.length > 1) {
          const units = new Set(metrics.map((m) => m.unit));
          if (units.size > 1) {
            addIssue(ctx, ['visualizationType'], 'unitsMixed');
          }
        }
        if (!viz.supportsDualAxis && series.some((s) => s.axis === 'RIGHT')) {
          addIssue(ctx, ['visualizationType'], 'axisNotSupported');
        }
        const compType = draft.querySpec?.comparison?.type ?? 'NONE';
        if (viz.requiresTarget && compType !== 'TARGET' && compType !== 'GOVERNED_TARGET') {
          addIssue(ctx, ['visualizationType'], 'targetRequired');
        }
      }
    }

    const trimmedName = (draft.name ?? '').trim();
    if (trimmedName.length === 0) {
      addIssue(ctx, ['name'], 'required');
    } else if (trimmedName.length > 120) {
      addIssue(ctx, ['name'], 'tooLong', { max: 120 });
    }

    const description = draft.description ?? '';
    if (description.length > 500) {
      addIssue(ctx, ['description'], 'tooLong', { max: 500 });
    }

    const legend = draft.displaySpec?.legendPosition;
    if (legend !== undefined && !(LEGEND_POSITIONS as readonly string[]).includes(legend)) {
      addIssue(ctx, ['displaySpec', 'legendPosition'], 'required');
    }

    const numberFormat = draft.displaySpec?.numberFormat;
    if (numberFormat !== undefined && !(NUMBER_FORMATS as readonly string[]).includes(numberFormat)) {
      addIssue(ctx, ['displaySpec', 'numberFormat'], 'required');
    }

    const references = draft.displaySpec?.references;
    if (references && references.length > 0) {
      if (references.length > 4) {
        addIssue(ctx, ['displaySpec', 'references'], 'referencesTooMany', { max: 4 });
      }
      const series = draft.querySpec?.series ?? [];
      const seenSeries = new Set<number>();
      for (let i = 0; i < references.length; i++) {
        const ref = references[i];
        const idx = ref?.seriesIndex;
        if (!Number.isInteger(idx) || idx < 0 || idx >= series.length) {
          addIssue(ctx, ['displaySpec', 'references', i, 'seriesIndex'], 'required');
        } else if (seenSeries.has(idx)) {
          addIssue(ctx, ['displaySpec', 'references', i, 'seriesIndex'], 'referenceSeriesUnique');
        } else {
          seenSeries.add(idx);
        }

        const expectedUnit =
          Number.isInteger(idx) && idx >= 0 && idx < series.length
            ? effectiveSeriesUnit(series[idx], catalog)
            : ref.unit;
        if (ref.unit !== expectedUnit) {
          addIssue(ctx, ['displaySpec', 'references', i, 'value'], 'referenceUnitMismatch');
        } else if (typeof ref.value !== 'number' || !Number.isFinite(ref.value) || ref.value < 0) {
          addIssue(ctx, ['displaySpec', 'references', i, 'value'], 'referenceValueMin');
        } else if ((expectedUnit === 'PERCENT' || expectedUnit === 'SCORE') && ref.value > 100) {
          addIssue(ctx, ['displaySpec', 'references', i, 'value'], 'range', { min: 0, max: 100 });
        }

        const label = (ref?.label ?? '').trim();
        if (!label) {
          addIssue(ctx, ['displaySpec', 'references', i, 'label'], 'labelRequired');
        } else if (label.length > 40) {
          addIssue(ctx, ['displaySpec', 'references', i, 'label'], 'referenceLabelTooLong', { max: 40 });
        }
      }
    }
  });
}

function createReviewSchema() {
  return unknown().superRefine((val, ctx) => {
    const draft = val as BuilderDraft;
    if ((draft.changeSummary ?? '').length > 500) {
      addIssue(ctx, ['changeSummary'], 'tooLong', { max: 500 });
    }
    if ((draft.internalNotes ?? '').length > 1000) {
      addIssue(ctx, ['internalNotes'], 'tooLong', { max: 1000 });
    }
  });
}

export function validateStepWithZod(
  step: StepId,
  draft: BuilderDraft,
  catalog: Catalog | null,
): ValidationIssue[] {
  const schema = (() => {
    switch (step) {
      case 'data':
        return createDataSchema();
      case 'metrics':
        return createMetricsSchema(catalog);
      case 'scope':
        return createScopeSchema();
      case 'compare':
        return createCompareSchema(catalog);
      case 'presentation':
        return createPresentationSchema(catalog);
      case 'review':
        return createReviewSchema();
    }
  })();

  const result = schema.safeParse(draft);
  if (result.success) return [];

  const deduped = new Map<string, ValidationIssue>();
  for (const iss of result.error.issues) {
    const path = iss.path.map(String).join('.');
    if (deduped.has(path)) continue;
    const decoded = decodeIssueMessage(iss.message);
    deduped.set(path, {
      path,
      code: decoded.code,
      ...(decoded.params ? { params: decoded.params } : {}),
    });
  }
  return Array.from(deduped.values());
}

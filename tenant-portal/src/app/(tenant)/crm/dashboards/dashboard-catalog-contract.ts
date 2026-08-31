// `GET /dashboards/catalog` — the server-owned builder capabilities.
//
// Transcribed from crm-app/src/crm/dashboards/dashboard-catalog.ts
// (`DashboardCatalogService.getCatalog`). Every rule the widget form enforces
// is read from this response rather than hardcoded: the visualization list,
// the series bounds, which shapes a visualization accepts, which dimensions a
// metric supports, and whether it needs a target. `validateWidget` re-checks
// all of it and answers 422, so the form only ever mirrors the server.

import {
  boundedArray,
  finiteNumber,
  invalidResponse,
  nonEmptyString,
  optionalString,
  record,
  stringArray,
} from "./dashboard-parse";
import {
  isDataShape,
  isMetricUnit,
  isVisualization,
  type CrmDataShape,
  type CrmMetricUnit,
  type CrmVisualization,
} from "./widget-contract";
import { DASHBOARD_TEMPLATE_KEYS, type DashboardTemplateKey } from "./dashboard-contract";

export interface VisualizationCapability {
  key: CrmVisualization;
  shapes: CrmDataShape[];
  minSeries: number;
  maxSeries: number;
  requiresTarget: boolean;
  supportsPeriodComparison: boolean;
}

export interface MetricDefinition {
  key: string;
  nameAr: string;
  nameEn: string;
  unit: CrmMetricUnit;
  shape: CrmDataShape;
  dimensions: string[];
  supportsPeriodComparison: boolean;
}

export interface TemplateDefinition {
  key: DashboardTemplateKey;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  widgetCount: number;
}

export interface DashboardCatalog {
  gridColumns: number;
  maxWidgets: number;
  visualizations: VisualizationCapability[];
  metrics: MetricDefinition[];
  /** `{ key, grains }` — a `time` dimension without a grain is a 422. */
  dimensions: Array<{ key: string; grains: string[] }>;
  templates: TemplateDefinition[];
}

export function parseCatalogResponse(payload: unknown): DashboardCatalog {
  const source = record(payload);
  const grid = record(source?.grid);
  if (
    !source ||
    !grid ||
    !boundedArray(source.visualizations, 64) ||
    !boundedArray(source.metrics, 256) ||
    !boundedArray(source.dimensions, 64) ||
    !boundedArray(source.templates, 32)
  ) {
    invalidResponse("dashboard catalog");
  }
  return {
    gridColumns: finiteNumber(grid.columns) ? grid.columns : 12,
    maxWidgets: finiteNumber(grid.maxWidgets) ? grid.maxWidgets : 20,
    visualizations: source.visualizations.flatMap(parseVisualization),
    metrics: source.metrics.flatMap(parseMetric),
    dimensions: source.dimensions.flatMap((entry) => {
      const row = record(entry);
      if (!row || !nonEmptyString(row.key)) return [];
      return [{ key: row.key, grains: stringArray(row.grains, 16) ? row.grains : [] }];
    }),
    templates: source.templates.flatMap(parseTemplate),
  };
}

function parseVisualization(payload: unknown): VisualizationCapability[] {
  const source = record(payload);
  if (!source || !isVisualization(source.key) || !Array.isArray(source.shapes)) return [];
  return [{
    key: source.key,
    shapes: source.shapes.filter(isDataShape),
    minSeries: finiteNumber(source.minSeries) ? source.minSeries : 1,
    maxSeries: finiteNumber(source.maxSeries) ? source.maxSeries : 1,
    requiresTarget: source.requiresTarget === true,
    supportsPeriodComparison: source.supportsPeriodComparison === true,
  }];
}

function parseMetric(payload: unknown): MetricDefinition[] {
  const source = record(payload);
  if (
    !source ||
    !nonEmptyString(source.key) ||
    !isMetricUnit(source.unit) ||
    !isDataShape(source.shape) ||
    !stringArray(source.dimensions, 32)
  ) {
    return [];
  }
  return [{
    key: source.key,
    // The catalogue names its own metrics bilingually — `labelAr`/`labelEn` —
    // so metric copy never enters the portal dictionaries.
    nameAr: optionalString(source.labelAr) ?? source.key,
    nameEn: optionalString(source.labelEn) ?? source.key,
    unit: source.unit,
    shape: source.shape,
    dimensions: source.dimensions,
    supportsPeriodComparison: source.supportsPeriodComparison === true,
  }];
}

function parseTemplate(payload: unknown): TemplateDefinition[] {
  const source = record(payload);
  if (!source || !isTemplateKey(source.key)) return [];
  return [{
    key: source.key,
    nameAr: optionalString(source.nameAr) ?? source.key,
    nameEn: optionalString(source.nameEn) ?? source.key,
    descriptionAr: optionalString(source.descriptionAr) ?? "",
    descriptionEn: optionalString(source.descriptionEn) ?? "",
    widgetCount: finiteNumber(source.widgetCount) ? source.widgetCount : 0,
  }];
}

function isTemplateKey(value: unknown): value is DashboardTemplateKey {
  return DASHBOARD_TEMPLATE_KEYS.includes(value as DashboardTemplateKey);
}

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
  CRM_WIDGET_SOURCE_RESOURCES,
  type CrmDataShape,
  type CrmMetricUnit,
  type CrmVisualization,
  type WidgetQuerySpec,
  type WidgetSourceResource,
  type ComparisonDatasetBasis,
} from "./widget-contract";
import { DASHBOARD_TEMPLATE_KEYS, type DashboardTemplateKey } from "./dashboard-contract";
import { parseQuerySpec } from "./widget-response";

export interface VisualizationCapability {
  key: CrmVisualization;
  shapes: CrmDataShape[];
  minSeries: number;
  maxSeries: number;
  requiresTarget: boolean;
  supportsPeriodComparison: boolean;
  supportsDualAxis?: boolean;
  supportsMixedUnits?: boolean;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  defaultW?: number;
  defaultH?: number;
}

// CRM DashboardMetricSemanticMetadata; unknown future values remain unknown.
const METRIC_TIME_MODELS = ["EVENT", "COHORT", "SNAPSHOT", "INTERVAL", "CUSTOM", "UNKNOWN"] as const;
const METRIC_DATE_FIELDS = ["CREATED_AT", "CONVERTED_AT", "WON_AT", "LOST_AT", "OUTCOME_AT", "ACTIVITY_COMPLETED_AT",
  "EXPECTED_CLOSE_DATE", "ACTIVITY_EFFECTIVE_AT", "EMAIL_REQUESTED_AT", "EMAIL_SENT_AT", "EMAIL_FAILED_AT", "REMIND_AT", "DUE_AT",
  "CALENDAR_INTERVAL", "STAGE_CHANGED_AT", "CURRENT_STATE", "MULTI_SOURCE", "CUSTOM", "UNKNOWN"] as const;
const METRIC_RESOURCES = CRM_WIDGET_SOURCE_RESOURCES;

interface MetricDefinition {
  key: string;
  nameAr: string;
  nameEn: string;
  unit: CrmMetricUnit;
  shape: CrmDataShape;
  dimensions: string[];
  visualizations?: CrmVisualization[];
  standalone?: boolean;
  populationShare?: boolean;
  requiredComparison?: "GOVERNED_TARGET";
  requiredGrain?: "DAY";
  comparisonTypes?: string[];
  datasetComparison?: { bases: ComparisonDatasetBasis[]; visualizations: CrmVisualization[] };
  supportsPeriodComparison: boolean;
  rowKind?: "ALERT" | "RANKED" | "SCORECARD";
  drilldown?: { dimensionKey: string; requiresCurrency: boolean };
  timeModel?: typeof METRIC_TIME_MODELS[number];
  dateField?: typeof METRIC_DATE_FIELDS[number];
  accessResources?: Array<typeof METRIC_RESOURCES[number]>;
}

export interface TemplateDefinition {
  key: DashboardTemplateKey;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  widgetCount: number;
}

export const WIDGET_RECIPE_FAMILIES = ["LEADS", "PIPELINE", "ACTIVITIES", "TEAM", "QUALITY"] as const;
export interface WidgetRecipe {
  key: string;
  family: typeof WIDGET_RECIPE_FAMILIES[number];
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  visualizationType: CrmVisualization;
  querySpec: WidgetQuerySpec;
  displaySpec: Record<string, unknown>;
  sourceResources: WidgetSourceResource[];
}

export interface DashboardCatalog {
  gridColumns: number;
  maxWidgets: number;
  visualizations: VisualizationCapability[];
  metrics: MetricDefinition[];
  /** `{ key, grains }` — a `time` dimension without a grain is a 422. */
  dimensions: Array<{ key: string; grains: string[] }>;
  templates: TemplateDefinition[];
  widgetRecipes?: WidgetRecipe[];
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
    widgetRecipes: parseWidgetRecipes(source.widgetRecipes),
  };
}

function parseWidgetRecipes(value: unknown): WidgetRecipe[] {
  if (value === undefined) return [];
  if (!boundedArray(value, 24)) invalidResponse("widget recipes");
  const keys = new Set<string>();
  return value.map(entry => {
    const recipe = record(entry);
    const family = WIDGET_RECIPE_FAMILIES.find(key => key === recipe?.family);
    const display = record(recipe?.displaySpec);
    const text = (value: unknown, limit: number): value is string => nonEmptyString(value) && value.length <= limit;
    if (!recipe || !family || !display || !text(recipe.key, 80) || !/^[a-z0-9-]+$/u.test(recipe.key) || keys.has(recipe.key)
      || !text(recipe.nameAr, 120) || !text(recipe.nameEn, 120) || !text(recipe.descriptionAr, 500) || !text(recipe.descriptionEn, 500)
      || !isVisualization(recipe.visualizationType) || !boundedArray(recipe.sourceResources, METRIC_RESOURCES.length)
      || !recipe.sourceResources.every((value): value is WidgetSourceResource => METRIC_RESOURCES.some(key => key === value))
      || new Set(recipe.sourceResources).size !== recipe.sourceResources.length) invalidResponse("widget recipe");
    keys.add(recipe.key);
    return { key: recipe.key, family, nameAr: recipe.nameAr, nameEn: recipe.nameEn, descriptionAr: recipe.descriptionAr,
      descriptionEn: recipe.descriptionEn, visualizationType: recipe.visualizationType, querySpec: parseQuerySpec(recipe.querySpec),
      displaySpec: display, sourceResources: recipe.sourceResources };
  });
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
    supportsDualAxis: source.supportsDualAxis === true,
    supportsMixedUnits: source.supportsMixedUnits === true,
    ...Object.fromEntries(["minW", "minH", "maxW", "maxH", "defaultW", "defaultH"].flatMap((key) =>
      Number.isSafeInteger(source[key]) && (source[key] as number) > 0 ? [[key, source[key]]] : [])),
  }];
}

function parseMetric(payload: unknown): MetricDefinition[] {
  const source = record(payload);
  if (source?.availability === "RETIRED") return [];
  if (
    !source ||
    !nonEmptyString(source.key) ||
    !isMetricUnit(source.unit) ||
    !isDataShape(source.shape) ||
    !stringArray(source.dimensions, 32)
  ) {
    return [];
  }
  const drilldown = record(source.drilldown);
  const comparison = record(source.datasetComparison);
  return [{
    key: source.key,
    // The catalogue names its own metrics bilingually — `labelAr`/`labelEn` —
    // so metric copy never enters the portal dictionaries.
    nameAr: optionalString(source.labelAr) ?? source.key,
    nameEn: optionalString(source.labelEn) ?? source.key,
    unit: source.unit,
    shape: source.shape,
    dimensions: source.dimensions,
    ...(boundedArray(source.visualizations, 64) ? { visualizations: source.visualizations.filter(isVisualization) } : {}),
    ...(source.standalone === true ? { standalone: true } : {}),
    ...(source.populationShare === true ? { populationShare: true } : {}),
    ...(source.requiredComparison === "GOVERNED_TARGET" ? { requiredComparison: source.requiredComparison } : {}),
    ...(source.requiredGrain === "DAY" ? { requiredGrain: source.requiredGrain } : {}),
    ...(stringArray(source.comparisonTypes, 6) ? { comparisonTypes: source.comparisonTypes } : {}),
    ...(comparison && boundedArray(comparison.bases, 2) && boundedArray(comparison.visualizations, 3) ? { datasetComparison: {
      bases: comparison.bases.filter((basis): basis is ComparisonDatasetBasis => basis === "PERIOD" || basis === "BRANCH"),
      visualizations: comparison.visualizations.filter(isVisualization),
    } } : {}),
    supportsPeriodComparison: source.supportsPeriodComparison === true,
    timeModel: METRIC_TIME_MODELS.includes(source.timeModel as typeof METRIC_TIME_MODELS[number])
      ? source.timeModel as typeof METRIC_TIME_MODELS[number] : "UNKNOWN",
    dateField: METRIC_DATE_FIELDS.includes(source.dateField as typeof METRIC_DATE_FIELDS[number])
      ? source.dateField as typeof METRIC_DATE_FIELDS[number] : "UNKNOWN",
    accessResources: stringArray(source.accessResources, METRIC_RESOURCES.length) ? source.accessResources.filter(
      (resource): resource is typeof METRIC_RESOURCES[number] => METRIC_RESOURCES.includes(resource as typeof METRIC_RESOURCES[number]),
    ) : [],
    ...(source.rowKind === "ALERT" || source.rowKind === "RANKED" || source.rowKind === "SCORECARD" ? { rowKind: source.rowKind } : {}),
    ...(drilldown && nonEmptyString(drilldown.dimensionKey) && source.dimensions.includes(drilldown.dimensionKey)
      && typeof drilldown.requiresCurrency === "boolean"
      ? { drilldown: { dimensionKey: drilldown.dimensionKey, requiresCurrency: drilldown.requiresCurrency } } : {}),
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

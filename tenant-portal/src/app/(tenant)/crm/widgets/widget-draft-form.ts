import type { DashboardCatalog } from "../dashboards/dashboard-catalog-contract";
import { boundedArray, invalidResponse, record } from "../dashboards/dashboard-parse";
import { TIME_GRAINS, type ComparisonDatasetSelection } from "../dashboards/widget-contract";
import { isGovernedTargetBinding } from "../dashboards/won-target-evidence";
import { widgetDraftContent, type WidgetDraftContent } from "./widget-draft-contract";
import { buildWidgetUpdate, FILTER_KEYS, validateWidgetForm, widgetInput, widgetSpecLimitations, type StoredWidget, type WidgetFormState } from "./widget-form";

const FORM_VERSION = 1;
const GRAINS = ["", ...TIME_GRAINS] as const;
const COMPARISONS = ["INHERIT", "NONE", "TARGET", "PREVIOUS_PERIOD", "PREVIOUS_YEAR", "DATASETS", "GOVERNED_TARGET"] as const;
const AXES = ["", "LEFT", "RIGHT"] as const;
const BASES = ["BRANCH", "PERIOD"] as const;
const DATASET_KEYS = ["branchId", "datePreset", "dateFrom", "dateTo"] as const;
const FORM_KEYS = ["version", "series", "dimensionKey", "grain", "comparison", "target", "filters", "datasetBasis", "datasets", "governedTarget"] as const;
const SERIES_KEYS = ["metricKey", "axis", "label", "color"] as const;

function member<T extends string>(values: readonly T[], value: unknown): value is T {
  return (values as readonly unknown[]).includes(value);
}

function definedFields(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

export function buildWidgetDraft(form: WidgetFormState, catalog: DashboardCatalog | null, original?: StoredWidget): WidgetDraftContent {
  if (!validateWidgetForm(form, catalog)) {
    const content = widgetDraftContent(widgetInput(form));
    if (!original) return content;
    const changes = buildWidgetUpdate(form, original);
    return { ...content, querySpec: { ...(changes.querySpec ?? original.querySpec) },
      displaySpec: changes.displaySpec ?? original.displaySpec ?? {} };
  }
  const { series, dimensionKey, grain, comparison, datasetBasis, datasets, target, filters, governedTarget } = form;
  // Incomplete editor state stays opaque to the draft API and cannot be published as a query.
  return { name: form.name.trim(), visualizationType: form.visualizationType || null,
    displaySpec: form.displaySpec,
    querySpec: { editorDraft: {
      version: FORM_VERSION, series, dimensionKey, grain, comparison, target, filters: definedFields(filters),
      ...(datasetBasis ? { datasetBasis } : {}), ...(datasets ? { datasets: datasets.map((item) => definedFields({ ...item })) } : {}),
      ...(governedTarget ? { governedTarget } : {}),
    } },
  };
}

function parseDataset(value: unknown): ComparisonDatasetSelection {
  const row = record(value);
  if (!row || Object.entries(row).some(([key, field]) => !member(DATASET_KEYS, key) || typeof field !== "string")) {
    invalidResponse("widget editor dataset");
  }
  return row as ComparisonDatasetSelection;
}

export function restoreWidgetEditorDraft(draft: WidgetDraftContent): WidgetFormState | null {
  if (!Object.hasOwn(draft.querySpec, "editorDraft")) return null;
  const row = record(draft.querySpec.editorDraft);
  const filters = record(row?.filters);
  if (!row || row.version !== FORM_VERSION || Object.keys(draft.querySpec).length !== 1
    || Object.keys(row).some((key) => !member(FORM_KEYS, key))
    || !boundedArray(row.series, 4) || row.series.length === 0 || !filters
    || Object.entries(filters).some(([key, value]) => !member(FILTER_KEYS, key)
      || (value !== null && typeof value !== "string" && typeof value !== "number"))
    || typeof row.dimensionKey !== "string" || !member(GRAINS, row.grain)
    || !member(COMPARISONS, row.comparison) || typeof row.target !== "string"
    || (row.datasetBasis !== undefined && !member(BASES, row.datasetBasis))
    || (row.datasets !== undefined && !boundedArray(row.datasets, 3))
    || (row.governedTarget !== undefined && !isGovernedTargetBinding(row.governedTarget))
    || widgetSpecLimitations({ series: [] }, draft.displaySpec).length > 0) invalidResponse("widget editor draft");
  const series = row.series.map((value) => {
    const item = record(value);
    if (!item || Object.keys(item).some((key) => !member(SERIES_KEYS, key))
      || typeof item.metricKey !== "string" || !member(AXES, item.axis) || typeof item.label !== "string"
      || typeof item.color !== "string") invalidResponse("widget editor series");
    return { metricKey: item.metricKey, axis: item.axis, label: item.label, color: item.color };
  });
  return { name: draft.name, visualizationType: draft.visualizationType ?? "", series,
    dimensionKey: row.dimensionKey, grain: row.grain, comparison: row.comparison, target: row.target,
    datasetBasis: row.datasetBasis, datasets: row.datasets?.map(parseDataset),
    ...(row.governedTarget ? { governedTarget: row.governedTarget } : {}),
    filters, displaySpec: draft.displaySpec };
}

"use client";

import { Badge, DateTime, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import type { DashboardCatalog } from "../../../dashboards/dashboard-catalog-contract";
import { record } from "../../../dashboards/dashboard-parse";
import { isVisualization } from "../../../dashboards/widget-contract";
import { sameWidgetValue } from "../../hooks/widget-requests";
import type { WidgetVersionComparison } from "../../widget-version-comparison-contract";

const QUERY_FIELDS = ["series", "dimension", "filters", "comparison"];
const DISPLAY_FIELDS = ["title", "subtitle", "numberFormat", "legendPosition", "options"];
const DISPLAY_TOGGLES = ["showDelta", "showPoints", "showValues"] as const;
const EMPTY = "—";
const remainder = (value: Record<string, unknown>, fields: string[]) => Object.fromEntries(Object.entries(value).filter(([key]) => !fields.includes(key)));
const label = (labels: Record<string, string>, value: unknown, fallback = EMPTY) =>
  typeof value === "string" && Object.hasOwn(labels, value) ? labels[value] : fallback;

export function WidgetVersionDiffTable({ comparison, catalog }: { comparison: WidgetVersionComparison; catalog: DashboardCatalog | null }) {
  const { t, lang } = useI18n();
  const labels = t.crmWidgets.versionComparison;
  const { left, right, sections } = comparison;
  const rows: { label: string; left: string; right: string; changed: boolean }[] = [];
  const add = (name: string, first: unknown, second: unknown, display: (value: unknown) => string, changed = !sameWidgetValue(first, second)) => {
    rows.push({ label: name, left: display(first), right: display(second), changed });
  };
  const text = (value: unknown) => typeof value === "string" && value ? value : EMPTY;
  const n = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? formatNumber(value, lang) : EMPTY;
  const count = (value: unknown, template: string) => {
    const source = record(value);
    return source && Object.keys(source).length ? formatTemplate(template, { count: n(Object.keys(source).length) }) : EMPTY;
  };
  const metrics = (value: unknown) => Array.isArray(value) ? value.slice(0, 4).map((item: unknown) => {
    const metric = record(item);
    const entry = catalog?.metrics.find((candidate) => candidate.key === metric?.metricKey);
    return typeof metric?.label === "string" && metric.label ? metric.label : entry ? localizedName(entry, lang) : t.crmWidgets.review.selectedUnavailable;
  }).join(" · ") || EMPTY : EMPTY;
  const dimension = (value: unknown) => {
    const spec = record(value);
    return [label(t.crmWidgets.dimensions, spec?.key), label(t.crmWidgets.grains, spec?.grain)]
      .filter((part) => part !== EMPTY).join(" · ") || EMPTY;
  };
  const comparisonLabel = (value: unknown) => {
    const spec = record(value);
    return [label(t.crmWidgets.comparisonValues, spec?.type),
      label(t.crmWidgets.datasets.bases, spec?.basis)].filter((part) => part !== EMPTY).join(" · ") || EMPTY;
  };
  add(t.crmWidgets.name, left.name, right.name, text);
  add(labels.visualization, left.visualizationType, right.visualizationType,
    (value) => isVisualization(value) ? t.crmDashboards.visualizations[value] : labels.retiredVisualization);
  add(labels.schema, left.schemaVersion, right.schemaVersion, n);
  add(t.crmWidgets.metric, left.querySpec.series, right.querySpec.series, metrics);
  add(t.crmWidgets.dimension, left.querySpec.dimension, right.querySpec.dimension, dimension);
  add(labels.scope, left.querySpec.filters, right.querySpec.filters, (value) => count(value, labels.filterCount));
  add(t.crmWidgets.comparison, left.querySpec.comparison, right.querySpec.comparison, comparisonLabel);
  add(t.crmWidgets.target, record(left.querySpec.comparison)?.target, record(right.querySpec.comparison)?.target, n);
  const queryKnownChanged = rows.slice(3).some((row) => row.changed);
  const firstExtraQuery = remainder(left.querySpec, QUERY_FIELDS);
  const secondExtraQuery = remainder(right.querySpec, QUERY_FIELDS);
  if (sections.includes("QUERY") && (!queryKnownChanged || !sameWidgetValue(firstExtraQuery, secondExtraQuery))) {
    add(labels.extraQuery, firstExtraQuery, secondExtraQuery, (value) => count(value, labels.optionCount), true);
  }
  const beforeDisplay = rows.length;
  const display = t.crmWidgets.review.display;
  add(display.title, left.displaySpec.title, right.displaySpec.title, text);
  add(display.subtitle, left.displaySpec.subtitle, right.displaySpec.subtitle, text);
  add(display.numberFormat, left.displaySpec.numberFormat, right.displaySpec.numberFormat, (value) => label(t.crmWidgets.review.numberFormats, value));
  add(display.legendPosition, left.displaySpec.legendPosition, right.displaySpec.legendPosition, (value) => label(t.crmWidgets.review.legendPositions, value));
  const leftOptions = record(left.displaySpec.options) ?? {};
  const rightOptions = record(right.displaySpec.options) ?? {};
  const toggle = (value: unknown) => value === true ? labels.enabled : value === false ? labels.disabled : EMPTY;
  for (const key of DISPLAY_TOGGLES) add(display[key], leftOptions[key], rightOptions[key], toggle);
  add(labels.presentation, remainder(leftOptions, [...DISPLAY_TOGGLES]), remainder(rightOptions, [...DISPLAY_TOGGLES]),
    (value) => count(value, labels.optionCount));
  const firstExtraDisplay = remainder(left.displaySpec, DISPLAY_FIELDS);
  const secondExtraDisplay = remainder(right.displaySpec, DISPLAY_FIELDS);
  if (sections.includes("DISPLAY") && (!rows.slice(beforeDisplay).some((row) => row.changed) || !sameWidgetValue(firstExtraDisplay, secondExtraDisplay))) {
    add(labels.extraDisplay, firstExtraDisplay, secondExtraDisplay, (value) => count(value, labels.optionCount), true);
  }
  return <div className="min-w-0 rounded-md border border-border">
    <Table aria-label={labels.title} className="min-w-xl table-fixed">
      <TableHeader><TableRow>
        <TableHead scope="col" className="w-2/5">{labels.setting}</TableHead>
        {[left, right].map((item) => <TableHead key={item.versionNumber} scope="col" className="h-auto whitespace-normal py-2">
          <span className="me-1">{t.crmWidgets.lifecycle.history.version} {n(item.versionNumber)}</span>
          {item.versionNumber === comparison.activeVersionNumber && <Badge tone="positive">{t.crmWidgets.lifecycle.history.active}</Badge>}
          <span className="block text-xs text-muted-foreground">{item.publishedAt ? <DateTime value={item.publishedAt} /> : t.crmWidgets.lifecycle.history.unknownDate}</span>
        </TableHead>)}
      </TableRow></TableHeader>
      <TableBody>{rows.filter((row) => row.changed || row.left !== EMPTY || row.right !== EMPTY).map((row) => (
        <TableRow key={row.label} className={row.changed ? "bg-accent/50" : undefined}>
          <TableHead scope="row" className="h-auto whitespace-normal py-2">{row.label}{row.changed && <Badge className="ms-2" tone="neutral">{labels.changed}</Badge>}</TableHead>
          <TableCell className="whitespace-normal break-words">{row.left}</TableCell>
          <TableCell className="whitespace-normal break-words">{row.right}</TableCell>
        </TableRow>
      ))}</TableBody>
    </Table>
  </div>;
}

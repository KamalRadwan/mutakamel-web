import { nonEmptyString, record, timestamp } from "./dashboard-parse";
import type { WidgetResult } from "./dashboard-run-contract";
import type { WidgetCell, WidgetTableModel } from "./widget-view";

export const LIFECYCLE_METRICS = {
  status: "crm.leads.created.by_current_status.count",
  stage: "crm.leads.created.by_current_stage.count",
  qualified: "crm.leads.created.current_qualified_open.count",
} as const;

const STATUS_ORDER = ["OPEN", "ON_HOLD", "CONVERTED", "DISQUALIFIED", "OTHER"] as const;
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function isLifecycleTimeZone(value: unknown): value is string {
  if (!nonEmptyString(value)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function isLifecycleWidget(result: WidgetResult) {
  return result.details?.leadLifecycle !== undefined
    || result.series.some(series => Object.values(LIFECYCLE_METRICS).some(metric => series.key === metric));
}

export function readLeadLifecycle(result: WidgetResult) {
  const evidence = record(result.details?.leadLifecycle);
  const [series] = result.series;
  if (!evidence || !count(evidence.total) || !timestamp(evidence.asOf) || evidence.populationBasis !== "CREATED_IN_PERIOD"
    || evidence.classificationBasis !== "CURRENT_STATE" || result.timeBasis !== "COHORT" || result.unit !== "COUNT"
    || result.errorCode !== null || result.state !== (evidence.total === 0 ? "EMPTY" : "READY")
    || result.series.length !== 1 || series.unit !== "COUNT") return null;
  const { total, asOf } = evidence;
  const common = { total, asOf };
  const points = series.points;
  if (series.key === LIFECYCLE_METRICS.qualified) {
    const qualified = record(result.details?.qualified);
    if (!qualified || !count(qualified.total) || !count(qualified.open) || !count(qualified.onHold) || !count(qualified.other)
      || qualified.total !== qualified.open + qualified.onHold + qualified.other || qualified.total > total
      || result.shape !== "SCALAR" || result.value !== qualified.open || points.length !== 1
      || points[0].value !== qualified.open) return null;
    return { ...common, kind: "qualified" as const, qualified: {
      total: qualified.total, open: qualified.open, onHold: qualified.onHold, other: qualified.other,
    } };
  }
  if (result.shape !== "CATEGORY" || result.value !== null || points.length > 100
    || (total === 0) !== (points.length === 0) || new Set(points.map(point => point.key)).size !== points.length
    || !points.every(point => nonEmptyString(point.label) && count(point.value) && point.meta.id === point.key)
    || points.reduce((sum, point) => sum + Number(point.value), 0) !== total) return null;
  if (series.key === LIFECYCLE_METRICS.status) {
    if (total && (points.length < 4 || points.some((point, index) => point.key !== STATUS_ORDER[index])
      || points.some(point => point.key === "OTHER" && point.value === 0))) return null;
    return { ...common, kind: "status" as const,
      rows: points.map(point => ({ key: point.key, label: point.label, count: Number(point.value) })) };
  }
  if (series.key !== LIFECYCLE_METRICS.stage) return null;
  const omitted = result.details?.omittedStageGroups;
  if (!count(omitted) || (omitted > 0) !== points.some(point => point.key === "OTHER")) return null;
  const rows: { key: string; label: string; count: number; open: number; onHold: number }[] = [];
  for (const point of points) {
    const { total: stageTotal, open, onHold } = point.meta;
    if (!count(stageTotal) || stageTotal === 0 || point.value !== stageTotal
      || !count(open) || !count(onHold) || open + onHold > stageTotal) return null;
    rows.push({ key: point.key, label: point.label, count: stageTotal, open, onHold });
  }
  return { ...common, kind: "stage" as const, rows, omitted };
}

export type LeadLifecycle = NonNullable<ReturnType<typeof readLeadLifecycle>>;
export interface LeadLifecycleTableLabels {
  status: string; stage: string; measure: string; count: string; share: string;
  total: string; open: string; onHold: string; other: string; totalQualified: string;
}

export function leadLifecycleTable(data: LeadLifecycle, labels: LeadLifecycleTableLabels, statusColors?: readonly string[]): WidgetTableModel {
  const text = (value: string): WidgetCell => ({ kind: "text", text: value });
  const number = (value: number): WidgetCell => ({ kind: "number", value });
  const percent = (value: number): WidgetCell => ({ kind: "number", unit: "PERCENT", value });
  if (!data.total) return { columns: [], rows: [] };
  if (data.kind === "qualified") {
    const { open, onHold, other, total } = data.qualified;
    return {
      columns: [{ key: "measure", label: labels.measure, numeric: false }, { key: "count", label: labels.count, numeric: true }],
      rows: [
        { key: "open", cells: [text(labels.open), number(open)] },
        { key: "onHold", cells: [text(labels.onHold), number(onHold)] },
        ...(other ? [{ key: "other", cells: [text(labels.other), number(other)] }] : []),
        { key: "total", total: true, cells: [text(labels.totalQualified), number(total)] },
      ],
    };
  }
  if (data.kind === "status") return {
    columns: [{ key: "status", label: labels.status, numeric: false }, { key: "count", label: labels.count, numeric: true },
      { key: "share", label: labels.share, numeric: true }],
    rows: [
      ...data.rows.map((row, index) => ({ key: row.key, cells: [
        { kind: "text" as const, text: row.label, swatch: statusColors?.[index] },
        number(row.count), percent(Math.round(row.count / data.total * 1000) / 10),
      ] })),
      { key: "total", total: true, cells: [text(labels.total), number(data.total), percent(100)] },
    ],
  };
  const open = data.rows.reduce((sum, row) => sum + row.open, 0);
  const onHold = data.rows.reduce((sum, row) => sum + row.onHold, 0);
  return {
    columns: [{ key: "stage", label: labels.stage, numeric: false }, { key: "count", label: labels.total, numeric: true },
      { key: "open", label: labels.open, numeric: true }, { key: "onHold", label: labels.onHold, numeric: true }],
    rows: [
      ...data.rows.map(row => ({ key: row.key, cells: [text(row.label), number(row.count), number(row.open), number(row.onHold)] })),
      { key: "total", total: true, cells: [text(labels.total), number(data.total), number(open), number(onHold)] },
    ],
  };
}

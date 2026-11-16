import type { WidgetResult } from "./dashboard-run-contract";
import type { WidgetCell, WidgetTableModel, WidgetTableHeaders } from "./widget-view";
import type { CrmMetricUnit } from "./widget-contract";
import { finite, record } from "./widget-typed-model";
import { DURATION_STATISTICS, durationDistribution } from "./widget-duration-distribution";

/** The accessible table keeps the complete server measures, bounds, references and dates. */
export function typedTableModel(result: WidgetResult, headers: WidgetTableHeaders): WidgetTableModel | null {
  const typed = result.typedResult; if (!typed) return null;
  const text = (value: unknown): WidgetCell => typeof value === "string" ? { kind: "text", text: value } : { kind: "missing" };
  const numeric = (value: unknown, source: Record<string, unknown> = typed): WidgetCell => !finite(value) ? { kind: "missing" } : (source.unit ?? result.unit) === "MONEY"
    ? { kind: "money", value, currency: typeof source.currencyCode === "string" ? source.currencyCode : result.currency }
    : { kind: "number", value, ...(["PERCENT", "DURATION", "SCORE"].includes(String(source.unit ?? result.unit)) ? { unit: (source.unit ?? result.unit) as CrmMetricUnit } : {}) };
  const count = (value: unknown): WidgetCell => finite(value) ? { kind: "number", value } : { kind: "missing" };
  const instant = (value: unknown): WidgetCell => typeof value === "string" && Number.isFinite(Date.parse(value)) ? { kind: "datetime", value } : { kind: "missing" };
  const rowsOf = (source: Record<string, unknown>, key: string) => Array.isArray(source[key]) ? (source[key] as unknown[]).flatMap((entry) => { const row = record(entry); return row ? [row] : []; }) : [];
  if (typed.shape === "DURATION_DISTRIBUTION") {
    const distribution = durationDistribution(typed);
    const measures = ["sampleCount", "excludedCount", ...DURATION_STATISTICS] as const;
    return {
      columns: [{ key: "label", label: headers.label, numeric: false },
        ...measures.map((key) => ({ key, label: headers.typed?.[key] ?? headers.value, numeric: true }))],
      rows: distribution?.groups.map((group) => ({ key: group.key, cells: [
        text(group.key === "conversion" ? headers.typed?.conversionSample ?? group.label : group.label),
        count(group.sampleCount), count(group.excludedCount), ...DURATION_STATISTICS.map((key) => numeric(group[key])),
      ] })) ?? [],
    };
  }
  const columns: WidgetTableModel["columns"] = [{ key: "label", label: headers.label, numeric: false }, { key: "value", label: headers.value, numeric: true }];
  const col = (key: string, numeric = false) => { if (!columns.some((column) => column.key === key)) columns.push({ key, label: headers.typed?.[key] ?? headers.value, numeric }); };
  const entries: Array<{ key: string; cells: Record<string, WidgetCell> }> = [];
  const appendRefs = (source: Record<string, unknown>, label: string, key: string) => {
    rowsOf(source, "references").forEach((ref, index) => { col("referenceKind"); entries.push({ key: `${key}:ref:${index}`, cells: { label: text(`${label} · ${String(ref.label ?? "")}`), value: numeric(ref.value, ref), referenceKind: text(headers.typed?.[String(ref.kind)]) } }); });
  };
  if (typed.shape === "HIERARCHY") {
    col("parent"); col("depth", true); const nodes = rowsOf(typed, "nodes"); const labels = new Map(nodes.map((node) => [node.id, node.label]));
    nodes.forEach((node, index) => entries.push({ key: `node:${index}`, cells: { label: text(node.label), value: numeric(node.value), parent: text(labels.get(node.parentId)), depth: count(node.depth) } }));
  } else if (typed.shape === "BINNED_DISTRIBUTION") {
    col("lower", true); col("upper", true); col("kind");
    rowsOf(typed, "bins").forEach((bin, index) => entries.push({ key: `bin:${index}`, cells: { label: text(bin.label), value: count(bin.count), lower: numeric(bin.lowerBound), upper: numeric(bin.upperBound), kind: text(headers.typed?.[String(bin.kind)]) } }));
  } else if (typed.shape === "WATERFALL") {
    col("cumulative", true); col("kind");
    rowsOf(typed, "steps").forEach((step, index) => entries.push({ key: `step:${index}`, cells: { label: text(step.label), value: numeric(step.value), cumulative: numeric(step.cumulativeValue), kind: text(headers.typed?.[String(step.kind)]) } }));
  } else if (typed.shape === "EVENT_STREAM" || typed.shape === "ROWS" && typed.rowKind === "ALERT") {
    columns[1].numeric = false; columns[1].label = headers.typed?.occurredAt ?? headers.value;
    col("severity"); col("dueAt"); col("description");
    rowsOf(typed, typed.shape === "EVENT_STREAM" ? "events" : "rows").forEach((event, index) => entries.push({ key: `event:${index}`, cells: {
      label: text(event.title), value: instant(event.occurredAt), severity: text(headers.typed?.[String(event.severity)]), dueAt: instant(event.dueAt), description: text(event.description),
    } }));
  } else if (typed.shape === "ROWS") {
    const rows = rowsOf(typed, "rows"); col(typed.rowKind === "RANKED" ? "rank" : "status", typed.rowKind === "RANKED");
    rows.forEach((row, index) => {
      const primary = record(row.primaryMeasure);
      const measures = typed.rowKind === "RANKED" ? [...(primary ? [primary] : []), ...rowsOf(row, "secondaryMeasures")] : rowsOf(row, "measures");
      measures.forEach((measure, measureIndex) => {
        col("measure"); const key = `measure:${index}:${measureIndex}`;
        entries.push({ key, cells: { label: text(row.label ?? row.title), value: numeric(measure.value, measure), measure: text(measure.label), rank: count(row.rank), status: text(headers.typed?.[String(row.status)]) } });
        appendRefs(measure, `${String(row.label ?? "")} · ${String(measure.label ?? "")}`, key);
      });
      if (!measures.length) entries.push({ key: `row:${index}`, cells: { label: text(row.label ?? row.title), value: instant(row.occurredAt), rank: count(row.rank), status: text(headers.typed?.[String(row.status)]) } });
    });
  } else return null;
  appendRefs(typed, headers.label, "result");
  return { columns, rows: entries.map((row) => ({ key: row.key, cells: columns.map((column) => row.cells[column.key] ?? { kind: "missing" }) })) };
}

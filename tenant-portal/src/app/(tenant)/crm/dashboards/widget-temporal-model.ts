import type { WidgetSeries } from "./dashboard-run-contract";
export interface IntervalDatum { key: string; label: string; start: number; end: number }
export function intervalData(series: WidgetSeries[]): IntervalDatum[] | null {
  if (series.length !== 1 || series[0].points.length > 100) return null;
  const rows = series[0].points.map((point) => {
    const start = point.start && /(?:Z|[+-]\d{2}:\d{2})$/i.test(point.start) ? Date.parse(point.start) : NaN;
    const end = point.end && /(?:Z|[+-]\d{2}:\d{2})$/i.test(point.end) ? Date.parse(point.end) : NaN;
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? { key: point.key, label: point.label, start, end } : null;
  });
  return rows.some((row) => row === null) ? null : (rows as IntervalDatum[]).sort((a, b) => a.start - b.start);
}
export function civilDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === value ? date : null;
}
export interface FlowNode { id: string; label: string }
export interface FlowEdge { key: string; source: string; target: string; value: number }
export function flowData(series: WidgetSeries[]): { nodes: FlowNode[]; edges: FlowEdge[] } | null {
  if (series.length !== 1 || series[0].points.length > 200) return null;
  const nodes = new Map<string, FlowNode>(); const edges: FlowEdge[] = [];
  for (const point of series[0].points) {
    const { source, target, sourceLabel, targetLabel } = point.meta;
    if (typeof source !== "string" || typeof target !== "string" || typeof sourceLabel !== "string" || typeof targetLabel !== "string" || point.value === null || point.value < 0) return null;
    nodes.set(source, { id: source, label: sourceLabel }); nodes.set(target, { id: target, label: targetLabel });
    edges.push({ key: point.key, source, target, value: point.value });
  }
  return nodes.size <= 40 ? { nodes: [...nodes.values()], edges } : null;
}

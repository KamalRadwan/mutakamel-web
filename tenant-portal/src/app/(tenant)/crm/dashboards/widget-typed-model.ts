import type { CrmMetricUnit } from "./widget-contract";

/** Current crm-app P2 shapes. Numbers stay finite numbers; absent data never becomes zero. */
export interface TypedReference { key: string; label: string; kind: "TARGET" | "BENCHMARK" | "THRESHOLD_MIN" | "THRESHOLD_MAX"; value: number; unit: CrmMetricUnit; currencyCode?: string }
export interface TypedMeasure { key: string; label: string; value: number; unit: CrmMetricUnit; currencyCode?: string; references: TypedReference[] }
export interface HierarchyNode { id: string; parentId?: string; label: string; value: number; depth: number }
export interface WaterfallStep { key: string; label: string; order: number; kind: "START" | "DELTA" | "SUBTOTAL" | "TOTAL"; value: number; cumulativeValue: number }
export interface DistributionBin { key: string; label: string; order: number; kind: "STANDARD" | "UNDERFLOW" | "OVERFLOW"; lowerBound?: number; upperBound?: number; count: number }
export interface RankedRow { id: string; rank: number; label: string; primaryMeasure: TypedMeasure; secondaryMeasures: TypedMeasure[] }
export interface ScorecardRow { id: string; label: string; status: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "UNKNOWN"; measures: TypedMeasure[] }

export function record(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
export function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
const string = (value: unknown): value is string => typeof value === "string";
const unit = (value: unknown): value is CrmMetricUnit => ["COUNT", "MONEY", "PERCENT", "DURATION", "SCORE"].includes(String(value));
function list<T>(value: unknown, parse: (row: Record<string, unknown>) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((item) => { const row = record(item); return row ? parse(row) : null; });
  return parsed.some((item) => item === null) ? null : parsed as T[];
}
export function typedReferences(value: unknown): TypedReference[] | null {
  if (value === undefined) return [];
  return list(value, (row) => string(row.key) && string(row.label) && finite(row.value) && unit(row.unit)
    && ["TARGET", "BENCHMARK", "THRESHOLD_MIN", "THRESHOLD_MAX"].includes(String(row.kind))
    && (row.currencyCode === undefined || string(row.currencyCode)) ? row as unknown as TypedReference : null);
}
function measure(row: Record<string, unknown>): TypedMeasure | null {
  const references = typedReferences(row.references);
  return string(row.key) && string(row.label) && finite(row.value) && unit(row.unit) && references !== null
    && (row.currencyCode === undefined || string(row.currencyCode))
    ? { key: row.key, label: row.label, value: row.value, unit: row.unit, ...(string(row.currencyCode) ? { currencyCode: row.currencyCode } : {}), references } : null;
}
export function hierarchyNodes(typed: Record<string, unknown>): HierarchyNode[] | null {
  return list(typed.nodes, (row) => string(row.id) && string(row.label) && finite(row.value) && row.value >= 0
    && Number.isInteger(row.depth) && (row.depth as number) >= 0 && (row.parentId === undefined || string(row.parentId)) ? row as unknown as HierarchyNode : null);
}
export interface HierarchyTree { [key: string]: unknown; name: string; value: number; id: string; children?: HierarchyTree[] }
/** Leaves occupy area once. Parent totals must equal their children; never invent a residual node. */
export function hierarchyTree(nodes: HierarchyNode[]): HierarchyTree[] | null {
  if (nodes.length > 200 || new Set(nodes.map((node) => node.id)).size !== nodes.length) return null;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (nodes.some((node) => node.parentId && !byId.has(node.parentId))) return null;
  const children = new Map<string, HierarchyNode[]>();
  for (const node of nodes) if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]);
  const visiting = new Set<string>(); const visited = new Set<string>();
  const build = (node: HierarchyNode): HierarchyTree | null => {
    if (visiting.has(node.id)) return null;
    visiting.add(node.id);
    const nested = (children.get(node.id) ?? []).map(build);
    if (nested.some((item) => item === null)) return null;
    const valid = nested as HierarchyTree[];
    if (valid.length && Math.abs(valid.reduce((sum, child) => sum + child.value, 0) - node.value) > Math.max(1, Math.abs(node.value)) * 1e-9) return null;
    visiting.delete(node.id); visited.add(node.id);
    return { name: node.label, id: node.id, value: node.value, ...(valid.length ? { children: valid } : {}) };
  };
  const roots = nodes.filter((node) => !node.parentId).map(build);
  return roots.some((node) => !node) || visited.size !== nodes.length ? null : roots as HierarchyTree[];
}
export function waterfallSteps(typed: Record<string, unknown>): WaterfallStep[] | null {
  const rows = list(typed.steps, (row) => string(row.key) && string(row.label) && finite(row.order) && finite(row.value) && finite(row.cumulativeValue)
    && ["START", "DELTA", "SUBTOTAL", "TOTAL"].includes(String(row.kind)) ? row as unknown as WaterfallStep : null);
  return rows && rows.length <= 50 && new Set(rows.map((row) => row.key)).size === rows.length && new Set(rows.map((row) => row.order)).size === rows.length ? rows.toSorted((a, b) => a.order - b.order) : null;
}
export function distributionBins(typed: Record<string, unknown>): DistributionBin[] | null {
  const rows = list(typed.bins, (row) => string(row.key) && string(row.label) && finite(row.order) && finite(row.count) && row.count >= 0
    && Number.isInteger(row.count) && ["STANDARD", "UNDERFLOW", "OVERFLOW"].includes(String(row.kind))
    && (row.lowerBound === undefined || finite(row.lowerBound)) && (row.upperBound === undefined || finite(row.upperBound))
    ? row as unknown as DistributionBin : null);
  return rows && rows.length <= 50 && new Set(rows.map((row) => row.key)).size === rows.length && new Set(rows.map((row) => row.order)).size === rows.length ? rows.toSorted((a, b) => a.order - b.order) : null;
}
export function rankedRows(typed: Record<string, unknown>): RankedRow[] | null {
  const rows = list(typed.rows, (row) => {
    const primary = record(row.primaryMeasure); const parsed = primary ? measure(primary) : null;
    const secondary = list(row.secondaryMeasures, measure);
    return string(row.id) && string(row.label) && finite(row.rank) && Number.isInteger(row.rank) && row.rank > 0 && parsed && secondary
      ? { id: row.id, label: row.label, rank: row.rank, primaryMeasure: parsed, secondaryMeasures: secondary } : null;
  });
  return rows && rows.length <= 100 ? rows.toSorted((a, b) => a.rank - b.rank) : null;
}
export function scorecardRows(typed: Record<string, unknown>): ScorecardRow[] | null {
  const rows = list(typed.rows, (row) => {
    const measures = list(row.measures, measure);
    return string(row.id) && string(row.label) && ["ON_TRACK", "AT_RISK", "OFF_TRACK", "UNKNOWN"].includes(String(row.status)) && measures
      ? { id: row.id, label: row.label, status: row.status as ScorecardRow["status"], measures } : null;
  });
  return rows && rows.length <= 50 ? rows : null;
}

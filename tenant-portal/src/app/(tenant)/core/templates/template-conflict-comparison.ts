import type { EditorDocument } from "./template-editor-model";

export type TemplateDifferenceSide = "local" | "saved" | "same" | "conflict";
export type TemplateDifferenceArea = "structure" | "content" | "binding" | "layout" | "style" | "settings";
export interface TemplateDifferenceValue { present: boolean; value?: unknown }
export interface TemplateDifference {
  path: readonly string[];
  nodeId: string | null;
  nodeName: string | null;
  area: TemplateDifferenceArea;
  side: TemplateDifferenceSide;
  base: TemplateDifferenceValue;
  local: TemplateDifferenceValue;
  saved: TemplateDifferenceValue;
}
export interface TemplateConflictComparison {
  differences: readonly TemplateDifference[];
  counts: Readonly<Record<TemplateDifferenceSide, number>>;
  total: number;
  truncated: boolean;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((value, index) => sameValue(value, b[index]));
  if (!object(a) || !object(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameValue(a[key], b[key]));
}
function same(a: TemplateDifferenceValue, b: TemplateDifferenceValue): boolean {
  return a.present === b.present && (!a.present || sameValue(a.value, b.value));
}
function entry(parent: TemplateDifferenceValue, key: string): TemplateDifferenceValue {
  return object(parent.value) && Object.hasOwn(parent.value, key)
    ? { present: true, value: parent.value[key] } : { present: false };
}
function area(path: readonly string[]): TemplateDifferenceArea {
  if (path[0] === "nodes" && path.length === 2) return "structure";
  const field = path[0] === "nodes" ? path[2] : path[0];
  if (["nodes", "rootNodeIds", "canvasPages", "id", "type", "parentId", "childIds", "hidden", "locked"].includes(field)) return "structure";
  if (["props", "name"].includes(field)) return "content";
  if (field === "binding") return "binding";
  if (["page", "layout"].includes(field)) return "layout";
  if (["style", "theme"].includes(field)) return "style";
  return "settings";
}

/** Compare authored JSON only. Object key order is irrelevant; array order and exact strings are not. */
export function compareTemplateDocuments(base: EditorDocument, local: EditorDocument, saved: EditorDocument): TemplateConflictComparison {
  const differences: TemplateDifference[] = [];
  const counts: Record<TemplateDifferenceSide, number> = { local: 0, saved: 0, same: 0, conflict: 0 };
  const walk = (path: string[], before: TemplateDifferenceValue, ours: TemplateDifferenceValue, theirs: TemplateDifferenceValue) => {
    const localChanged = !same(before, ours), savedChanged = !same(before, theirs);
    if (!localChanged && !savedChanged) return;
    // Added/removed nodes and arrays stay atomic so deletion versus edit is visible as one conflict.
    if ([before, ours, theirs].every(value => value.present && object(value.value))) {
      const keys = [...new Set([before, ours, theirs].flatMap(value => Object.keys(value.value as Record<string, unknown>)))].sort();
      for (const key of keys) walk([...path, key], entry(before, key), entry(ours, key), entry(theirs, key));
      return;
    }
    const side = localChanged && savedChanged ? same(ours, theirs) ? "same" : "conflict" : localChanged ? "local" : "saved";
    counts[side] += 1;
    if (differences.length >= 200) return;
    const nodeId = path[0] === "nodes" && path.length > 1 ? path[1] : null;
    const node = nodeId ? local.nodes[nodeId] ?? saved.nodes[nodeId] ?? base.nodes[nodeId] : null;
    differences.push({ path, nodeId, nodeName: typeof node?.name === "string" && node.name.trim() ? node.name : null,
      area: area(path), side, base: before, local: ours, saved: theirs });
  };
  walk([], { present: true, value: base }, { present: true, value: local }, { present: true, value: saved });
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { differences, counts, total, truncated: total > differences.length };
}

export function formatTemplateDifferenceValue(value: TemplateDifferenceValue): { text: string; truncated: boolean } | null {
  if (!value.present) return null;
  const text = typeof value.value === "string" ? JSON.stringify(value.value) : JSON.stringify(value.value) ?? "";
  return { text: text.slice(0, 240), truncated: text.length > 240 };
}

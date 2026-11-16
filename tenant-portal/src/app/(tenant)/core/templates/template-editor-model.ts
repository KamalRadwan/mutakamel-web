import { assertPersistedTemplateJson } from "./template-persisted-json";
import { generateUUIDv7 } from "@/lib/uuid";
import { invalidCoreResponse, record } from "../contracts/core-page";

/** Schema-v1 authoring projection; unknown properties are preserved on every edit. */
export interface EditorNode extends Record<string, unknown> {
  id: string; type: string; parentId: string | null; childIds: string[]; locked: boolean; hidden: boolean;
  layout: Record<string, unknown>; style: Record<string, unknown>; props: Record<string, unknown>;
  name?: string; binding?: { path: string; nullBehavior: string; [key: string]: unknown };
}
export interface EditorDocument extends Record<string, unknown> {
  schemaVersion: 1; rootNodeIds: string[]; nodes: Record<string, EditorNode>;
  theme: Record<string, unknown>; direction: string;
  page?: { unit: string; preset: string; widthMm: number; heightMm: number; orientation: string; marginMm: { top: number; end: number; bottom: number; start: number }; [key: string]: unknown };
}

export function parseEditorDocument(value: unknown): EditorDocument {
  assertPersistedTemplateJson(value);
  const document = record(value);
  const nodes = record(document?.nodes);
  if (!document || document.schemaVersion !== 1 || !nodes || !record(document.theme) || typeof document.direction !== "string" || !Array.isArray(document.rootNodeIds) || !document.rootNodeIds.every((id: unknown) => typeof id === "string" && Object.hasOwn(nodes, id))) invalidCoreResponse();
  for (const [id, value] of Object.entries(nodes)) {
    const node = record(value);
    if (!node || node.id !== id || typeof node.type !== "string" || !(node.parentId === null || typeof node.parentId === "string") || typeof node.locked !== "boolean" || typeof node.hidden !== "boolean" || !Array.isArray(node.childIds) || !node.childIds.every((child: unknown) => typeof child === "string" && Object.hasOwn(nodes, child)) || !record(node.layout) || !record(node.style) || !record(node.props)) invalidCoreResponse();
  }
  return document as EditorDocument;
}

export function orderedEditorNodes(document: EditorDocument): EditorNode[] {
  const output: EditorNode[] = [];
  const visited = new Set<string>();
  const visit = (ids: string[]) => { for (const id of ids) { if (visited.has(id)) continue; visited.add(id); const node = document.nodes[id]; if (node) { output.push(node); visit(node.childIds); } } };
  visit(document.rootNodeIds);
  return output;
}

export function updateEditorNode(document: EditorDocument, id: string, patch: Partial<EditorNode>): EditorDocument {
  const node = document.nodes[id];
  if (!node || node.locked) return document;
  return { ...document, nodes: { ...document.nodes, [id]: { ...node, ...patch, id: node.id, parentId: node.parentId, childIds: node.childIds, type: node.type } } };
}

export function moveEditorNode(document: EditorDocument, id: string, delta: -1 | 1): EditorDocument {
  const node = document.nodes[id];
  if (!node || node.locked) return document;
  const parent = node.parentId ? document.nodes[node.parentId] : null;
  if (parent?.locked) return document;
  const ids = [...(parent?.childIds ?? document.rootNodeIds)];
  const index = ids.indexOf(id);
  const next = index + delta;
  if (index < 0 || next < 0 || next >= ids.length || document.nodes[ids[next]]?.locked) return document;
  [ids[index], ids[next]] = [ids[next], ids[index]];
  const nodes = { ...document.nodes };
  ids.forEach((key, order) => { const sibling = nodes[key]; if (sibling.layout.kind === "FLOW") nodes[key] = { ...sibling, layout: { ...sibling.layout, order } }; });
  if (parent) nodes[parent.id] = { ...parent, childIds: ids };
  return { ...document, nodes, rootNodeIds: parent ? document.rootNodeIds : ids };
}

export function removeEditorNode(document: EditorDocument, id: string): EditorDocument {
  const node = document.nodes[id];
  if (!node || node.locked || (node.parentId && document.nodes[node.parentId]?.locked)) return document;
  const removed = new Set<string>();
  const collect = (key: string) => { if (removed.has(key)) return; removed.add(key); document.nodes[key]?.childIds.forEach(collect); };
  collect(id);
  if ([...removed].some((key) => document.nodes[key]?.locked)) return document;
  const nodes = Object.fromEntries(Object.entries(document.nodes).filter(([key]) => !removed.has(key)));
  if (node.parentId && nodes[node.parentId]) nodes[node.parentId] = { ...nodes[node.parentId], childIds: nodes[node.parentId].childIds.filter((key) => key !== id) };
  return { ...document, nodes, rootNodeIds: document.rootNodeIds.filter((key) => key !== id) };
}

export function appendEditorNode(document: EditorDocument, type: "text" | "divider" | "dataField", content: string): EditorDocument {
  const id = generateUUIDv7();
  const props = type === "text" ? { text: content } : type === "divider" ? { thicknessPx: 1, style: "SOLID", color: "#E2E8F0" } : { label: content, labelPosition: "BEFORE", separator: ": " };
  const node: EditorNode = { id, type, parentId: null, childIds: [], locked: false, hidden: false, layout: { kind: "FLOW", order: document.rootNodeIds.length }, style: {}, props,
    ...(type === "dataField" ? { binding: { path: content, nullBehavior: "EMPTY" } } : {}) };
  return { ...document, nodes: { ...document.nodes, [id]: node }, rootNodeIds: [...document.rootNodeIds, id] };
}

export function appendEditorElement(document: EditorDocument, type: "image" | "dynamicTable" | "totals", props: Record<string, unknown>): EditorDocument {
  const id = generateUUIDv7();
  const node: EditorNode = { id, type, parentId: null, childIds: [], locked: false, hidden: false, layout: { kind: "FLOW", order: document.rootNodeIds.length }, style: {}, props };
  return { ...document, nodes: { ...document.nodes, [id]: node }, rootNodeIds: [...document.rootNodeIds, id] };
}

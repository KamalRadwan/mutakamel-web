import { TEMPLATE_LIMITS, type TemplateValueFormatV1 } from "@mutakamel/template-schema/browser-safe";
import { generateUUIDv7 } from "@/lib/uuid";
import type { EditorDocument, EditorNode } from "../template-editor-model";
import { clonePageValue, PageCommandError, requireUnlocked } from "./page-contract";

export interface ZoneEdit { enabled: boolean; heightMm: number; zoneMode: "FIXED" | "FLOW"; repeat: "EVERY_PAGE" | "FIRST_PAGE" | "LAST_PAGE" }
export interface ZoneSetup { header: ZoneEdit; footer: ZoneEdit }
export function readZoneSetup(document: EditorDocument): ZoneSetup {
  const read = (type: "header" | "footer"): ZoneEdit => {
    const node = document.rootNodeIds.map(id => document.nodes[id]).find(node => node.type === type);
    return { enabled: !!node, heightMm: Number(node?.props.heightMm ?? (type === "header" ? 24 : 18)), zoneMode: node?.props.zoneMode === "FIXED" ? "FIXED" : "FLOW", repeat: (node?.props.repeat ?? "EVERY_PAGE") as ZoneEdit["repeat"] };
  };
  return { header: read("header"), footer: read("footer") };
}
export function updateZones(document: EditorDocument, setup: ZoneSetup): EditorDocument {
  if (!["FLOW_DOCUMENT", "HYBRID_DOCUMENT"].includes(String(document.layoutMode))) throw new PageCommandError("unsupported");
  const candidate = clonePageValue(document);
  const roots = candidate.rootNodeIds.map(id => candidate.nodes[id]);
  const body = roots.find(node => node.type === "container" && node.props.semanticRole === "BODY");
  if (!body) throw new PageCommandError("invalid");
  requireUnlocked(document, [body.id]);
  const ids: string[] = [];
  for (const type of ["header", "footer"] as const) {
    const edit = setup[type], existing = roots.find(node => node.type === type);
    if (existing) requireUnlocked(document, [existing.id]);
    if (!edit.enabled) {
      if (existing?.childIds.length) throw new PageCommandError("invalid");
      if (existing) delete candidate.nodes[existing.id];
      continue;
    }
    // A layout switch cannot reinterpret authored coordinates without a conversion contract.
    if (existing?.childIds.length && existing.props.zoneMode !== edit.zoneMode) throw new PageCommandError("unsupported");
    const id = existing?.id ?? generateUUIDv7();
    candidate.nodes[id] = existing ? { ...existing, props: { ...existing.props, heightMm: edit.heightMm, zoneMode: edit.zoneMode, repeat: edit.repeat } }
      : { id, type, parentId: null, childIds: [], locked: false, hidden: false, layout: { kind: "FLOW", order: type === "header" ? 0 : 2 }, style: {}, props: { heightMm: edit.heightMm, zoneMode: edit.zoneMode, repeat: edit.repeat } };
    ids.push(id);
  }
  const header = ids.find(id => candidate.nodes[id].type === "header"), footer = ids.find(id => candidate.nodes[id].type === "footer");
  candidate.rootNodeIds = [...(header ? [header] : []), body.id, ...(footer ? [footer] : [])];
  candidate.rootNodeIds.forEach((id, order) => { const node = candidate.nodes[id]; node.layout = { ...node.layout, order }; });
  return candidate;
}
function bodyFlowNode(document: EditorDocument, nodeId: string): EditorNode {
  if (!["FLOW_DOCUMENT", "HYBRID_DOCUMENT"].includes(String(document.layoutMode))) throw new PageCommandError("unsupported");
  const node = document.nodes[nodeId];
  if (!node || node.layout.kind !== "FLOW" || !node.parentId) throw new PageCommandError("unsupported");
  let ancestor: EditorNode | undefined = document.nodes[node.parentId];
  while (ancestor?.parentId) ancestor = document.nodes[ancestor.parentId];
  if (!ancestor || ancestor.type !== "container" || ancestor.props.semanticRole !== "BODY") throw new PageCommandError("unsupported");
  requireUnlocked(document, [nodeId]); return node;
}
export function updateFlowPagination(document: EditorDocument, nodeId: string, patch: { keepTogether?: boolean; breakBefore?: boolean; breakAfter?: boolean }): EditorDocument {
  const node = bodyFlowNode(document, nodeId);
  return { ...document, nodes: { ...document.nodes, [nodeId]: { ...node, layout: { ...node.layout, ...patch } } } };
}
export function canPaginateFlowNode(document: EditorDocument, nodeId: string): boolean {
  try { bodyFlowNode(document, nodeId); return true; } catch { return false; }
}
export function flowBodyDestination(document: EditorDocument, selectedId: string): EditorNode | undefined {
  if (document.layoutMode !== "FLOW_DOCUMENT" && document.layoutMode !== "HYBRID_DOCUMENT") return;
  const node = document.nodes[selectedId];
  if (node?.type === "container" && node.parentId === null && document.rootNodeIds.includes(selectedId) &&
    node.props.semanticRole === "BODY" && node.layout.kind === "FLOW" && !node.locked && !node.hidden &&
    node.childIds.length < TEMPLATE_LIMITS.maxChildrenPerNode && node.childIds.every(id => {
      const layout = document.nodes[id]?.layout;
      return layout?.kind === "FLOW" && typeof layout.order === "number" && Number.isInteger(layout.order) &&
        layout.order >= 0 && layout.order < TEMPLATE_LIMITS.maxChildrenPerNode;
    })) return node;
}

function appendFlowBodyNode(document: EditorDocument, body: EditorNode, content: Pick<EditorNode, "type" | "props">): EditorDocument {
  const id = generateUUIDv7();
  const order = Math.max(-1, ...body.childIds.map(childId => Number(document.nodes[childId].layout.order))) + 1;
  const node: EditorNode = { ...content, id, parentId: body.id, childIds: [], locked: false, hidden: false,
    layout: { kind: "FLOW", order }, style: {} };
  return { ...document, nodes: { ...document.nodes, [body.id]: { ...body, childIds: [...body.childIds, id] }, [id]: node } };
}

export function appendFlowBodyText(document: EditorDocument, selectedId: string, text: string): EditorDocument | null {
  const body = flowBodyDestination(document, selectedId);
  return body ? appendFlowBodyNode(document, body, { type: "text", props: { text } }) : null;
}

export function appendFlowBodyDivider(document: EditorDocument, selectedId: string): EditorDocument | null {
  const body = flowBodyDestination(document, selectedId);
  return body ? appendFlowBodyNode(document, body, { type: "divider", props: {
    thicknessPx: 1, style: "SOLID", color: "#E2E8F0",
  } }) : null;
}

export function appendFlowBodyImage(document: EditorDocument, selectedId: string, assetId: string, alt: string): EditorDocument | null {
  const body = flowBodyDestination(document, selectedId);
  return body ? appendFlowBodyNode(document, body, { type: "image", props: { assetId, alt, decorative: false } }) : null;
}

export function appendFlowBodyTotals(document: EditorDocument, selectedId: string, paths: readonly string[]): EditorDocument | null {
  const body = flowBodyDestination(document, selectedId);
  if (!body || !paths.length) return null;
  const rows = paths.map(path => ({
    id: generateUUIDv7(), label: path.split(".").at(-1),
    binding: { path, nullBehavior: "EMPTY", format: { type: "CURRENCY" } },
    emphasis: "NORMAL", visible: true,
  }));
  return appendFlowBodyNode(document, body, { type: "totals", props: { rows } });
}

export function appendFlowBodyTable(document: EditorDocument, selectedId: string, sourcePath: string,
  rowKeyPath: string, columnPaths: readonly string[], formatColumn?: (path: string) => TemplateValueFormatV1 | undefined): EditorDocument | null {
  const body = flowBodyDestination(document, selectedId);
  if (!body || !columnPaths.length || columnPaths.length > TEMPLATE_LIMITS.maxTableColumns) return null;
  const page = document.page;
  const salesLineTable = document.dataSourceKey === "TRADE_QUOTATION_PRINT_V1" && sourcePath === "quotation.items";
  // Match the Sales starters' 5px inline padding and leave room for text on narrow paper.
  const printableWidthPx = page ? (page.widthMm - page.marginMm.start - page.marginMm.end) * 96 / 25.4 : 0;
  const columnWidthPx = printableWidthPx / columnPaths.length;
  const inlinePadding = Math.min(5, Math.max(2, Math.floor(columnWidthPx / 23)));
  const cellStyle = salesLineTable && columnWidthPx >= 16
    ? { paddingPx: { top: 1, end: inlinePadding, bottom: 1, start: inlinePadding } }
    : undefined;
  const columns = columnPaths.map(path => {
    const format = formatColumn?.(path);
    return {
      id: generateUUIDv7(), header: { kind: "TEXT", value: path.split(".").at(-1) },
      value: { kind: "BINDING", binding: { path, nullBehavior: "EMPTY", ...(format ? { format } : {}) } },
      width: { value: 100 / columnPaths.length, unit: "PERCENT" },
      align: format?.type === "NUMBER" || format?.type === "CURRENCY" ? "END" : "START",
      verticalAlign: "TOP", wrap: true, visible: true,
      ...(cellStyle ? { headerStyle: cellStyle, cellStyle } : {}),
    };
  });
  return appendFlowBodyNode(document, body, { type: "dynamicTable", props: {
    sourcePath, rowKeyPath, columns, repeatHeader: "EVERY_PAGE", keepRowsTogether: true, rowSplit: "AVOID",
    minimumEmptyRows: 0, emptyBehavior: "HEADER_ONLY", stripedRows: true,
  } });
}

export function insertFlowPageBreak(document: EditorDocument, beforeId: string): { document: EditorDocument; selectedId: string } {
  const node = bodyFlowNode(document, beforeId), candidate = clonePageValue(document), id = generateUUIDv7();
  const parent = candidate.nodes[node.parentId!], index = parent.childIds.indexOf(beforeId);
  if (index < 0 || parent.type === "row") throw new PageCommandError("unsupported");
  candidate.nodes[id] = { id, type: "pageBreak", parentId: parent.id, childIds: [], locked: false, hidden: false, layout: { kind: "FLOW", order: index }, style: {}, props: {} };
  parent.childIds.splice(index, 0, id);
  parent.childIds.forEach((key, order) => { candidate.nodes[key].layout = { ...candidate.nodes[key].layout, order }; });
  return { document: candidate, selectedId: id };
}

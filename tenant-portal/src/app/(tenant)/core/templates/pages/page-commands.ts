import { generateUUIDv7 } from "@/lib/uuid";
import type { EditorDocument, EditorNode } from "../template-editor-model";
import { clonePageValue, explicitPages, PageCommandError, pageTree, requireUnlocked, type CanvasPage, type PageConfig, type PageNative } from "./page-contract";

const sizes = { A4: [210, 297], A5: [148, 210], LETTER: [215.9, 279.4] } as const;
export function formatPage(page: PageConfig, preset: keyof typeof sizes | "CUSTOM", orientation: "PORTRAIT" | "LANDSCAPE"): PageConfig {
  const [short, long] = preset === "CUSTOM" || preset === page.preset
    ? [Math.min(page.widthMm, page.heightMm), Math.max(page.widthMm, page.heightMm)]
    : sizes[preset];
  return { ...clonePageValue(page), preset, orientation, widthMm: orientation === "LANDSCAPE" ? long : short, heightMm: orientation === "LANDSCAPE" ? short : long };
}
export function pageBodySize(document: EditorDocument, page: PageConfig) {
  const zoneHeight = document.layoutMode === "FIXED_CANVAS" ? 0 : document.rootNodeIds.reduce((height, id) => {
    const node = document.nodes[id];
    return height + (["header", "footer"].includes(node.type) ? Number(node.props.heightMm) : 0);
  }, 0);
  return { width: page.widthMm - page.marginMm.start - page.marginMm.end, height: page.heightMm - page.marginMm.top - page.marginMm.bottom - zoneHeight };
}
export function updatePageSetup(document: EditorDocument, page: PageConfig, pageId?: string): EditorDocument {
  if (document.layoutMode === "EMAIL_FLOW") throw new PageCommandError("unsupported");
  const candidate = clonePageValue(document);
  if (document.layoutMode === "FIXED_CANVAS" && document.canvasPages) {
    const target = explicitPages(candidate).find(entry => entry.id === pageId);
    if (!target) throw new PageCommandError("stale");
    target.page = clonePageValue(page);
  } else candidate.page = clonePageValue(page);
  const body = pageBodySize(candidate, page);
  if (!Number.isFinite(body.width) || !Number.isFinite(body.height) || body.width <= 0 || body.height <= 0) throw new PageCommandError("invalid");
  return candidate;
}
function installPages(document: EditorDocument, pages: CanvasPage[]): EditorDocument {
  return { ...document, canvasPages: pages, rootNodeIds: pages.flatMap(page => page.rootNodeIds) };
}
function freshIds(document: EditorDocument, native: PageNative) {
  const occupied = new Set([...native.collectTemplateCopyIds(document, document.rootNodeIds), ...explicitPages(document).map(page => page.id)]);
  return () => { let id = generateUUIDv7(); while (occupied.has(id)) id = generateUUIDv7(); occupied.add(id); return id; };
}
export function addFixedPage(document: EditorDocument, afterId: string, name: string, native: PageNative): { document: EditorDocument; pageId: string } {
  const pages = clonePageValue(explicitPages(document));
  const index = pages.findIndex(page => page.id === afterId);
  if (index < 0) throw new PageCommandError("stale");
  const fresh = freshIds(document, native), pageId = fresh(), bodyId = fresh();
  const body: EditorNode = { id: bodyId, type: "container", parentId: null, childIds: [], locked: false, hidden: false, layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } };
  pages.splice(index + 1, 0, { id: pageId, name, page: clonePageValue(pages[index].page), rootNodeIds: [bodyId] });
  return { document: installPages({ ...document, nodes: { ...document.nodes, [bodyId]: body } }, pages), pageId };
}
export function duplicateFixedPage(document: EditorDocument, pageId: string, name: string, native: PageNative) {
  const pages = clonePageValue(explicitPages(document)), index = pages.findIndex(page => page.id === pageId);
  if (index < 0) throw new PageCommandError("stale");
  const fresh = freshIds(document, native), idMap: Record<string, string> = {};
  // Native remapping owns internal table/cell/formula IDs. External resource and function pins stay exact.
  for (const id of native.collectTemplateCopyIds(document, document.rootNodeIds)) idMap[id] = fresh();
  const copied = native.remapTemplateDocumentNodes(document, idMap), nodes = { ...document.nodes };
  for (const id of pageTree(document, pages[index].rootNodeIds)) nodes[idMap[id]] = copied.nodes[idMap[id]];
  const newPageId = fresh();
  pages.splice(index + 1, 0, { ...pages[index], id: newPageId, name, rootNodeIds: pages[index].rootNodeIds.map(id => idMap[id]) });
  return { document: installPages({ ...document, nodes }, pages), pageId: newPageId };
}
export function reorderFixedPage(document: EditorDocument, pageId: string, delta: -1 | 1): EditorDocument {
  const pages = [...explicitPages(document)], index = pages.findIndex(page => page.id === pageId), target = index + delta;
  if (index < 0) throw new PageCommandError("stale");
  if (target < 0 || target >= pages.length) return document;
  [pages[index], pages[target]] = [pages[target], pages[index]];
  return installPages(document, pages);
}
export function removeFixedPage(document: EditorDocument, pageId: string): EditorDocument {
  const pages = explicitPages(document), page = pages.find(entry => entry.id === pageId);
  if (!page) throw new PageCommandError("stale");
  if (pages.length === 1) throw new PageCommandError("lastPage");
  const removed = pageTree(document, page.rootNodeIds); requireUnlocked(document, removed);
  const nodes = Object.fromEntries(Object.entries(document.nodes).filter(([id]) => !removed.has(id)));
  return installPages({ ...document, nodes }, pages.filter(entry => entry.id !== pageId));
}
export function moveToFixedPage(document: EditorDocument, nodeIds: string[], pageId: string, native: PageNative): EditorDocument {
  const page = explicitPages(document).find(entry => entry.id === pageId);
  if (!page) throw new PageCommandError("stale");
  return native.prepareTemplateGraphCommand(document, { kind: "MOVE", nodeIds, destinationParentId: page.rootNodeIds[0], deltaMm: { x: 0, y: 0 } }).candidate;
}

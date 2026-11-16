import { generateUUIDv7 } from "@/lib/uuid";
import type { EditorDocument, EditorNode } from "./template-editor-model";
import type { DesignerNativeGeometry, Point } from "./designer-interaction-contract";
import { absoluteFrame, selectedGeometryRoots, validatedGeometryDocument } from "./designer-geometry-commands";

export interface DesignerClipboard { readonly version: 1; readonly ownerKey: string; readonly document: EditorDocument; readonly nodeIds: readonly string[] }
export function copyDesignerSelection(document: EditorDocument, ids: readonly string[], native: DesignerNativeGeometry, ownerKey: string): DesignerClipboard {
  const source = validatedGeometryDocument(native, document), nodeIds = selectedGeometryRoots(source, ids);
  native.collectTemplateCopyIds(source, nodeIds);
  return Object.freeze({ version: 1, ownerKey, document: JSON.parse(JSON.stringify(source)) as EditorDocument, nodeIds: Object.freeze(nodeIds) });
}
export function removeDesignerSelection(document: EditorDocument, ids: readonly string[], native: DesignerNativeGeometry): EditorDocument {
  const source = validatedGeometryDocument(native, document), candidate = JSON.parse(JSON.stringify(source)) as EditorDocument, removed = new Set<string>();
  const collect = (id: string) => { if (removed.has(id)) throw new Error("Invalid clipboard subtree"); removed.add(id); candidate.nodes[id].childIds.forEach(collect); };
  for (const id of ids) { if (!candidate.nodes[id].parentId) throw new Error("Document roots cannot be cut"); collect(id); }
  for (const id of removed) delete candidate.nodes[id];
  for (const node of Object.values(candidate.nodes)) node.childIds = node.childIds.filter(id => !removed.has(id));
  return validatedGeometryDocument(native, candidate);
}
export function pasteDesignerSelection(current: EditorDocument, clipboard: DesignerClipboard, destinationParentId: string, deltaMm: Point, native: DesignerNativeGeometry, ownerKey: string) {
  if (clipboard.version !== 1 || clipboard.ownerKey !== ownerKey) throw new Error("Clipboard belongs to a different draft authority");
  const source = validatedGeometryDocument(native, clipboard.document), target = validatedGeometryDocument(native, current);
  const destination = target.nodes[destinationParentId];
  if (!destination || !["container", "row", "column", "group", "header", "footer"].includes(destination.type)) throw new Error("Choose a compatible destination");
  let ancestor: EditorNode | undefined = destination;
  while (ancestor) { if (ancestor.locked || ancestor.hidden) throw new Error("Unlock and show the destination"); ancestor = ancestor.parentId ? target.nodes[ancestor.parentId] : undefined; }
  const nodeIds = selectedGeometryRoots(source, clipboard.nodeIds), parentId = source.nodes[nodeIds[0]].parentId;
  if (!parentId || nodeIds.some(id => source.nodes[id].parentId !== parentId)) throw new Error("Copy objects sharing a parent");
  const roots = (document: EditorDocument) => [...new Set([...document.rootNodeIds, ...(Array.isArray(document.canvasPages) ? document.canvasPages.flatMap(page => page.rootNodeIds) : [])])];
  const currentIds = new Set([...native.collectTemplateCopyIds(target, roots(target)), ...native.collectTemplateCopyIds(source, roots(source))]);
  for (const document of [source, target]) for (const page of Array.isArray(document.canvasPages) ? document.canvasPages : []) currentIds.add(page.id);
  const idMap: Record<string, string> = {};
  const selectedCopyIds = native.collectTemplateCopyIds(source, nodeIds);
  for (const id of native.collectTemplateCopyIds(source, roots(source))) {
    let fresh = generateUUIDv7(); while (currentIds.has(fresh) || Object.values(idMap).includes(fresh)) fresh = generateUUIDv7();
    idMap[id] = fresh;
  }
  for (const id of nodeIds) {
    let node: EditorNode | undefined = source.nodes[id];
    while (node) { if (node.locked) throw new Error("Unlock the copied object or its parent"); node = node.parentId ? source.nodes[node.parentId] : undefined; }
  }
  // Public native remapping preserves exact internal references without doubling
  // the source graph and exhausting its node budget before a valid cut/paste.
  const copied = native.remapTemplateDocumentNodes(source, idMap);
  const sourceGeometry = native.projectTemplateGeometry(source), targetGeometry = native.projectTemplateGeometry(target), targetFrame = targetGeometry.get(destination.id);
  const candidate = JSON.parse(JSON.stringify(target)) as EditorDocument;
  const newIds = selectedCopyIds.map(id => idMap[id]).filter(id => Object.hasOwn(copied.nodes, id));
  for (const id of newIds) candidate.nodes[id] = copied.nodes[id];
  const selectedIds = nodeIds.map(id => idMap[id]);
  for (let index = 0; index < nodeIds.length; index++) {
    const original = source.nodes[nodeIds[index]], node = candidate.nodes[selectedIds[index]];
    if (original.layout.kind === "ABSOLUTE") {
      const origin = sourceGeometry.get(original.id);
      if (!origin || !targetFrame || (target.layoutMode !== "FIXED_CANVAS" && origin.zoneKey !== targetFrame.zoneKey)) throw new Error("Incompatible destination page or fixed zone");
      const shift = native.translateTemplateMatrix(deltaMm.x + targetFrame.pageOrigin.x - origin.pageOrigin.x, deltaMm.y + targetFrame.pageOrigin.y - origin.pageOrigin.y);
      node.layout = { ...native.templateFrameFromMatrix(native.multiplyTemplateMatrices(native.invertTemplateMatrix(targetFrame.matrix), native.multiplyTemplateMatrices(shift, origin.matrix)), absoluteFrame(original)) };
    } else {
      if (targetFrame || destination.layout.kind !== "FLOW" || deltaMm.x || deltaMm.y) throw new Error("Flow paste requires a flow destination and no free-position shift");
      node.layout = { ...node.layout, order: Math.max(-1, ...candidate.nodes[destination.id].childIds.map(id => Number(candidate.nodes[id].layout.order))) + 1 };
    }
    node.parentId = destination.id; candidate.nodes[destination.id].childIds.push(node.id);
  }
  return { document: validatedGeometryDocument(native, candidate), selectedIds };
}

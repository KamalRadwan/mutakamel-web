import type { EditorDocument, EditorNode } from "./template-editor-model";
import type { DesignerNativeGeometry, Frame, GraphCommand, Matrix, Point } from "./designer-interaction-contract";

export function validatedGeometryDocument(native: DesignerNativeGeometry, input: EditorDocument): EditorDocument {
  const result = native.validateTemplateDocumentModel(input);
  if (!result.valid || !result.document) {
    const error = new Error(result.issues[0]?.message ?? "Native document admission failed");
    Object.assign(error, { code: result.issues[0]?.code, nodeId: result.issues[0]?.nodeId }); throw error;
  }
  return result.document;
}
export function prepareGeometryCommand(native: DesignerNativeGeometry, source: EditorDocument, command: GraphCommand): EditorDocument {
  const initial = validatedGeometryDocument(native, source);
  const result = native.prepareTemplateGraphCommand(initial, command);
  if (result.status !== "VALIDATION_REQUIRED") throw new Error("Unconfirmed native command");
  return validatedGeometryDocument(native, result.candidate);
}
export function frameValues(frame: Frame): Frame { return { x: frame.x, y: frame.y, width: frame.width, height: frame.height, rotationDeg: frame.rotationDeg, zIndex: frame.zIndex }; }
export function absoluteFrame(node: EditorNode) {
  const frame = node.layout;
  if (frame.kind !== "ABSOLUTE" || frame.unit !== "MM" || ![frame.x, frame.y, frame.width, frame.height, frame.rotationDeg, frame.zIndex].every(value => typeof value === "number" && Number.isFinite(value))) throw new Error("Eligible absolute frame required");
  return { kind: "ABSOLUTE", unit: "MM", x: frame.x, y: frame.y, width: frame.width, height: frame.height, rotationDeg: frame.rotationDeg, zIndex: frame.zIndex } as Frame & { kind: "ABSOLUTE"; unit: "MM" };
}
export function selectedGeometryRoots(document: EditorDocument, ids: readonly string[]): string[] {
  const selected = new Set(ids);
  if (!selected.size || [...selected].some(id => !document.nodes[id])) throw new Error("Select existing objects");
  return [...selected].filter(id => {
    let node = document.nodes[id]; const seen = new Set<string>();
    while (node.parentId) { if (seen.has(node.id)) throw new Error("Invalid ancestry"); seen.add(node.id); if (selected.has(node.parentId)) return false; node = document.nodes[node.parentId]; if (!node) throw new Error("Missing parent"); }
    return true;
  });
}
export function assertGeometryEditable(document: EditorDocument, ids: readonly string[]) {
  const visit = (id: string) => { const node = document.nodes[id]; if (!node || node.locked || node.hidden) throw new Error("Unlock and show the selected objects before editing"); node.childIds.forEach(visit); };
  for (const id of ids) {
    let node = document.nodes[id]; if (!node?.parentId) throw new Error("Document roots are not free-position objects");
    visit(id);
    while (node.parentId) { node = document.nodes[node.parentId]; if (!node || node.locked || node.hidden) throw new Error("Unlock and show the parent before editing"); }
  }
}
export function geometryParent(document: EditorDocument, nodeId: string, native: DesignerNativeGeometry): Matrix {
  const parentId = document.nodes[nodeId]?.parentId;
  const context = parentId ? native.projectTemplateGeometry(document).get(parentId) : undefined;
  if (!context) throw new Error("Eligible page or fixed zone required");
  return context.matrix;
}
export function pageSelection(document: EditorDocument, ids: readonly string[], native: DesignerNativeGeometry) {
  const contexts = native.projectTemplateGeometry(document);
  const first = contexts.get(ids[0]);
  if (!first || ids.some(id => contexts.get(id)?.pageKey !== first.pageKey)) throw new Error("Select objects on one page");
  return { contexts, pageKey: first.pageKey };
}
export function geometryBounds(points: readonly Point[]) {
  if (!points.length || points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new Error("Finite geometry required");
  const x = Math.min(...points.map(point => point.x)), y = Math.min(...points.map(point => point.y));
  return { x, y, width: Math.max(...points.map(point => point.x)) - x, height: Math.max(...points.map(point => point.y)) - y };
}
export function pageBounds(document: EditorDocument, ids: readonly string[], native: DesignerNativeGeometry) {
  const { contexts } = pageSelection(document, ids, native);
  return geometryBounds(ids.flatMap(id => { const frame = contexts.get(id)!; return native.templateFrameCorners(frame.matrix, frame.width, frame.height); }));
}
export function translatePageFrames(document: EditorDocument, ids: readonly string[], native: DesignerNativeGeometry, delta: Point): GraphCommand {
  return { kind: "TRANSFORM", changes: ids.map(nodeId => {
    const frame = absoluteFrame(document.nodes[nodeId]), parent = geometryParent(document, nodeId, native), inverse = native.invertTemplateMatrix(parent);
    const zero = native.transformTemplatePoint(inverse, { x: 0, y: 0 }), shifted = native.transformTemplatePoint(inverse, delta);
    return { nodeId, frame: { ...frameValues(frame), x: frame.x + shifted.x - zero.x, y: frame.y + shifted.y - zero.y } };
  }) };
}

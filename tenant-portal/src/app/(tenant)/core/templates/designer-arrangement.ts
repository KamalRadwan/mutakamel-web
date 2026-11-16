import type { EditorDocument } from "./template-editor-model";
import type { DesignerNativeGeometry, GraphCommand } from "./designer-interaction-contract";
import { absoluteFrame, frameValues, pageBounds, pageSelection, translatePageFrames, validatedGeometryDocument } from "./designer-geometry-commands";

export function arrangeSelection(document: EditorDocument, ids: readonly string[], native: DesignerNativeGeometry, action: "start" | "center" | "end" | "top" | "middle" | "bottom" | "horizontal" | "vertical", direction: "LTR" | "RTL"): GraphCommand {
  pageSelection(document, ids, native);
  if (ids.length < 2) throw new Error("Select at least two objects");
  const bounds = pageBounds(document, ids, native), boxes = ids.map(id => ({ id, ...pageBounds(document, [id], native) }));
  const horizontal = ["start", "center", "end", "horizontal"].includes(action), axis = horizontal ? "x" : "y", dimension = horizontal ? "width" : "height";
  const distributed = action === "horizontal" || action === "vertical";
  if (distributed && ids.length < 3) throw new Error("Select at least three objects to distribute");
  const sorted = [...boxes].sort((a, b) => a[axis] - b[axis]);
  const gap = distributed ? (bounds[dimension] - boxes.reduce((total, box) => total + box[dimension], 0)) / (ids.length - 1) : 0;
  let cursor = bounds[axis];
  const changes = sorted.flatMap(box => {
    const leading = action === "start" ? direction === "LTR" : action === "top";
    const middle = action === "center" || action === "middle";
    const target = distributed ? cursor : bounds[axis] + (middle ? (bounds[dimension] - box[dimension]) / 2 : leading ? 0 : bounds[dimension] - box[dimension]);
    cursor += box[dimension] + gap;
    const command = translatePageFrames(document, [box.id], native, { x: horizontal ? target - box.x : 0, y: horizontal ? 0 : target - box.y });
    return command.kind === "TRANSFORM" ? command.changes : [];
  });
  return { kind: "TRANSFORM", changes };
}
export function setSelectionFlags(document: EditorDocument, ids: readonly string[], native: DesignerNativeGeometry, flags: { locked?: boolean; hidden?: boolean }) {
  const candidate = JSON.parse(JSON.stringify(document)) as EditorDocument;
  for (const id of ids) { if (!candidate.nodes[id]) throw new Error("Missing selected node"); Object.assign(candidate.nodes[id], flags); }
  return validatedGeometryDocument(native, candidate);
}
export function changeSelectionLayer(document: EditorDocument, ids: readonly string[], native: DesignerNativeGeometry, delta: -1 | 1): GraphCommand {
  pageSelection(document, ids, native);
  return { kind: "TRANSFORM", changes: ids.map(nodeId => {
    const old = absoluteFrame(document.nodes[nodeId]), zIndex = old.zIndex + delta;
    if (zIndex < 0 || zIndex > 1000) throw new Error("Layer must remain between 0 and 1000");
    return { nodeId, frame: { ...frameValues(old), zIndex } };
  }) };
}

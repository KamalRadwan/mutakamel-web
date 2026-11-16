import type { EditorDocument } from "./template-editor-model";
import type { DesignerNativeGeometry, GraphCommand, Matrix, Point, SnapGuide } from "./designer-interaction-contract";
import { absoluteFrame, frameValues, geometryBounds, geometryParent, pageBounds, pageSelection, translatePageFrames } from "./designer-geometry-commands";
import { CSS_PX_PER_MM } from "./designer-viewport-mapping";

export function moveWithSnap(document: EditorDocument, ids: readonly string[], native: DesignerNativeGeometry, delta: Point, zoom: number, snap: boolean) {
  const { contexts, pageKey } = pageSelection(document, ids, native), bounds = pageBounds(document, ids, native);
  const guides: SnapGuide[] = [], adjusted = { ...delta };
  const excluded = new Set<string>();
  const exclude = (id: string) => { excluded.add(id); document.nodes[id].childIds.forEach(exclude); }; ids.forEach(exclude);
  const visible = (id: string) => { let node = document.nodes[id]; while (node) { if (node.hidden) return false; node = node.parentId ? document.nodes[node.parentId] : undefined!; } return true; };
  const peers = [...contexts].filter(([id, context]) => !excluded.has(id) && context.pageKey === pageKey && visible(id));
  const threshold = 6 / (CSS_PX_PER_MM * zoom);
  if (snap) for (const axis of ["x", "y"] as const) {
    const size = axis === "x" ? "width" : "height";
    const positions = [bounds[axis] + delta[axis], bounds[axis] + bounds[size] / 2 + delta[axis], bounds[axis] + bounds[size] + delta[axis]];
    let closest: { distance: number; value: number } | null = null;
    for (const [, context] of peers) {
      const box = geometryBounds(native.templateFrameCorners(context.matrix, context.width, context.height));
      for (const value of [box[axis], box[axis] + box[size] / 2, box[axis] + box[size]]) for (const position of positions) {
        const distance = value - position;
        if (Math.abs(distance) <= threshold && (!closest || Math.abs(distance) < Math.abs(closest.distance))) closest = { distance, value };
      }
    }
    if (closest) { adjusted[axis] += closest.distance; guides.push({ axis, valueMm: closest.value, pageKey }); }
  }
  return { command: translatePageFrames(document, ids, native, adjusted), guides };
}
function rotateMatrix(center: Point, degrees: number): Matrix {
  const radians = degrees * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
  return [c, s, -s, c, center.x - c * center.x + s * center.y, center.y - s * center.x - c * center.y];
}
export function normalizeRotation(degrees: number) { return ((degrees + 180) % 360 + 360) % 360 - 180; }
export function rotateSelection(document: EditorDocument, ids: readonly string[], native: DesignerNativeGeometry, angle: number): GraphCommand {
  const { contexts } = pageSelection(document, ids, native), bounds = pageBounds(document, ids, native);
  const rotation = rotateMatrix({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, angle);
  return { kind: "TRANSFORM", changes: ids.map(nodeId => {
    const context = contexts.get(nodeId)!, original = absoluteFrame(document.nodes[nodeId]);
    const matrix = native.multiplyTemplateMatrices(native.invertTemplateMatrix(geometryParent(document, nodeId, native)), native.multiplyTemplateMatrices(rotation, context.matrix));
    const frame = native.templateFrameFromMatrix(matrix, original);
    return { nodeId, frame: { ...frameValues(frame), rotationDeg: normalizeRotation(frame.rotationDeg) } };
  }) };
}
export function resizeSelection(document: EditorDocument, ids: readonly string[], native: DesignerNativeGeometry, deltaPage: Point, handle: readonly [-1 | 0 | 1, -1 | 0 | 1], aspect: boolean): GraphCommand {
  if (!handle[0] && !handle[1]) throw new Error("Choose an active resize handle");
  if (ids.length > 1) {
    const { contexts } = pageSelection(document, ids, native), box = pageBounds(document, ids, native);
    let width = box.width + handle[0] * deltaPage.x, height = box.height + handle[1] * deltaPage.y;
    if (aspect) {
      const ratio = handle[0] && (!handle[1] || Math.abs(width / box.width - 1) >= Math.abs(height / box.height - 1)) ? width / box.width : height / box.height;
      width = box.width * ratio; height = box.height * ratio;
    }
    if (width <= 0 || height <= 0 || !Number.isFinite(width + height)) throw new Error("Positive bounded dimensions required");
    const anchor = { x: box.x + (handle[0] < 0 ? box.width : handle[0] ? 0 : box.width / 2), y: box.y + (handle[1] < 0 ? box.height : handle[1] ? 0 : box.height / 2) };
    const matrix = native.multiplyTemplateMatrices(native.translateTemplateMatrix(anchor.x, anchor.y), native.multiplyTemplateMatrices(native.scaleTemplateMatrix(width / box.width, height / box.height), native.translateTemplateMatrix(-anchor.x, -anchor.y)));
    return { kind: "TRANSFORM", changes: ids.map(nodeId => {
      const original = absoluteFrame(document.nodes[nodeId]);
      const local = native.multiplyTemplateMatrices(native.invertTemplateMatrix(geometryParent(document, nodeId, native)), native.multiplyTemplateMatrices(matrix, contexts.get(nodeId)!.matrix));
      return { nodeId, frame: frameValues(native.templateFrameFromMatrix(local, original)) };
    }) };
  }
  const parentInverse = native.invertTemplateMatrix(geometryParent(document, ids[0], native));
  const origin = native.transformTemplatePoint(parentInverse, { x: 0, y: 0 }), shifted = native.transformTemplatePoint(parentInverse, deltaPage);
  let dx = shifted.x - origin.x, dy = shifted.y - origin.y;
  const old = absoluteFrame(document.nodes[ids[0]]), bounds = old;
  const radians = old.rotationDeg * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians);
  [dx, dy] = [cosine * dx + sine * dy, -sine * dx + cosine * dy];
  let width = bounds.width + handle[0] * dx, height = bounds.height + handle[1] * dy;
  if (aspect) {
    const scale = handle[0] && (!handle[1] || Math.abs(width / bounds.width - 1) >= Math.abs(height / bounds.height - 1)) ? width / bounds.width : height / bounds.height;
    width = bounds.width * scale; height = bounds.height * scale;
  }
  if (width <= 0 || height <= 0 || !Number.isFinite(width + height)) throw new Error("Positive bounded dimensions required");
  const localX = handle[0] * (width - old.width) / 2, localY = handle[1] * (height - old.height) / 2;
  return { kind: "TRANSFORM", changes: [{ nodeId: ids[0], frame: { ...frameValues(old), width, height,
    x: old.x + old.width / 2 + cosine * localX - sine * localY - width / 2,
    y: old.y + old.height / 2 + sine * localX + cosine * localY - height / 2 } }] };
}

/** Explicit repair preserves aspect and fits actual rotated frames; the full native validator still decides. */
export function fitRejectedTransform(document: EditorDocument, native: DesignerNativeGeometry, command: GraphCommand): GraphCommand {
  if (command.kind !== "TRANSFORM") throw new Error("This operation needs an explicit destination or individual repair");
  const ids = command.changes.map(change => change.nodeId), parentId = document.nodes[ids[0]].parentId;
  if (!parentId || ids.some(id => document.nodes[id].parentId !== parentId)) throw new Error("Repair one parent at a time");
  const parent = native.projectTemplateGeometry(document).get(parentId); if (!parent) throw new Error("No eligible parent bounds");
  const frames = command.changes.map(change => ({ ...change.frame, kind: "ABSOLUTE" as const, unit: "MM" as const }));
  const box = geometryBounds(frames.flatMap(frame => [...native.templateFrameCorners(native.templateFrameMatrix(frame), frame.width, frame.height), { x: frame.x, y: frame.y }, { x: frame.x + frame.width, y: frame.y + frame.height }]));
  const scale = Math.min(1, parent.width / box.width, parent.height / box.height);
  const x = Math.max(0, Math.min(box.x, parent.width - box.width * scale)), y = Math.max(0, Math.min(box.y, parent.height - box.height * scale));
  const matrix = native.multiplyTemplateMatrices(native.translateTemplateMatrix(x, y), native.multiplyTemplateMatrices(native.scaleTemplateMatrix(scale, scale), native.translateTemplateMatrix(-box.x, -box.y)));
  return { kind: "TRANSFORM", changes: command.changes.map((change, index) => ({ nodeId: change.nodeId, frame: frameValues(native.templateFrameFromMatrix(native.multiplyTemplateMatrices(matrix, native.templateFrameMatrix(frames[index])), frames[index])) })) };
}

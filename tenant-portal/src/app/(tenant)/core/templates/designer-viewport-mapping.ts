import type { DesignerNativeGeometry, Matrix, Point, ViewportMapping } from "./designer-interaction-contract";

export const CSS_PX_PER_MM = 96 / 25.4;

/** The sole screen inverse. RTL resolves page anchoring, never mirrors authored physical x. */
export function designerViewportMatrix(view: ViewportMapping): Matrix {
  const values = [view.clientLeft, view.clientTop, view.clientWidth, view.inlineOffsetPx, view.blockOffsetPx, view.scrollLeft, view.scrollTop, view.panX, view.panY, view.zoom, view.pageWidthMm];
  if (!values.every(Number.isFinite) || view.zoom < 0.25 || view.zoom > 2 || view.pageWidthMm <= 0 || view.clientWidth <= 0) throw new Error("Invalid measured viewport");
  const scale = CSS_PX_PER_MM * view.zoom;
  // scrollLeft is the DOM's physical offset (including negative RTL offsets), applied once.
  const left = view.clientLeft + (view.direction === "RTL" ? view.clientWidth - view.inlineOffsetPx - view.pageWidthMm * scale : view.inlineOffsetPx);
  return [scale, 0, 0, scale, left + view.panX - view.scrollLeft, view.clientTop + view.blockOffsetPx + view.panY - view.scrollTop];
}
export function designerScreenToLocal(native: DesignerNativeGeometry, view: ViewportMapping, parent: Matrix, client: Point): Point {
  const inverse = native.invertTemplateMatrix(native.multiplyTemplateMatrices(designerViewportMatrix(view), parent));
  return native.transformTemplatePoint(inverse, client);
}
export function designerLocalToScreen(native: DesignerNativeGeometry, view: ViewportMapping, parent: Matrix, point: Point): Point {
  return native.transformTemplatePoint(native.multiplyTemplateMatrices(designerViewportMatrix(view), parent), point);
}

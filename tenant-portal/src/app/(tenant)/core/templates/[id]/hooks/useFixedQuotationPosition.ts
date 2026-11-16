import {
  invertTemplateMatrix, prepareTemplateGraphCommand, projectTemplateGeometry,
  resolveTemplateTextDirection, roundTemplateMillimetres, transformTemplatePoint, validateTemplateDocumentModel,
} from "@mutakamel/template-schema/browser-safe";
import { useState, type KeyboardEvent } from "react";
import { absoluteFrame, assertGeometryEditable, frameValues } from "../../designer-geometry-commands";
import type { DesignerInteractionBridge, Frame, Point } from "../../designer-interaction-contract";
import { updateEditorNode, type EditorDocument } from "../../template-editor-model";

export const fixedQuotationDirections = [
  { key: "ArrowLeft", label: "moveLeft", x: -1, y: 0 },
  { key: "ArrowRight", label: "moveRight", x: 1, y: 0 },
  { key: "ArrowUp", label: "moveUp", x: 0, y: -1 },
  { key: "ArrowDown", label: "moveDown", x: 0, y: 1 },
] as const;

type PositionTarget = { key: string; generation: number; nodeId: string };
type NumericFrame = Omit<Frame, "zIndex">;
type NumericFrameTarget = PositionTarget & {
  document: EditorDocument; selection: readonly string[]; frame: NumericFrame; parentWidth: number; rtl: boolean;
};

function eligibleNode(document: EditorDocument | null, ids: readonly string[]) {
  if (document?.layoutMode !== "FIXED_CANVAS" || document.documentType !== "QUOTATION" ||
    document.outputChannel !== "PRINT" || document.dataSourceKey !== "TRADE_QUOTATION_PRINT_V1" ||
    document.canvasPages !== undefined) return null;
  if (ids.length !== 1) return null;
  const [nodeId] = ids;
  const node = document.nodes[nodeId];
  if (!node?.parentId || node.layout.kind !== "ABSOLUTE") return null;
  try {
    assertGeometryEditable(document, ids);
    return { nodeId, parentId: node.parentId, document, node, frame: absoluteFrame(node) };
  } catch {
    return null;
  }
}

export function readFixedQuotationPosition(bridge: DesignerInteractionBridge) {
  const { key, canRead } = bridge.context();
  if (!canRead || !bridge.canEdit()) return null;
  const { document, gestureActive, generation } = bridge.read();
  const selected = gestureActive ? null : eligibleNode(document, bridge.selection());
  return selected && { ...selected, key, generation };
}

export function moveFixedQuotationPosition(bridge: DesignerInteractionBridge, target: PositionTarget, delta: Point) {
  const current = readFixedQuotationPosition(bridge);
  if (!current || current.key !== target.key || current.generation !== target.generation || current.nodeId !== target.nodeId) return false;
  const candidate = fixedQuotationPositionCandidate(current, delta);
  return !!candidate && candidate !== current.document && bridge.execute(candidate);
}

export function readFixedQuotationDragTarget(document: EditorDocument | null, nodeId: string) {
  const target = eligibleNode(document, [nodeId]);
  return target && isNumericLeaf(target.node) ? target : null;
}

export function fixedQuotationPositionCandidate(target: NonNullable<ReturnType<typeof eligibleNode>>, delta: Point) {
  const { document, node, nodeId, parentId, frame } = target;
  if (delta.x === 0 && delta.y === 0) return document;
  const admission = validateTemplateDocumentModel(document);
  if (!admission.valid || !admission.document) return null;
  try {
    const parent = projectTemplateGeometry(admission.document).get(parentId);
    if (!parent) return null;
    // Ancestor rotations keep their physical signs. Only local X is stored as
    // an inline-start inset by the ordinary renderer, after undoing rotations.
    const inverse = invertTemplateMatrix(parent.matrix);
    const origin = transformTemplatePoint(inverse, { x: 0, y: 0 });
    const translated = transformTemplatePoint(inverse, delta);
    const direction = resolveTemplateTextDirection(admission.document.direction, admission.document.locale);
    const inlineDelta = (translated.x - origin.x) * (direction === "RTL" ? -1 : 1);
    const result = prepareTemplateGraphCommand(admission.document, { kind: "TRANSFORM", changes: [{ nodeId, frame: {
      ...frameValues(frame), x: frame.x + inlineDelta, y: frame.y + translated.y - origin.y,
    } }] });
    const layout = result.candidate.nodes[nodeId].layout;
    if (layout.kind !== "ABSOLUTE") return null;
    if (layout.x === frame.x && layout.y === frame.y) return document;
    // Keep the original document and apply only the checked position. The bridge admits the complete draft.
    return updateEditorNode(document, nodeId, { layout: { ...node.layout, x: layout.x, y: layout.y } });
  } catch {
    return null;
  }
}

function isNumericLeaf(node: { type: string; childIds: readonly string[] }) {
  return node.childIds.length === 0 && (node.type === "text" || node.type === "image");
}

function currentFrameTarget(bridge: DesignerInteractionBridge, target: NumericFrameTarget) {
  const current = readFixedQuotationPosition(bridge);
  return current && current.key === target.key && current.generation === target.generation &&
    current.nodeId === target.nodeId && current.document === target.document && bridge.selection() === target.selection &&
    isNumericLeaf(current.node) ? current : null;
}

export function readFixedQuotationFrame(bridge: DesignerInteractionBridge): NumericFrameTarget | null {
  const current = readFixedQuotationPosition(bridge);
  if (!current || !isNumericLeaf(current.node)) return null;
  try {
    const admission = validateTemplateDocumentModel(current.document);
    if (!admission.valid || !admission.document) return null;
    const parent = projectTemplateGeometry(admission.document).get(current.parentId);
    if (!parent) return null;
    const rtl = resolveTemplateTextDirection(admission.document.direction, admission.document.locale) === "RTL";
    const { x, y, width, height, rotationDeg } = current.frame;
    const left = rtl ? roundTemplateMillimetres(parent.width - x - width) : x;
    return { key: current.key, generation: current.generation, nodeId: current.nodeId, document: current.document,
      selection: bridge.selection(), parentWidth: parent.width, rtl, frame: { x: left, y, width, height, rotationDeg } };
  } catch {
    return null;
  }
}

export function applyFixedQuotationFrame(bridge: DesignerInteractionBridge, target: NumericFrameTarget, input: NumericFrame) {
  const current = currentFrameTarget(bridge, target);
  const { x, y, width, height, rotationDeg } = input;
  if (!current || ![x, y, width, height, rotationDeg].every(Number.isFinite) ||
    x < 0 || y < 0 || width <= 0 || height <= 0 || Math.abs(rotationDeg) > 180) return false;
  const original = target.frame;
  const admission = validateTemplateDocumentModel(current.document);
  if (!admission.valid || !admission.document) return false;
  try {
    const proposed = {
      x: target.rtl ? target.parentWidth - x - width : x,
      y, width, height, rotationDeg, zIndex: current.frame.zIndex,
    };
    if (x === original.x && width === original.width) proposed.x = current.frame.x;
    // Authoring geometry owns rounding and rotated containment. Keep every
    // unchanged dimension and the original JSON outside this one frame.
    const result = prepareTemplateGraphCommand(admission.document, {
      kind: "TRANSFORM", changes: [{ nodeId: current.nodeId, frame: proposed }],
    });
    const checked = result.candidate.nodes[current.nodeId].layout;
    if (checked.kind !== "ABSOLUTE") return false;
    const layout = {
      ...current.node.layout,
      x: x === original.x && width === original.width ? current.frame.x : checked.x,
      y: y === original.y ? current.frame.y : checked.y,
      width: width === original.width ? current.frame.width : checked.width,
      height: height === original.height ? current.frame.height : checked.height,
      rotationDeg: rotationDeg === original.rotationDeg ? current.frame.rotationDeg : checked.rotationDeg,
    };
    if (layout.x === current.frame.x && layout.y === current.frame.y && layout.width === current.frame.width &&
      layout.height === current.frame.height && layout.rotationDeg === current.frame.rotationDeg) {
      return currentFrameTarget(bridge, target) !== null;
    }
    const candidate = updateEditorNode(current.document, current.nodeId, { layout });
    return validateTemplateDocumentModel(candidate).valid && currentFrameTarget(bridge, target) !== null &&
      bridge.execute(candidate);
  } catch {
    return false;
  }
}

export function useFixedQuotationPosition(
  bridge: DesignerInteractionBridge, document: EditorDocument | null, selection: readonly string[],
  ticket: { bridgeKey: string; generation: number },
  blocked = false,
) {
  const selected = eligibleNode(document, selection);
  const [rejection, setRejection] = useState<{ document: EditorDocument; selection: readonly string[] } | null>(null);
  const move = (delta: Point) => {
    if (!selected || blocked) return;
    const target = { key: ticket.bridgeKey, generation: ticket.generation, nodeId: selected.nodeId };
    setRejection(moveFixedQuotationPosition(bridge, target, delta) ? null : { document: selected.document, selection });
  };
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!selected || blocked || event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const fromCanvas = event.target === event.currentTarget;
    const fromSelection = event.target instanceof HTMLButtonElement && event.currentTarget.contains(event.target) &&
      event.target.dataset.fixedNodeId === selected.nodeId;
    if (!fromCanvas && !fromSelection) return;
    const direction = fixedQuotationDirections.find(({ key }) => key === event.key);
    if (!direction) return;
    event.preventDefault();
    const distance = event.shiftKey ? 10 : 1;
    move({ x: direction.x * distance, y: direction.y * distance });
  };
  const rejected = !!selected && rejection !== null && rejection.document === document && rejection.selection === selection;
  return { available: !!selected, move, keyboard, rejected, frameAvailable: !!selected && isNumericLeaf(selected.node),
    readFrame: () => readFixedQuotationFrame(bridge),
    isFrameCurrent: (target: NumericFrameTarget) => currentFrameTarget(bridge, target) !== null,
    applyFrame: (target: NumericFrameTarget, input: NumericFrame) => applyFixedQuotationFrame(bridge, target, input) };
}

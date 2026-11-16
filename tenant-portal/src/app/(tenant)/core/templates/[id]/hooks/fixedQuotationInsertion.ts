import {
  invertTemplateMatrix, projectTemplateGeometry, TEMPLATE_LIMITS, templateFrameCorners, transformTemplatePoint,
  validateTemplateDocumentModel, type TemplateNodeV1,
} from "@mutakamel/template-schema/browser-safe";
import { generateUUIDv7 } from "@/lib/uuid";
import { geometryBounds } from "../../designer-geometry-commands";
import type { DesignerInteractionBridge } from "../../designer-interaction-contract";
import type { DesignerInteractionTicket } from "../../designer-interaction-exit";
import { parseEditorDocument, type EditorDocument } from "../../template-editor-model";

export interface FixedQuotationInsertionTarget extends DesignerInteractionTicket {
  readonly document: EditorDocument;
  readonly selection: readonly string[];
}

type Box = { x: number; y: number; width: number; height: number };
type FixedTextNode = Extract<TemplateNodeV1, { type: "text" }>;

function bodyForInsertion(document: EditorDocument | null, selection: readonly string[]) {
  if (document?.layoutMode !== "FIXED_CANVAS" || document.documentType !== "QUOTATION" || document.outputChannel !== "PRINT" ||
      document.dataSourceKey !== "TRADE_QUOTATION_PRINT_V1" || document.canvasPages !== undefined || !document.page ||
      document.rootNodeIds.length !== 1 || selection.length > 1 || Object.keys(document.nodes).length >= TEMPLATE_LIMITS.maxNodes) return null;
  const body = document.nodes[document.rootNodeIds[0]];
  if (body?.type !== "container" || body.props.semanticRole !== "BODY" || body.parentId !== null || body.layout.kind !== "FLOW" || body.hidden || body.locked) return null;
  const selected = document.nodes[selection[0]];
  if (selection.length && (!selected || selected.hidden || selected.locked || (selected.id !== body.id && selected.parentId !== body.id))) return null;
  return body;
}

export function canInsertFixedQuotationText(document: EditorDocument | null, selection: readonly string[]) {
  return !!bodyForInsertion(document, selection);
}

function findPosition(body: Pick<Box, "width" | "height">, obstacles: readonly Box[], width: number, height: number) {
  const bottoms = [0, ...obstacles.map(box => box.y + box.height)].sort((first, second) => first - second);
  const ordered = [...obstacles].sort((first, second) => first.x - second.x);
  for (const y of bottoms) {
    if (y < 0 || y + height > body.height) continue;
    let x = 0;
    for (const box of ordered) {
      if (box.y >= y + height || box.y + box.height <= y || box.x + box.width <= x) continue;
      if (box.x >= x + width) break;
      x = box.x + box.width;
    }
    if (x + width <= body.width) return { x, y };
  }
  return null;
}

export function insertFixedQuotationText(
  bridge: DesignerInteractionBridge,
  target: FixedQuotationInsertionTarget,
  text: string,
): boolean {
  const context = bridge.context();
  if (!context.canRead || context.key !== target.bridgeKey || !bridge.canEdit()) return false;
  const { document, generation, gestureActive } = bridge.read();
  const selection = bridge.selection();
  if (!document || document !== target.document || generation !== target.generation || gestureActive || selection !== target.selection) return false;
  const body = bodyForInsertion(document, selection);
  if (!body) return false;
  const admission = validateTemplateDocumentModel(document);
  if (!admission.valid || !admission.document) return false;

  try {
    const contexts = projectTemplateGeometry(admission.document);
    const frame = contexts.get(body.id);
    const height = 8;
    if (!frame || frame.width < 24 || frame.height < height) return false;
    const width = Math.min(60, frame.width);
    const inverse = invertTemplateMatrix(frame.matrix);
    const obstacles = body.childIds.map(id => {
      const sibling = contexts.get(id);
      if (!sibling) throw new Error("Missing Fixed geometry");
      return geometryBounds(templateFrameCorners(sibling.matrix, sibling.width, sibling.height).map(point => transformTemplatePoint(inverse, point)));
    });
    const position = findPosition(frame, obstacles, width, height);
    if (!position) return false;

    const id = generateUUIDv7();
    if (Object.hasOwn(document.nodes, id)) return false;
    const node: FixedTextNode = {
      id, parentId: body.id, type: "text", childIds: [], hidden: false, locked: false,
      layout: { kind: "ABSOLUTE", unit: "MM", ...position, width, height, rotationDeg: 0, zIndex: 0 },
      style: { fontSizePx: 14, lineHeight: 1.2, overflow: "HIDDEN" },
      props: { text },
    };
    const next = { ...document, nodes: { ...document.nodes, [body.id]: { ...body, childIds: [...body.childIds, id] }, [id]: node } };
    if (!validateTemplateDocumentModel(next).valid || !bridge.execute(parseEditorDocument(next))) return false;
    bridge.select([id]);
    return true;
  } catch {
    return false;
  }
}

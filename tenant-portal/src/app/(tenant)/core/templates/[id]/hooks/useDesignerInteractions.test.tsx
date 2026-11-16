// @vitest-environment jsdom
import * as schema from "@mutakamel/template-schema/browser-safe";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createDesignerCommandStore } from "../../designer-command-store";
import type { DesignerInteractionBridge, DesignerNativeGeometry } from "../../designer-interaction-contract";
import { createDesignerInteractionExit } from "../../designer-interaction-exit";
import { parseEditorDocument, type EditorDocument } from "../../template-editor-model";
import { useDesignerInteractions } from "./useDesignerInteractions";

const bodyId = "01890000-0000-7000-8000-000000000002";
const textId = "01890000-0000-7000-8000-000000000003";
const native: DesignerNativeGeometry = {
  ...schema,
  validateTemplateDocumentModel(value) {
    const result = schema.validateTemplateDocumentModel(value);
    return { ...result, document: result.document && parseEditorDocument(result.document) };
  },
  projectTemplateGeometry: document => schema.projectTemplateGeometry(admit(document)),
  prepareTemplateGraphCommand(document, command) {
    const result = schema.prepareTemplateGraphCommand(admit(document), command);
    return { ...result, candidate: parseEditorDocument(result.candidate) };
  },
  collectTemplateCopyIds: (document, ids) => schema.collectTemplateCopyIds(admit(document), ids),
  remapTemplateDocumentNodes: (document, ids) => parseEditorDocument(schema.remapTemplateDocumentNodes(admit(document), ids)),
};

function admit(document: Readonly<EditorDocument>) {
  const result = schema.validateTemplateDocumentModel(document);
  if (!result.valid || !result.document) throw new Error("Invalid quotation fixture");
  return result.document;
}

function setup(layoutMode: "FIXED_CANVAS" | "FLOW_DOCUMENT", options: { locked?: boolean; writable?: boolean; selected?: boolean } = {}) {
  const fixed = layoutMode === "FIXED_CANVAS";
  const document: EditorDocument = {
    schemaVersion: 1, documentType: "QUOTATION", outputChannel: "PRINT", layoutMode,
    dataSourceKey: "TRADE_QUOTATION_PRINT_V1", locale: "en-US", direction: "LTR",
    page: { unit: "MM", preset: "A4", widthMm: 210, heightMm: 297, orientation: "PORTRAIT",
      marginMm: { top: 12, end: 14, bottom: 12, start: 10 } },
    theme: { fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 16, textColor: "#111827", accentColor: "#2563EB",
      surfaceColor: "#FFFFFF", lineHeight: 1.5 },
    rootNodeIds: [bodyId], nodes: {
      [bodyId]: { id: bodyId, type: "container", parentId: null, childIds: [textId], hidden: false, locked: false,
        layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } },
      [textId]: { id: textId, type: "text", parentId: bodyId, childIds: [], hidden: false, locked: !!options.locked,
        layout: fixed ? { kind: "ABSOLUTE", unit: "MM", x: 10, y: 20, width: 120, height: 20, rotationDeg: 0, zIndex: 0 }
          : { kind: "FLOW", order: 0 }, style: {}, props: { text: "Sales quotation" } },
    },
  };
  const store = createDesignerCommandStore();
  store.reset(document);
  if (options.selected !== false) store.setViewport({ selectedId: textId });
  const ticket = { bridgeKey: "quotation", generation: store.getSnapshot().generation };
  const exit = createDesignerInteractionExit(ticket, () => ticket);
  const execute = vi.fn((next: EditorDocument) => store.execute({ kind: "EDIT_DOCUMENT", document: next }));
  const bridge: DesignerInteractionBridge = {
    read: store.getSnapshot, context: () => ({ key: ticket.bridgeKey, canRead: true }),
    canEdit: () => options.writable !== false, selection: () => store.getViewport().selectedIds,
    select: selectedIds => store.setViewport({ selectedIds }), execute,
    begin: () => null, update: () => false, commit: vi.fn(), cancel: vi.fn(),
  };
  function Arrange() {
    const { keyboard, state } = useDesignerInteractions(bridge, native, exit);
    return <section aria-label="Arrange" tabIndex={0} onKeyDown={keyboard}>
      <button type="button">Other control</button>
      {state.error && <p role="alert">{state.error}</p>}
    </section>;
  }
  render(<Arrange />);
  return { arrange: screen.getByRole("region", { name: "Arrange" }), execute, store };
}

it("nudges a Fixed quotation by the keyboard and refuses a move outside its page", () => {
  const { arrange, execute, store } = setup("FIXED_CANVAS");
  expect(fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowRight" })).toBe(true);
  expect(fireEvent.keyDown(arrange, { key: "ArrowRight", altKey: true })).toBe(true);
  expect(execute).not.toHaveBeenCalled();

  expect(fireEvent.keyDown(arrange, { key: "ArrowRight" })).toBe(false);
  expect(fireEvent.keyDown(arrange, { key: "ArrowUp", shiftKey: true })).toBe(false);
  expect(store.getSnapshot().document?.nodes[textId].layout).toMatchObject({ x: 11, y: 10 });

  fireEvent.keyDown(arrange, { key: "ArrowLeft", shiftKey: true });
  fireEvent.keyDown(arrange, { key: "ArrowLeft", shiftKey: true });
  expect(store.getSnapshot().document?.nodes[textId].layout).toMatchObject({ x: 1, y: 10 });
  expect(execute).toHaveBeenCalledTimes(3);
  expect(screen.getByRole("alert")).toBeInTheDocument();
});

it.each([
  { layoutMode: "FLOW_DOCUMENT", options: {} },
  { layoutMode: "FIXED_CANVAS", options: { locked: true } },
  { layoutMode: "FIXED_CANVAS", options: { writable: false } },
  { layoutMode: "FIXED_CANVAS", options: { selected: false } },
] as const)("leaves the arrow key available for $layoutMode with $options", ({ layoutMode, options }) => {
  const { arrange, execute } = setup(layoutMode, options);
  expect(fireEvent.keyDown(arrange, { key: "ArrowDown" })).toBe(true);
  expect(execute).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
});

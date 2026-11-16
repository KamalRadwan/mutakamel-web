import { validateTemplateDocumentModel } from "@mutakamel/template-schema/browser-safe";
import { expect, it, vi } from "vitest";
import { createDesignerCommandStore } from "../../designer-command-store";
import type { DesignerInteractionBridge } from "../../designer-interaction-contract";
import type { EditorDocument, EditorNode } from "../../template-editor-model";
import { canInsertFixedQuotationText, insertFixedQuotationText } from "./fixedQuotationInsertion";

const bodyId = "01890000-0000-7000-8000-000000000001";
const pageId = "01890000-0000-7000-8000-000000000010";

function quotation(locale: "ar-EG" | "en-US", full = false): EditorDocument {
  const children = [[0, 47], [51, 35], [89, full ? 151 : 142], [240, 30]].map(([y, height], index): EditorNode => ({
    id: `01890000-0000-7000-8000-00000000000${index + 2}`,
    type: "text", parentId: bodyId, childIds: [], hidden: false, locked: false,
    layout: { kind: "ABSOLUTE", unit: "MM", x: 0, y, width: 186, height, rotationDeg: 0, zIndex: 0 },
    style: {}, props: { text: "Existing element" },
  }));
  const body: EditorNode = {
    id: bodyId, type: "container", parentId: null, childIds: children.map(node => node.id),
    hidden: false, locked: false, layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" },
  };
  return {
    schemaVersion: 1, documentType: "QUOTATION", outputChannel: "PRINT", layoutMode: "FIXED_CANVAS",
    dataSourceKey: "TRADE_QUOTATION_PRINT_V1", locale, direction: locale === "ar-EG" ? "RTL" : "LTR",
    page: { unit: "MM", preset: "A4", widthMm: 210, heightMm: 297, orientation: "PORTRAIT",
      marginMm: { top: 12, end: 12, bottom: 12, start: 12 } },
    theme: { fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 14, textColor: "#101B34",
      accentColor: "#006BC7", surfaceColor: "#F5F7FA", lineHeight: 1.5 },
    rootNodeIds: [bodyId], nodes: Object.fromEntries([body, ...children].map(node => [node.id, node])),
  };
}

function setup(source: EditorDocument) {
  const store = createDesignerCommandStore();
  store.reset(source);
  const execute = vi.fn((document: EditorDocument) => store.execute({ kind: "EDIT_DOCUMENT", document }));
  const authority = { key: "quotation", canRead: true, canEdit: true };
  const bridge: DesignerInteractionBridge = {
    read: store.getSnapshot, context: () => authority, canEdit: () => authority.canEdit,
    selection: () => store.getViewport().selectedIds, select: selectedIds => store.setViewport({ selectedIds }),
    execute, begin: store.beginGesture, update: () => false, commit: store.commitGesture, cancel: store.cancelGesture,
  };
  const target = () => ({
    bridgeKey: authority.key, generation: store.getSnapshot().generation,
    document: store.getSnapshot().document!, selection: bridge.selection(),
  });
  return { store, execute, bridge, target, authority };
}

it.each([["ar-EG", "نص"], ["en-US", "Text"]] as const)(
  "inserts a validated literal into the bounded gap on the %s sheet in one undo step",
  (locale, text) => {
    const source = quotation(locale);
    const { store, execute, bridge, target } = setup(source);
    expect(canInsertFixedQuotationText(target().document, target().selection)).toBe(true);
    expect(insertFixedQuotationText(bridge, target(), text)).toBe(true);
    const { document, dirty, canUndo } = store.getSnapshot();
    const nodeId = store.getViewport().selectedId!;
    expect(document?.nodes[nodeId]).toMatchObject({
      type: "text", parentId: bodyId, props: { text },
      layout: { kind: "ABSOLUTE", unit: "MM", x: 0, y: 231, width: 60, height: 8, rotationDeg: 0, zIndex: 0 },
      style: { overflow: "HIDDEN" },
    });
    expect(document?.nodes[bodyId].childIds).toEqual([...source.nodes[bodyId].childIds, nodeId]);
    expect(document?.canvasPages).toBeUndefined();
    expect(validateTemplateDocumentModel(document).valid).toBe(true);
    expect(dirty && canUndo).toBe(true);
    expect(execute).toHaveBeenCalledOnce();
    expect(store.undo()).toBe(true);
    expect(store.getSnapshot().document).toEqual(source);
    expect(store.getViewport().selectedId).toBeNull();
  },
);

it("does not overlap existing content when the sheet has no 8 mm gap", () => {
  const source = quotation("ar-EG", true);
  expect(validateTemplateDocumentModel(source).valid).toBe(true);
  const { store, execute, bridge, target } = setup(source);
  expect(insertFixedQuotationText(bridge, target(), "نص")).toBe(false);
  expect(execute).not.toHaveBeenCalled();
  expect(store.getSnapshot().document).toEqual(source);
});

it("refuses a stale selection, draft generation, authority or active gesture", () => {
  const source = quotation("en-US");
  const { store, execute, bridge, target, authority } = setup(source);
  const unselected = target();
  expect(bridge.select([bodyId])).toBe(true);
  expect(insertFixedQuotationText(bridge, unselected, "Text")).toBe(false);

  const previous = target();
  store.reset(source);
  expect(insertFixedQuotationText(bridge, previous, "Text")).toBe(false);

  authority.canEdit = false;
  expect(insertFixedQuotationText(bridge, target(), "Text")).toBe(false);
  authority.canEdit = true;
  const token = store.beginGesture();
  expect(token).not.toBeNull();
  expect(insertFixedQuotationText(bridge, target(), "Text")).toBe(false);
  expect(execute).not.toHaveBeenCalled();
});

it("does not expose or modify an explicit Fixed page", () => {
  const source = quotation("en-US");
  source.canvasPages = [{ id: pageId, name: "Page 1", page: source.page, rootNodeIds: source.rootNodeIds }];
  expect(validateTemplateDocumentModel(source).valid).toBe(true);
  const { execute, bridge, target } = setup(source);
  expect(canInsertFixedQuotationText(target().document, target().selection)).toBe(false);
  expect(insertFixedQuotationText(bridge, target(), "Text")).toBe(false);
  expect(execute).not.toHaveBeenCalled();
});

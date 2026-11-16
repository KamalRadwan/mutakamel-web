import { expect, it, vi } from "vitest";
import { createDesignerCommandStore } from "./designer-command-store";
import { createDesignerPageHost } from "./designer-page-host";
import type { EditorDocument } from "./template-editor-model";

const bodyId = "01890000-0000-7000-8000-000000000002";
const textId = "01890000-0000-7000-8000-000000000003";
const page = {
  unit: "MM", preset: "A4", widthMm: 210, heightMm: 297, orientation: "PORTRAIT",
  marginMm: { top: 12, end: 12, bottom: 12, start: 12 },
};

function setup(layoutMode: "FIXED_CANVAS" | "FLOW_DOCUMENT" | "HYBRID_DOCUMENT" = "FIXED_CANVAS", explicit = false) {
  const document: EditorDocument = {
    schemaVersion: 1, documentType: "QUOTATION", outputChannel: "PRINT", layoutMode,
    dataSourceKey: "TRADE_QUOTATION_PRINT_V1", locale: "en-US", direction: "LTR",
    page, theme: { fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 16, textColor: "#111827", accentColor: "#2563EB",
      surfaceColor: "#FFFFFF", lineHeight: 1.5 },
    rootNodeIds: [bodyId], nodes: {
      [bodyId]: { id: bodyId, type: "container", parentId: null, childIds: [textId], hidden: false, locked: false,
        layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } },
      [textId]: { id: textId, type: "text", parentId: bodyId, childIds: [], hidden: false, locked: false,
        layout: layoutMode === "FIXED_CANVAS"
          ? { kind: "ABSOLUTE", unit: "MM", x: 155, y: 20, width: 25, height: 20, rotationDeg: 0, zIndex: 0 }
          : { kind: "FLOW", order: 0 },
        style: {}, props: { text: "Sales quotation" } },
    },
  };
  if (explicit) document.canvasPages = [{ id: "01890000-0000-7000-8000-000000000004", name: "Page 1", page, rootNodeIds: [bodyId] }];
  const store = createDesignerCommandStore();
  store.reset(document);
  const access = { key: "draft", writable: true };
  const execute = vi.fn((next: EditorDocument) => store.execute({ kind: "EDIT_DOCUMENT", document: next }));
  const host = createDesignerPageHost(store, {
    context: () => ({ key: access.key, canRead: true }),
    canEdit: () => access.writable, execute,
  }, undefined, () => true);
  return { host, store, access, execute, base: store.getSnapshot().document! };
}

it("keeps page overflow, privileged operations and expired write authority out of the Sales draft", () => {
  const { host, store, access, execute, base } = setup();
  expect(host.getSnapshot()).toMatchObject({ editable: true, basicSetupOnly: true });
  const largerMargin = { ...page, marginMm: { ...page.marginMm, end: 30 } };
  expect(host.setPageSetup(largerMargin, base)).toBe(false);
  expect(host.getSnapshot().error).toBe("invalid");
  expect(host.addPage("existing-page", "New page")).toBe(false);
  expect(host.insertPageBreak(textId)).toBe(false);
  expect(host.getSnapshot().error).toBe("unavailable");

  const validPage = { ...page, marginMm: { ...page.marginMm, top: 16 } };
  access.writable = false;
  expect(host.setPageSetup(validPage, base)).toBe(false);
  expect(host.getSnapshot().error).toBe("readOnly");
  access.writable = true;
  access.key = "replaced-draft";
  expect(host.setPageSetup(validPage, base)).toBe(false);
  expect(host.getSnapshot().document).toBeNull();
  expect(execute).not.toHaveBeenCalled();
  expect(store.getSnapshot()).toMatchObject({ document: base, dirty: false, canUndo: false });
});

it("requires a qualified provider for explicit Fixed pages", () => {
  const { host, base, execute } = setup("FIXED_CANVAS", true);
  expect(host.getSnapshot()).toMatchObject({ document: null, editable: false, blocked: "unavailable" });
  expect(host.setPageSetup(page, base)).toBe(false);
  expect(execute).not.toHaveBeenCalled();
});

it.each(["FLOW_DOCUMENT", "HYBRID_DOCUMENT"] as const)("keeps ordinary %s paper edits available while gating pagination", layoutMode => {
  const { host, base, store, execute } = setup(layoutMode);
  expect(host.getSnapshot()).toMatchObject({ editable: true, basicSetupOnly: true });
  expect(host.setFlowFlags(textId, { keepTogether: true, breakBefore: true })).toBe(false);
  expect(host.insertPageBreak(textId)).toBe(false);
  expect(execute).not.toHaveBeenCalled();
  expect(store.getSnapshot().document).toBe(base);

  const next = { ...page, marginMm: { ...page.marginMm, top: 16 } };
  expect(host.setPageSetup(next, base)).toBe(true);
  expect(execute).toHaveBeenCalledExactlyOnceWith({ ...base, page: next });
});

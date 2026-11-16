// @vitest-environment jsdom
import { validateTemplateDocumentModel } from "@mutakamel/template-schema/browser-safe";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { createDesignerCommandStore } from "../../designer-command-store";
import type { TemplateAsset } from "../../template-assets-contract";
import type { EditorDocument, EditorNode } from "../../template-editor-model";
import { readQuotationImageReplacement, useQuotationImageReplacement, type QuotationImageEditor } from "./useQuotationImageReplacement";

afterEach(cleanup);

const templateId = "01890000-0000-7000-8000-000000000001";
const bodyId = "01890000-0000-7000-8000-000000000002";
const imageId = "01890000-0000-7000-8000-000000000003";
const originalId = "01890000-0000-7000-8000-000000000004";
const nextId = "01890000-0000-7000-8000-000000000005";
const otherId = "01890000-0000-7000-8000-000000000006";
const retiredId = "01890000-0000-7000-8000-000000000007";
const wrongMimeId = "01890000-0000-7000-8000-000000000008";

function asset(id: string, definitionId: string | null, fields: Partial<TemplateAsset> = {}): TemplateAsset {
  return { id, definitionId, assetType: "IMAGE", originalFileName: "image.png", mimeType: "image/png", sizeBytes: 80,
    deliveryClass: "PRIVATE_ONLY", status: "ACTIVE", revision: 1, etag: `"asset:${id}:1"`, createdAt: "2026-11-13T00:00:00Z", ...fields };
}

function quotation(layoutMode: "FIXED_CANVAS" | "FLOW_DOCUMENT" | "HYBRID_DOCUMENT", outputChannel = "PRINT"): EditorDocument {
  const image: EditorNode = { id: imageId, type: "image", parentId: bodyId, childIds: [], locked: false, hidden: false,
    layout: layoutMode === "FIXED_CANVAS" ? { kind: "ABSOLUTE", unit: "MM", x: 2, y: 2, width: 26, height: 16, rotationDeg: 0, zIndex: 0 } : { kind: "FLOW", order: 0 },
    style: { objectFit: "CONTAIN" }, props: { assetId: originalId, alt: "Quotation stamp", decorative: false } };
  const body: EditorNode = { id: bodyId, type: "container", parentId: null, childIds: [imageId], locked: false, hidden: false,
    layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } };
  return {
    schemaVersion: 1, documentType: "QUOTATION", outputChannel, layoutMode,
    dataSourceKey: "TRADE_QUOTATION_PRINT_V1", locale: "en-US", direction: "LTR",
    page: { unit: "MM", preset: "A4", widthMm: 210, heightMm: 297, orientation: "PORTRAIT",
      marginMm: { top: 12, end: 12, bottom: 12, start: 12 } },
    theme: { fontFamilyToken: "SYSTEM_SANS", baseFontSizePx: 14, textColor: "#101B34",
      accentColor: "#006BC7", surfaceColor: "#F5F7FA", lineHeight: 1.5 },
    rootNodeIds: [bodyId], nodes: { [bodyId]: body, [imageId]: image },
  };
}

function setup(source: EditorDocument) {
  const store = createDesignerCommandStore();
  store.reset(source);
  store.setViewport({ selectedIds: [imageId] });
  const authority = { key: "quotation", canRead: true, canEdit: true };
  const editor: QuotationImageEditor = {
    assets: [asset(originalId, null), asset(nextId, templateId), asset(otherId, otherId), asset(retiredId, null, { status: "RETIRED" }),
      asset(wrongMimeId, templateId, { mimeType: "image/svg+xml" })],
    document: source, draft: { templateId, draftId: templateId, editorDocument: source, revision: 1, etag: '"1"' },
    editable: true, hasPending: false, localPending: false, conflict: false, gestureActive: false, viewport: store.getViewport(), commandStore: store,
    interactionBridge: {
      read: store.getSnapshot, context: () => authority, canEdit: () => authority.canEdit,
      selection: () => store.getViewport().selectedIds, select: selectedIds => store.setViewport({ selectedIds }),
      execute: document => store.execute({ kind: "EDIT_DOCUMENT", document }), begin: store.beginGesture, update: () => false,
      commit: store.commitGesture, cancel: store.cancelGesture,
    },
  };
  return { editor, store, authority };
}

it.each(["FLOW_DOCUMENT", "HYBRID_DOCUMENT", "FIXED_CANVAS"] as const)("replaces just the active image asset in %s as one undo step", layout => {
  const source = quotation(layout), { editor, store } = setup(source);
  expect(validateTemplateDocumentModel(source).valid).toBe(true);
  const choice = readQuotationImageReplacement(editor)!;
  expect(choice.assets.map(asset => asset.id)).toEqual([originalId, nextId]);
  expect(choice.currentAssetId).toBe(originalId);
  for (const rejected of [otherId, retiredId, wrongMimeId, originalId]) expect(choice.replace(rejected)).toBe(false);
  expect(choice.replace(nextId)).toBe(true);
  expect(store.getSnapshot().document).toEqual({ ...source, nodes: {
    ...source.nodes, [imageId]: { ...source.nodes[imageId], props: { ...source.nodes[imageId].props, assetId: nextId } },
  } });
  expect(store.undo()).toBe(true);
  expect(store.getSnapshot().document).toEqual(source);
  expect(store.undo()).toBe(false);
});

it("refuses changed session, selection, gesture, and draft snapshots", () => {
  const source = quotation("FLOW_DOCUMENT"), { editor, store, authority } = setup(source);
  const choice = readQuotationImageReplacement(editor)!;
  authority.key = "another session";
  expect(choice.replace(nextId)).toBe(false);
  authority.key = "quotation";
  store.setViewport({ selectedIds: [bodyId] });
  expect(choice.replace(nextId)).toBe(false);
  store.setViewport({ selectedIds: [imageId] });
  const current = readQuotationImageReplacement({ ...editor, viewport: store.getViewport() })!;
  const gesture = store.beginGesture()!;
  expect(current.replace(nextId)).toBe(false);
  store.cancelGesture(gesture);
  const nextRevision = readQuotationImageReplacement({ ...editor, viewport: store.getViewport() })!;
  store.markSaved(source);
  expect(nextRevision.replace(nextId)).toBe(false);
  expect(store.getSnapshot().dirty).toBe(false);
});

it("does not offer replacement for email, blocked authority, or a locked ancestor", () => {
  const email = setup(quotation("FLOW_DOCUMENT", "EMAIL"));
  expect(readQuotationImageReplacement(email.editor)).toBeNull();
  const source = quotation("FLOW_DOCUMENT"), blocked = setup(source);
  blocked.authority.canEdit = false;
  expect(readQuotationImageReplacement(blocked.editor)).toBeNull();
  source.nodes[bodyId].locked = true;
  expect(readQuotationImageReplacement(setup(source).editor)).toBeNull();
});

it("invalidates the old selector when refreshed assets or draft ownership are committed", () => {
  const { editor, store } = setup(quotation("FLOW_DOCUMENT"));
  const { result, rerender, unmount } = renderHook(useQuotationImageReplacement, { initialProps: editor });
  const previous = result.current!;
  rerender({ ...editor, assets: [asset(originalId, null), asset(otherId, templateId)] });
  act(() => previous.replace(nextId));
  expect(store.getSnapshot().dirty).toBe(false);
  expect(result.current?.assets.map(item => item.id)).toEqual([originalId, otherId]);
  const refreshed = result.current!;
  rerender({ ...editor, draft: null });
  expect(result.current).toBeNull();
  act(() => refreshed.replace(otherId));
  expect(store.getSnapshot().dirty).toBe(false);
  rerender(editor);
  const mounted = result.current!;
  unmount();
  act(() => mounted.replace(nextId));
  expect(store.getSnapshot().dirty).toBe(false);
});

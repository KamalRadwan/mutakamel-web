import { describe, expect, it, vi } from "vitest";
import { createDesignerCommandStore } from "./designer-command-store";
import type { EditorDocument } from "./template-editor-model";

const root = "01890000-0000-7000-8000-000000000001";
const child = "01890000-0000-7000-8000-000000000002";
const document = (): EditorDocument => ({
  schemaVersion: 1, documentType: "QUOTATION", outputChannel: "PRINT", layoutMode: "HYBRID_DOCUMENT", dataSourceKey: "TRADE_QUOTATION_PRINT_V1", locale: "en-US", direction: "LTR",
  theme: {}, rootNodeIds: [root], metadata: { retained: { exactDecimal: "0.100000000000000000001" } },
  nodes: {
    [root]: { id: root, type: "container", parentId: null, childIds: [child], locked: false, hidden: false, layout: { kind: "FLOW", order: 0 }, style: {}, props: { semanticRole: "BODY" } },
    [child]: { id: child, type: "text", parentId: root, childIds: [], locked: false, hidden: false, layout: { kind: "FLOW", order: 0 }, style: {}, props: { text: "Stored text", formulaReference: { owner: "unchanged" } } },
  },
});
function loaded() { const store = createDesignerCommandStore(); store.reset(document()); return store; }

describe("canonical authored command and view boundaries", () => {
  it("retains complete owner JSON and isolates both input aliases and frozen history", () => {
    const initial = document(), original = JSON.stringify(initial), store = createDesignerCommandStore();
    store.reset(initial);
    initial.nodes[child].props.text = "External mutation";
    expect(JSON.stringify(store.getSnapshot().document)).toBe(original);
    expect(Object.isFrozen(store.getSnapshot().document?.nodes[child].props)).toBe(true);
    expect(store.getSnapshot().document?.metadata).toEqual({ retained: { exactDecimal: "0.100000000000000000001" } });
  });
  it("commits many pointer/field updates as one undo step and one redo result", () => {
    const store = loaded(), token = store.beginGesture()!;
    for (let index = 0; index < 40; index++) expect(store.updateGesture(token, { kind: "EDIT_NODE", nodeId: child, patch: { name: `Name ${index}` } })).toBe(true);
    expect(store.getSnapshot().canUndo).toBe(false);
    expect(store.commitGesture(token)).toBe(true);
    expect(store.commitGesture(token)).toBe(false);
    expect(store.undo()).toBe(true);
    expect(store.getSnapshot().document?.nodes[child].name).toBeUndefined();
    expect(store.undo()).toBe(false);
    expect(store.redo()).toBe(true);
    expect(store.getSnapshot().document?.nodes[child].name).toBe("Name 39");
  });
  it("cancels back to the original document without a history entry", () => {
    const store = loaded(), original = JSON.stringify(store.getSnapshot().document), token = store.beginGesture()!;
    store.execute({ kind: "EDIT_NODE", nodeId: child, patch: { props: { text: "Previewed edit" } } }, token);
    expect(store.cancelGesture(token)).toBe(true);
    expect(JSON.stringify(store.getSnapshot().document)).toBe(original);
    expect(store.getSnapshot().canUndo).toBe(false);
  });
  it("does not make no-op gestures or view navigation into document edits", () => {
    const store = loaded(), authored = vi.fn(), view = vi.fn();
    store.subscribe(authored); store.subscribeViewport(view);
    const original = JSON.stringify(store.getSnapshot().document);
    expect(store.setViewport({ selectedId: child, zoom: 0.75, panX: 135, panY: -42, hand: true })).toBe(true);
    expect(authored).not.toHaveBeenCalled(); expect(view).toHaveBeenCalledOnce();
    expect(JSON.stringify(store.getSnapshot().document)).toBe(original);
    const token = store.beginGesture()!; expect(store.commitGesture(token)).toBe(false);
    expect(store.getSnapshot().canUndo).toBe(false);
  });
  it("rejects stale gesture tokens after a genuine draft reload", () => {
    const store = loaded(), token = store.beginGesture()!;
    store.reset(document());
    expect(store.execute({ kind: "REMOVE_NODE", nodeId: child }, token)).toBe(false);
    expect(store.commitGesture(token)).toBe(false);
    expect(store.getSnapshot().document?.nodes[child]).toBeTruthy();
  });
  it.each(["schemaVersion", "documentType", "outputChannel", "layoutMode", "dataSourceKey", "locale"])("preserves immutable source tuple field %s", key => {
    const store = loaded(), next = document();
    const invalid = { ...next, [key]: key === "schemaVersion" ? 2 : "CHANGED" } as EditorDocument;
    expect(() => store.execute({ kind: "EDIT_DOCUMENT", document: invalid })).toThrow();
    expect(store.getSnapshot().canUndo).toBe(false);
    expect(store.getSnapshot().document).toEqual(next);
  });
  it("rejects cycles, orphan nodes and identity collisions without adopting a partial command", () => {
    const store = loaded();
    const orphan = document(); orphan.rootNodeIds = [];
    expect(() => store.execute({ kind: "EDIT_DOCUMENT", document: orphan })).toThrow();
    const cycle = document(); cycle.nodes[child].childIds = [root];
    expect(() => store.execute({ kind: "EDIT_DOCUMENT", document: cycle })).toThrow();
    const duplicate = document(); duplicate.nodes[root].childIds = [child, child];
    expect(() => store.execute({ kind: "EDIT_DOCUMENT", document: duplicate })).toThrow();
    expect(store.getSnapshot().document).toEqual(document());
  });
  it("clears protected state if a replacement draft is structurally invalid", () => {
    const store = loaded(), invalid = document(); invalid.nodes[root].childIds = [];
    expect(() => store.reset(invalid)).toThrow();
    expect(store.getSnapshot().document).toBeNull();
    expect(store.getViewport().selectedId).toBeNull();
  });
  it("keeps hidden/locked objects recoverable and refuses edits until explicitly unlocked", () => {
    const store = loaded();
    store.execute({ kind: "NODE_FLAGS", nodeId: child, locked: true, hidden: true });
    expect(store.setViewport({ selectedId: child })).toBe(true);
    expect(store.execute({ kind: "EDIT_NODE", nodeId: child, patch: { name: "blocked" } })).toBe(false);
    store.execute({ kind: "NODE_FLAGS", nodeId: child, locked: false });
    expect(store.execute({ kind: "EDIT_NODE", nodeId: child, patch: { name: "Recovered" } })).toBe(true);
  });
  it("keeps the saved baseline dirty even after the bounded undo window rolls over", () => {
    const store = loaded();
    for (let index = 0; index < 70; index++) store.execute({ kind: "EDIT_NODE", nodeId: child, patch: { name: `Edit ${index}` } });
    while (store.undo()) { /* Walk to the retained history boundary. */ }
    expect(store.getSnapshot().dirty).toBe(true);
    store.reset(document());
    expect(store.getSnapshot().dirty).toBe(false);
  });
  it("rejects a draft identity mismatch before acknowledging a replacement", () => {
    const store = loaded(), original = store.getSnapshot();
    expect(() => store.prepareReplacement({ ...document(), dataSourceKey: "OTHER_SOURCE" })).toThrow();
    expect(store.getSnapshot()).toBe(original);
  });
  it("truncates redo only for a new committed edit and bounds viewport inputs", () => {
    const store = loaded();
    store.execute({ kind: "EDIT_NODE", nodeId: child, patch: { name: "First" } });
    store.undo(); store.setViewport({ panX: 7 }); expect(store.getSnapshot().canRedo).toBe(true);
    store.execute({ kind: "EDIT_NODE", nodeId: child, patch: { name: "Replacement" } });
    expect(store.redo()).toBe(false);
    expect(store.setViewport({ zoom: 0 })).toBe(false);
    expect(store.setViewport({ panY: Infinity })).toBe(false);
    expect(store.getViewport().panX).toBe(7);
  });
});


it("marks a coherent saved baseline without resetting the latest independent viewport", () => {
  const store = loaded(); store.execute({ kind: "EDIT_NODE", nodeId: child, patch: { name: "Authored" } });
  const saved = store.getSnapshot().document!;
  store.setViewport({ selectedId: child, zoom: 0.5, panX: 120, panY: 40, hand: true });
  store.setViewport({ zoom: 0.75, panX: 144 }); const freshest = store.getViewport();
  const view = vi.fn(); store.subscribeViewport(view); store.markSaved(saved);
  expect(store.getViewport()).toBe(freshest); expect(view).not.toHaveBeenCalled();
  expect(store.getSnapshot().dirty).toBe(false); expect(store.getSnapshot().canUndo).toBe(false);
});
it("drops only a no-longer-valid selection on acknowledgement and retains navigation", () => {
  const store = loaded(); store.setViewport({ selectedId: child, zoom: 1.25, panX: 8, panY: -4, hand: true });
  const saved = document(); saved.nodes[root].childIds = []; delete saved.nodes[child]; store.markSaved(saved);
  expect(store.getViewport()).toEqual({ selectedIds: [], selectedId: null, zoom: 1.25, panX: 8, panY: -4, hand: true });
});
it("continues to reset navigation for a genuine document replacement", () => {
  const store = loaded(); store.setViewport({ selectedId: child, zoom: 0.5, panX: 120, hand: true }); store.reset(document());
  expect(store.getViewport()).toEqual({ selectedIds: [], selectedId: null, zoom: 1, panX: 0, panY: 0, hand: false });
});

it("shares multi-selection with legacy selection while keeping it out of authored history", () => {
  const store = loaded(), original = JSON.stringify(store.getSnapshot().document);
  expect(store.setViewport({ selectedIds: [root, child, child] })).toBe(true);
  expect(store.getViewport().selectedIds).toEqual([root, child]); expect(store.getViewport().selectedId).toBe(child);
  expect(Object.isFrozen(store.getViewport().selectedIds)).toBe(true);
  store.setViewport({ selectedId: root }); expect(store.getViewport().selectedIds).toEqual([root]);
  expect(JSON.stringify(store.getSnapshot().document)).toBe(original); expect(store.getSnapshot().canUndo).toBe(false);
});
it("clears invalid selection after history changes without persisting handles or selection", () => {
  const store = loaded(); store.setViewport({ selectedIds: [child] });
  store.execute({ kind: "REMOVE_NODE", nodeId: child }); expect(store.getViewport().selectedIds).toEqual([]);
  store.undo(); expect(store.getViewport().selectedIds).toEqual([]);
  expect(store.setViewport({ selectedIds: ["missing"] })).toBe(false);
  expect(store.getSnapshot().document).not.toHaveProperty("selectedIds"); expect(store.getSnapshot().document).not.toHaveProperty("handles");
});

import { parseEditorDocument, updateEditorNode, moveEditorNode, removeEditorNode, type EditorDocument, type EditorNode } from "./template-editor-model";
import { isUUIDv7 } from "@/lib/uuid";
import type { TemplateDetail } from "./templates-contract";

// Canonical v1 discriminators: shared template-schema/src/types.ts.
const nodeTypes = new Set(["text", "richText", "image", "dataField", "container", "group", "row", "column", "divider", "spacer", "link", "button", "dynamicTable", "staticTable", "formula", "totals", "pageBreak", "header", "footer"]);
const immutableFields = ["schemaVersion", "documentType", "outputChannel", "layoutMode", "dataSourceKey", "locale"] as const;
type NodeEdit = Pick<Partial<EditorNode>, "name" | "style" | "props" | "binding">;
type SourceIdentity = Pick<TemplateDetail, "documentType" | "outputChannel" | "layoutMode" | "dataSourceKey" | "locale">;
export type DesignerCommand =
  | { kind: "EDIT_DOCUMENT"; document: EditorDocument }
  | { kind: "EDIT_NODE"; nodeId: string; patch: NodeEdit }
  | { kind: "NODE_FLAGS"; nodeId: string; locked?: boolean; hidden?: boolean }
  | { kind: "REORDER_NODE"; nodeId: string; delta: -1 | 1 }
  | { kind: "REMOVE_NODE"; nodeId: string };

export interface DesignerDocumentSnapshot { readonly document: EditorDocument | null; readonly dirty: boolean; readonly canUndo: boolean; readonly canRedo: boolean; readonly gestureActive: boolean; readonly generation: number }
export interface DesignerViewport { readonly selectedId: string | null; readonly selectedIds: readonly string[]; readonly zoom: number; readonly panX: number; readonly panY: number; readonly hand: boolean }

function immutableCopy<T>(value: T): T {
  const copy: T = JSON.parse(JSON.stringify(value));
  const freeze = (item: unknown) => {
    if (!item || typeof item !== "object" || Object.isFrozen(item)) return;
    Object.values(item).forEach(freeze);
    Object.freeze(item);
  };
  freeze(copy);
  return copy;
}

/** Preserve the complete owner JSON; admit the graph before a command becomes authored state. */
export function admitDesignerDocument(value: EditorDocument, base?: EditorDocument, source?: SourceIdentity): EditorDocument {
  const document = parseEditorDocument(value);
  if (base && immutableFields.some(key => JSON.stringify(document[key]) !== JSON.stringify(base[key]))) throw new Error("Immutable template source tuple");
  if (source && Object.entries(source).some(([key, expected]) => Object.hasOwn(document, key) && document[key] !== expected)) throw new Error("Draft source does not match its definition");
  if (!["AUTO", "RTL", "LTR"].includes(document.direction)) throw new Error("Invalid document direction");
  const visited = new Set<string>();
  const walk = (ids: string[], parentId: string | null, ancestors: Set<string>) => {
    if (new Set(ids).size !== ids.length) throw new Error("Duplicate child identity");
    for (const id of ids) {
      const node = document.nodes[id];
      if (!isUUIDv7(id) || !node || node.id !== id || node.parentId !== parentId || !nodeTypes.has(node.type) || ancestors.has(id) || visited.has(id)) throw new Error("Invalid canonical document graph");
      visited.add(id);
      walk(node.childIds, id, new Set([...ancestors, id]));
    }
  };
  // Native base-validation-core.ts requires the ordered page roots to be the
  // complete root index. Never skip a page root merely because it was visited.
  if (document.canvasPages !== undefined) {
    if (document.layoutMode !== "FIXED_CANVAS" || !Array.isArray(document.canvasPages)) throw new Error("Invalid canonical pages");
    const pageIds = new Set<string>(), orderedRoots: string[] = [];
    for (const page of document.canvasPages) {
      if (!page || typeof page !== "object" || !isUUIDv7(page.id) || pageIds.has(page.id) || Object.hasOwn(document.nodes, page.id) ||
        !Array.isArray(page.rootNodeIds) || new Set(page.rootNodeIds).size !== page.rootNodeIds.length) throw new Error("Invalid canonical page roots");
      pageIds.add(page.id); orderedRoots.push(...page.rootNodeIds);
    }
    if (orderedRoots.length !== document.rootNodeIds.length || orderedRoots.some((id, index) => id !== document.rootNodeIds[index])) throw new Error("Invalid canonical page root index");
  }
  walk(document.rootNodeIds, null, new Set());
  if (visited.size !== Object.keys(document.nodes).length) throw new Error("Orphaned canonical node");
  return immutableCopy(document);
}

/** One authoritative authored state; viewport changes have a separate subscription and no history. */
export function createDesignerCommandStore() {
  let history: EditorDocument[] = [], position = 0, generation = 0, sequence = 0;
  let savedDocument: EditorDocument | null = null;
  let source: SourceIdentity | undefined;
  let gesture: { token: number; base: EditorDocument; current: EditorDocument; generation: number } | null = null;
  let snapshot: DesignerDocumentSnapshot = { document: null, dirty: false, canUndo: false, canRedo: false, gestureActive: false, generation };
  let viewport: DesignerViewport = { selectedId: null, selectedIds: Object.freeze([]), zoom: 1, panX: 0, panY: 0, hand: false };
  const documentListeners = new Set<() => void>(), viewListeners = new Set<() => void>();
  const document = () => gesture?.current ?? history[position] ?? null;
  const publish = () => {
    const current = document();
    const selectedIds = viewport.selectedIds.filter(id => current?.nodes[id]);
    const selectionChanged = selectedIds.length !== viewport.selectedIds.length;
    if (selectionChanged) {
      viewport = Object.freeze({ ...viewport, selectedIds: Object.freeze(selectedIds), selectedId: selectedIds.at(-1) ?? null });
    }
    snapshot = Object.freeze({ document: current, dirty: !!current && !!savedDocument && JSON.stringify(current) !== JSON.stringify(savedDocument), canUndo: !gesture && position > 0, canRedo: !gesture && position < history.length - 1, gestureActive: !!gesture, generation });
    // Both readers are coherent before either subscription observes rollback.
    if (selectionChanged) viewListeners.forEach(listener => listener());
    documentListeners.forEach(listener => listener());
  };
  const setViewport = (patch: Partial<DesignerViewport>) => {
    const requested = patch.selectedIds ?? (patch.selectedId === undefined ? viewport.selectedIds : patch.selectedId ? [patch.selectedId] : []);
    const ids = [...new Set(requested)];
    // A viewport-only update preserves the selection identity used by scoped commands.
    const selectedIds = ids.length === viewport.selectedIds.length && ids.every((id, index) => id === viewport.selectedIds[index])
      ? viewport.selectedIds : Object.freeze(ids);
    const next = { ...viewport, ...patch, selectedIds, selectedId: selectedIds.at(-1) ?? null };
    if (!Number.isFinite(next.zoom) || next.zoom < 0.25 || next.zoom > 2 || !Number.isFinite(next.panX) || !Number.isFinite(next.panY) || Math.abs(next.panX) > 1_000_000 || Math.abs(next.panY) > 1_000_000) return false;
    if (next.selectedIds.some(id => !document()?.nodes[id])) return false;
    viewport = Object.freeze(next); viewListeners.forEach(listener => listener()); return true;
  };
  const push = (next: EditorDocument) => {
    if (JSON.stringify(next) === JSON.stringify(history[position])) return false;
    history = [...history.slice(0, position + 1), next].slice(-50); position = history.length - 1; return true;
  };
  const execute = (command: DesignerCommand, token?: number): boolean => {
    const current = document();
    if (!current || (gesture && token === undefined) || (token !== undefined && (gesture?.token !== token || gesture.generation !== generation))) return false;
    let next: EditorDocument;
    switch (command.kind) {
      case "EDIT_DOCUMENT": next = command.document; break;
      case "EDIT_NODE":
        if (Object.keys(command.patch).some(key => !["name", "style", "props", "binding"].includes(key))) throw new Error("Unsupported node command");
        next = updateEditorNode(current, command.nodeId, command.patch); break;
      case "REORDER_NODE": next = moveEditorNode(current, command.nodeId, command.delta); break;
      case "REMOVE_NODE": next = removeEditorNode(current, command.nodeId); break;
      case "NODE_FLAGS": {
        const node = current.nodes[command.nodeId]; if (!node) return false;
        next = { ...current, nodes: { ...current.nodes, [node.id]: { ...node, ...(command.locked === undefined ? {} : { locked: command.locked }), ...(command.hidden === undefined ? {} : { hidden: command.hidden }) } } }; break;
      }
    }
    const validated = admitDesignerDocument(next, savedDocument ?? undefined, source);
    if (JSON.stringify(validated) === JSON.stringify(current)) return false;
    if (gesture) gesture.current = validated;
    else push(validated);
    publish(); return true;
  };
  return {
    getSnapshot: () => snapshot,
    getViewport: () => viewport,
    prepareReplacement: (value: EditorDocument) => admitDesignerDocument(value, savedDocument ?? undefined, source),
    subscribe: (listener: () => void) => { documentListeners.add(listener); return () => { documentListeners.delete(listener); }; },
    subscribeViewport: (listener: () => void) => { viewListeners.add(listener); return () => { viewListeners.delete(listener); }; },
    reset(value: EditorDocument | null, identity?: SourceIdentity) {
      generation += 1; gesture = null; history = []; savedDocument = null; position = 0;
      source = identity ? { documentType: identity.documentType, outputChannel: identity.outputChannel, layoutMode: identity.layoutMode, dataSourceKey: identity.dataSourceKey, locale: identity.locale } : undefined;
      viewport = Object.freeze({ selectedId: null, selectedIds: Object.freeze([]), zoom: 1, panX: 0, panY: 0, hand: false });
      try { if (value) { savedDocument = admitDesignerDocument(value, undefined, source); history = [savedDocument]; } }
      finally { publish(); viewListeners.forEach(listener => listener()); }
    },
    markSaved(value: EditorDocument) {
      const admitted = admitDesignerDocument(value, savedDocument ?? undefined, source);
      generation += 1; gesture = null; savedDocument = admitted; history = [admitted]; position = 0;
      // publish prunes invalid selections once while retaining the latest view object.
      publish();
    },
    execute,
    updateGesture: (token: number, command: DesignerCommand) => execute(command, token),
    beginGesture() {
      if (gesture) return gesture.token;
      const base = document(); if (!base) return null;
      gesture = { token: ++sequence, base, current: base, generation }; publish(); return gesture.token;
    },
    commitGesture(token: number) {
      if (!gesture || gesture.token !== token || gesture.generation !== generation) return false;
      const next = gesture.current; gesture = null; const changed = push(next); publish(); return changed;
    },
    cancelGesture(token: number) {
      if (!gesture || gesture.token !== token || gesture.generation !== generation) return false;
      gesture = null; publish(); return true;
    },
    undo() { if (gesture || position < 1) return false; position -= 1; publish(); return true; },
    redo() { if (gesture || position >= history.length - 1) return false; position += 1; publish(); return true; },
    setViewport,
  };
}

export type DesignerCommandStore = ReturnType<typeof createDesignerCommandStore>;

import type { EditorDocument, EditorNode } from "../../template-editor-model";
import { inspectorClone, type InspectorBridge, type InspectorDraft, type InspectorNative, type InspectorResult } from "./inspector-contract";
import { normalizeInspectorName } from "./inspector-labels";

export function hasLockedAncestor(document: EditorDocument, node: EditorNode): boolean {
  const seen = new Set<string>();
  let id = node.parentId;
  while (id) {
    if (seen.has(id) || !document.nodes[id] || document.nodes[id].locked) return true;
    seen.add(id); id = document.nodes[id].parentId;
  }
  return false;
}

export function openInspectorDraft(bridge: InspectorBridge, id: string): InspectorDraft | null {
  const state = bridge.read(), context = bridge.context(), node = state.document?.nodes[id];
  if (!context.canRead || !node || bridge.selection().length !== 1 || bridge.selection()[0] !== id) return null;
  return { contextKey: context.key, generation: state.generation, original: inspectorClone(node), originalDirection: state.document!.direction,
    node: inspectorClone(node), direction: state.document!.direction };
}

/** A form is a single authored command; unrelated node changes are retained. */
export function applyInspectorDraft(bridge: InspectorBridge, native: InspectorNative, draft: InspectorDraft): InspectorResult {
  const state = bridge.read(), context = bridge.context(), document = state.document;
  if (!context.canRead || !bridge.canEdit() || !document || state.gestureActive) return "blocked";
  const current = document.nodes[draft.original.id];
  if (context.key !== draft.contextKey || state.generation !== draft.generation || bridge.selection().length !== 1 || bridge.selection()[0] !== draft.original.id ||
    !current || JSON.stringify(current) !== JSON.stringify(draft.original) || document.direction !== draft.originalDirection) return "stale";
  if (current.locked || hasLockedAncestor(document, current)) return "blocked";
  // Only the inspector-owned fields may cross this boundary. Layout/identity/flags belong to T01.
  const node = { ...current, name: normalizeInspectorName(draft.node.name), style: inspectorClone(draft.node.style), props: inspectorClone(draft.node.props) };
  if (current.type === "dataField") {
    if (!draft.node.binding) return "invalid";
    node.binding = inspectorClone(draft.node.binding);
  }
  if (node.name === undefined) delete node.name;
  const next = { ...document, direction: draft.direction, nodes: { ...document.nodes, [current.id]: node } };
  if (JSON.stringify(next) === JSON.stringify(document)) return "unchanged";
  try {
    const admitted = native.validateTemplateDocumentModel(next);
    if (!admitted.valid || !admitted.document) return "invalid";
    return bridge.execute(admitted.document) ? "applied" : "blocked";
  } catch { return "invalid"; }
}

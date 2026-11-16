import { richClone, type RichBridge, type RichNative, type RichDocument, type RichSession, type RichResult } from "./rich-text-contract";
import type { EditorDocument, EditorNode } from "../../template-editor-model";
import { preservesHeadings } from "./rich-heading-adapter";

function locked(document: EditorDocument, node: EditorNode): boolean {
  const seen = new Set<string>(); let current: EditorNode | undefined = node;
  while (current) {
    if (seen.has(current.id) || current.locked) return true;
    seen.add(current.id);
    if (!current.parentId) return false;
    current = document.nodes[current.parentId];
    if (!current) return true;
  }
  return true;
}
export function openRichSession(bridge: RichBridge, native: RichNative, nodeId: string): RichSession | null {
  const state = bridge.read(), context = bridge.context(), document = state.document, node = document?.nodes[nodeId];
  if (!context.canRead || !bridge.canEdit() || !document || !node || node.type !== "richText" || locked(document, node) || state.gestureActive || bridge.selection().length !== 1 || bridge.selection()[0] !== nodeId) return null;
  const admitted = native.validateTemplateDocumentModel(document);
  if (!admitted.valid || !admitted.document) return null;
  // Admission may compose Unicode. Keep the raw source and UTF-16 coordinates until explicit Apply.
  const content = richClone(node.props.document) as RichDocument;
  return { owner: context.key, generation: state.generation, nodeId, original: richClone(content), content };
}
export function checkRichSession(bridge: RichBridge, session: RichSession): RichResult {
  const state = bridge.read(), context = bridge.context(), document = state.document, node = document?.nodes[session.nodeId];
  if (!context.canRead || !bridge.canEdit() || !document || state.gestureActive) return "blocked";
  if (session.owner !== context.key || session.generation !== state.generation || bridge.selection().length !== 1 || bridge.selection()[0] !== session.nodeId ||
    !node || node.type !== "richText" || JSON.stringify(node.props.document) !== JSON.stringify(session.original)) return "stale";
  return locked(document, node) ? "blocked" : "unchanged";
}
export function validateRichContent(bridge: RichBridge, native: RichNative, session: RichSession, content: RichDocument): boolean {
  if (checkRichSession(bridge, session) !== "unchanged") return false;
  const document = bridge.read().document!, node = document.nodes[session.nodeId];
  const admitted = native.validateTemplateDocumentModel({ ...document, nodes: { ...document.nodes, [node.id]: { ...node, props: { ...node.props, document: content } } } });
  return admitted.valid && !!admitted.document && preservesHeadings(content, admitted.document.nodes[node.id].props.document);
}
export function applyRichSession(bridge: RichBridge, native: RichNative, session: RichSession): RichResult {
  const status = checkRichSession(bridge, session); if (status !== "unchanged") return status;
  if (JSON.stringify(session.content) === JSON.stringify(session.original)) return "unchanged";
  const document = bridge.read().document!, node = document.nodes[session.nodeId];
  try {
    const admitted = native.validateTemplateDocumentModel({ ...document, nodes: { ...document.nodes, [node.id]: { ...node, props: { ...node.props, document: richClone(session.content) } } } });
    if (!admitted.valid || !admitted.document || !preservesHeadings(session.content, admitted.document.nodes[node.id].props.document)) return "invalid";
    // Recheck authority after native admission; only the canonical owner bridge may author history.
    const current = checkRichSession(bridge, session); if (current !== "unchanged") return current;
    return bridge.execute(admitted.document) ? "applied" : "blocked";
  } catch { return "invalid"; }
}
export interface RichHistory { present: RichDocument; past: RichDocument[]; future: RichDocument[]; gesture: string | null }
export function richHistory(content: RichDocument): RichHistory { return { present: richClone(content), past: [], future: [], gesture: null }; }
export function editRichHistory(history: RichHistory, content: RichDocument, gesture: string | null = null): RichHistory {
  if (JSON.stringify(content) === JSON.stringify(history.present)) return history;
  const coalesce = gesture !== null && gesture === history.gesture;
  return { present: richClone(content), past: coalesce ? history.past : [...history.past, history.present].slice(-50), future: [], gesture };
}
export function stepRichHistory(history: RichHistory, direction: "undo" | "redo"): RichHistory {
  const source = direction === "undo" ? history.past : history.future, next = source.at(-1);
  if (!next) return { ...history, gesture: null };
  return direction === "undo" ? { present: next, past: history.past.slice(0, -1), future: [...history.future, history.present], gesture: null } :
    { present: next, past: [...history.past, history.present], future: history.future.slice(0, -1), gesture: null };
}

import { parseEditorDocument, type EditorDocument, type EditorNode } from "../../template-editor-model";
import { cataloguePin, readDataDescriptor, formulaContext, documentFormulas } from "./binding-catalogue";
import { dataClone, dataRecord, type DataBridge, type DataCatalogue, type DataDraft, type DataNative, type DataResult } from "./binding-contract";

function locked(document: EditorDocument, node: EditorNode): boolean {
  const seen = new Set<string>(); let current: EditorNode | undefined = node;
  while (current) {
    if (current.locked || seen.has(current.id)) return true;
    seen.add(current.id);
    if (current.parentId && !document.nodes[current.parentId]) return true;
    current = current.parentId ? document.nodes[current.parentId] : undefined;
  }
  return false;
}
export function openDataDraft(bridge: DataBridge, native: DataNative | null, catalogue: DataCatalogue | null, nodeId: string): DataDraft | null {
  const state = bridge.read(), context = bridge.context(), node = state.document?.nodes[nodeId];
  if (!node || !catalogue || !readDataDescriptor(native, catalogue, context, state.document) || bridge.selection().length !== 1 || bridge.selection()[0] !== nodeId) return null;
  return { context: { ...context }, generation: state.generation, cataloguePin: cataloguePin(catalogue), original: dataClone(node), node: dataClone(node), visibilityEdited: false };
}
/** Own only data-bearing properties; retain unrelated live edits elsewhere in the document. */
export function applyDataDraft(bridge: DataBridge, native: DataNative | null, catalogue: DataCatalogue | null, draft: DataDraft): DataResult {
  const state = bridge.read(), authority = bridge.context(), document = state.document;
  if (!document || !authority.canRead || authority.readOnly || !bridge.canEdit() || state.gestureActive) return "blocked";
  const descriptor = readDataDescriptor(native, catalogue, authority, document);
  if (!native || !catalogue || !descriptor) return "unavailable";
  const current = document.nodes[draft.original.id];
  if (JSON.stringify(authority) !== JSON.stringify(draft.context) || state.generation !== draft.generation || cataloguePin(catalogue) !== draft.cataloguePin ||
    bridge.selection().length !== 1 || bridge.selection()[0] !== draft.original.id || !current || JSON.stringify(current) !== JSON.stringify(draft.original)) return "stale";
  if (locked(document, current)) return "blocked";
  const node = dataClone(current);
  if (current.type === "dataField") node.binding = dataClone(draft.node.binding);
  if (current.type === "formula") {
    node.props.expression = dataClone(draft.node.props.expression);
    if (draft.node.props.format === undefined) delete node.props.format; else node.props.format = dataClone(draft.node.props.format);
  }
  if (["button", "link"].includes(current.type)) node.props.label = dataClone(draft.node.props.label);
  if (current.type === "richText") node.props.document = dataClone(draft.node.props.document);
  if (draft.node.visibilityExpression === undefined) delete node.visibilityExpression;
  else node.visibilityExpression = dataClone(draft.node.visibilityExpression);
  // An explicit new predicate replaces legacy visibility; merely opening keeps it untouched.
  if (draft.visibilityEdited) delete node.visibilityRule;
  const next = { ...document, nodes: { ...document.nodes, [current.id]: node } };
  try {
    const context = formulaContext(descriptor, catalogue, undefined, documentFormulas(next));
    if (node.type === "formula") native.inferTemplateFormulaType(dataRecord(node.props.expression), context);
    const admitted = native.validateTemplateDocumentModel(next, { dataSchema: descriptor, functions: context.functions, formulaIdentityAuthority: catalogue.identityAuthority });
    if (!admitted.valid || !admitted.document) return "invalid";
    if (JSON.stringify(next) === JSON.stringify(document)) return "unchanged";
    return bridge.execute(parseEditorDocument(admitted.document)) ? "applied" : "blocked";
  } catch { return "invalid"; }
}

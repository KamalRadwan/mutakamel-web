import type { EditorDocument } from "../../template-editor-model";
import { inspectorClone, inspectorRecord, type InspectorBridge, type InspectorDraft, type InspectorNative } from "./inspector-contract";
import { inspectorAdmissionCurrent, type InspectorValidationContext } from "./inspector-ports";
import { hasLockedAncestor } from "./inspector-commands";
import type { CurrencyEligibility, DataEligibilityPort } from "../bindings/data-eligibility";

type Address = readonly string[];
export type InspectorCurrencyResult = ({ readonly status: "ready" } & CurrencyEligibility) | { readonly status: "unavailable" | "invalidDraft" };
export interface InspectorCurrencyQualification {
  qualify(binding: unknown, signal?: AbortSignal): Promise<InspectorCurrencyResult>;
  admit(binding: unknown, path: string | undefined): boolean;
}
function bindingAddress(value: unknown, target: unknown): Address | null {
  const matches: Address[] = [], seen = new Set<object>();
  const visit = (value: unknown, path: string[]) => {
    if (!value || typeof value !== "object") return;
    if (value === target) { matches.push(path); return; }
    if (seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) if (!["__proto__", "prototype", "constructor"].includes(key)) visit(child, [...path, key]);
  };
  visit(value, []);
  return matches.length === 1 ? matches[0] : null;
}
function replaceBinding(document: EditorDocument, nodeId: string, address: Address, binding: unknown, path: string | undefined): EditorDocument | null {
  if (!address.length) return null;
  const candidate = inspectorClone(document), current = inspectorRecord(binding), format = inspectorRecord(current.format);
  let parent: unknown = candidate.nodes[nodeId];
  for (const key of address.slice(0, -1)) {
    if (!parent || typeof parent !== "object" || !Object.hasOwn(parent, key)) return null;
    parent = (parent as Record<string, unknown>)[key];
  }
  if (!parent || typeof parent !== "object") return null;
  const nextFormat = { ...format };
  if (path === undefined) delete nextFormat.currencyCodePath;
  else nextFormat.currencyCodePath = path;
  (parent as Record<string, unknown>)[address[address.length - 1]] = { ...current, format: nextFormat };
  return candidate;
}

/** Probe the exact authored binding in the full local candidate; no field metadata is promoted to authority. */
export function createInspectorCurrencyQualification(bridge: InspectorBridge, native: InspectorNative, validation: InspectorValidationContext | undefined,
  draft: InspectorDraft | null, eligibility: DataEligibilityPort | undefined): InspectorCurrencyQualification {
  const source = (binding: unknown) => {
    const state = bridge.read(), document = state.document;
    if (!draft || !document || !bridge.canEdit() || state.gestureActive || !inspectorAdmissionCurrent(bridge, validation) ||
      bridge.context().key !== draft.contextKey || state.generation !== draft.generation || bridge.selection().length !== 1 || bridge.selection()[0] !== draft.node.id ||
      JSON.stringify(document.nodes[draft.original.id]) !== JSON.stringify(draft.original) || document.direction !== draft.originalDirection || inspectorRecord(inspectorRecord(binding).format).type !== "CURRENCY") return null;
    if (document.nodes[draft.node.id]?.locked || hasLockedAncestor(document, draft.node)) return null;
    const address = bindingAddress(draft.node, binding);
    if (!address || !["props", "binding"].includes(address[0])) return null;
    return { address, document: { ...document, direction: draft.direction, nodes: { ...document.nodes, [draft.node.id]: draft.node } } };
  };
  const accepted = (document: EditorDocument | null): boolean => {
    try { const result = document && native.validateTemplateDocumentModel(document); return !!result?.valid && !!result.document; } catch { return false; }
  };
  const admit = (binding: unknown, path: string | undefined): boolean => {
    const current = source(binding);
    if (!current) return false;
    return accepted(replaceBinding(current.document, draft!.node.id, current.address, binding, path));
  };
  return { admit, async qualify(binding, signal) {
    const current = source(binding);
    if (!current || !eligibility || signal?.aborted) return { status: "unavailable" };
    // Row context is proven by the exact local body slot, never by projected field names.
    const body = draft!.node.type === "dynamicTable" && current.address[0] === "props" && current.address[1] === "columns" &&
      current.address[3] === "value" && current.address[4] === "binding" && current.address.length === 5;
    const rowSourcePath = body && typeof draft!.node.props.sourcePath === "string" ? draft!.node.props.sourcePath : undefined;
    const receipt = eligibility.currencies({ kind: "BINDING", binding, rowSourcePath });
    if (!receipt || receipt.descriptorChecksum !== validation?.descriptorChecksum || !receipt.current() || !receipt.writable() || signal?.aborted || !source(binding)) return { status: "unavailable" };
    // Shared eligibility probes an existing canonical slot. Selection still validates
    // this exact binding in the complete local draft through the current native port.
    return { status: "ready", ...receipt };
  } };
}

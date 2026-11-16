"use client";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { applyDataDraft, openDataDraft } from "../binding-commands";
import { readDataDescriptor, formulaContext, documentFormulas } from "../binding-catalogue";
import { dataRecord, type DataBridge, type DataCatalogue, type DataNative, type DataResult, type DataValue } from "../binding-contract";
import type { EditorNode } from "../../../template-editor-model";

export function useBindingForm(bridge: DataBridge, native: DataNative | null, catalogue: DataCatalogue | null, nodeId: string) {
  const state = useSyncExternalStore(bridge.subscribe, bridge.read, bridge.read);
  const authoritySnapshot = () => JSON.stringify([bridge.context(), bridge.selection(), bridge.canEdit()]);
  useSyncExternalStore(bridge.subscribe, authoritySnapshot, authoritySnapshot);
  const [draft, setDraft] = useState(() => openDataDraft(bridge, native, catalogue, nodeId));
  const [result, setResult] = useState<DataResult | null>(null);
  const [inferred, setInferred] = useState<{ type: string; dimension: string; nullable: boolean } | null>(null);
  const descriptor = readDataDescriptor(native, catalogue, bridge.context(), state.document);
  const update = (change: (node: EditorNode) => EditorNode) => { setResult(null); setInferred(null); setDraft(current => current ? { ...current, node: change(current.node) } : null); };
  const prop = (key: string, value: unknown) => update(node => ({ ...node, props: { ...node.props, [key]: value } }));
  const submit = (event: FormEvent) => {
    event.preventDefault(); if (!draft) return;
    const outcome = applyDataDraft(bridge, native, catalogue, draft); setResult(outcome);
    if (outcome === "applied" || outcome === "unchanged") setDraft(openDataDraft(bridge, native, catalogue, nodeId));
  };
  const check = () => {
    if (!native || !draft || !descriptor || !catalogue || !state.document) return;
    try {
      const document = { ...state.document, nodes: { ...state.document.nodes, [nodeId]: draft.node } };
      const context = formulaContext(descriptor, catalogue, undefined, documentFormulas(document));
      const expression = native.parseTemplateFormulaExpression(draft.node.props.expression);
      setInferred(native.inferTemplateFormulaType(expression, context)); setResult(null);
    } catch { setInferred(null); setResult("invalid"); }
  };
  const sameAuthority = !!draft && JSON.stringify(draft.context) === JSON.stringify(bridge.context());
  const stale = !!draft && (state.generation !== draft.generation || JSON.stringify(state.document?.nodes[nodeId]) !== JSON.stringify(draft.original) || bridge.selection().length !== 1 || bridge.selection()[0] !== nodeId);
  const unavailable = !descriptor || !draft || !sameAuthority;
  const disabled = unavailable || stale || !bridge.canEdit() || bridge.context().readOnly || state.gestureActive || !!draft?.node.locked;
  return { draft: sameAuthority ? draft : null, descriptor, result, inferred, unavailable, disabled, submit, check, prop,
    binding: (value: DataValue) => update(node => ({ ...node, binding: value as EditorNode["binding"] })),
    visibility: (value: DataValue | undefined) => { setResult(null); setDraft(current => {
      if (!current) return null;
      const node = { ...current.node }; if (value === undefined) delete node.visibilityExpression; else node.visibilityExpression = value;
      return { ...current, node, visibilityEdited: true };
    }); },
    label: (segments: DataValue[]) => prop("label", { ...dataRecord(draft?.node.props.label), segments }),
    reset: () => { setDraft(openDataDraft(bridge, native, catalogue, nodeId)); setResult(null); setInferred(null); },
  };
}

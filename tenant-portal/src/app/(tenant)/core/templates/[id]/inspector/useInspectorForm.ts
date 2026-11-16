"use client";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { generateUUIDv7 } from "@/lib/uuid";
import { useI18n } from "@/i18n/I18nContext";
import { templateInspectorAr, templateInspectorEn } from "@/i18n/dictionaries/template-inspector";
import { applyInspectorDraft, hasLockedAncestor, openInspectorDraft } from "./inspector-commands";
import { inspectorRecord, inspectorRecords, type InspectorBridge, type InspectorNative, type InspectorResult } from "./inspector-contract";
import { changeInspectorTable, mergeInspectorTable, updateInspectorCollection, type TableOperation } from "./inspector-table";
import type { EditorNode } from "../../template-editor-model";

export function useInspectorCopy() {
  const { lang } = useI18n();
  return { ar: templateInspectorAr, en: templateInspectorEn }[lang];
}
export function useInspectorInput(onValue: (value: string) => void) {
  return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onValue(event.target.value);
}
export function useInspectorNumber(onValue: (value: number) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => onValue(event.target.valueAsNumber);
}
export function useInspectorToggle(onValue: (value: boolean) => void) {
  return (checked: boolean | "indeterminate") => onValue(checked === true);
}
export function useInspectorForm(bridge: InspectorBridge, native: InspectorNative, id: string) {
  const [draft, setDraft] = useState(() => openInspectorDraft(bridge, id));
  const [result, setResult] = useState<InspectorResult | "structuralRefused" | null>(null);
  const update = (fn: (node: EditorNode) => EditorNode) => { setResult(null); setDraft(value => value ? { ...value, node: fn(value.node) } : null); };
  const style = (key: string) => (value: unknown) => update(node => ({ ...node, style: { ...node.style, [key]: value === "INHERIT" || value === "" ? undefined : value } }));
  const prop = (key: string) => (value: unknown) => update(node => ({ ...node, props: { ...node.props, [key]: value } }));
  const nestedStyle = (key: "border" | "padding", field: string) => (value: unknown) => update(node => ({ ...node, style: {
    ...node.style, [key]: { ...(key === "border" ? { widthPx: 1, style: "SOLID", color: "#000000" } : { unit: "PX", blockStart: 0, inlineEnd: 0, blockEnd: 0, inlineStart: 0 }), ...inspectorRecord(node.style[key]), [field]: value },
  } }));
  const collection = (key: "columns" | "rows", index: number) => (patch: Record<string, unknown>) => update(node => updateInspectorCollection(node, key, index, patch));
  const table = (operation: TableOperation) => {
    if (!draft) return;
    const next = changeInspectorTable(draft.node, operation);
    if (!next) { setResult("structuralRefused"); return; }
    update(() => next);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const outcome = applyInspectorDraft(bridge, native, draft);
    setResult(outcome);
    if (outcome === "applied" || outcome === "unchanged") setDraft(openInspectorDraft(bridge, id));
  };
  const state = bridge.read(), document = state.document, current = document?.nodes[id];
  const stale = !!draft && (!current || state.generation !== draft.generation || bridge.context().key !== draft.contextKey || JSON.stringify(current) !== JSON.stringify(draft.original) || document?.direction !== draft.originalDirection);
  const disabled = !draft || !document || !current || !bridge.canEdit() || state.gestureActive || current.locked || hasLockedAncestor(document, current) || stale;
  const dirty = !!draft && (JSON.stringify(draft.node) !== JSON.stringify(draft.original) || draft.direction !== draft.originalDirection);
  return {
    draft, result, disabled, dirty, stale, submit, style, prop, nestedStyle, collection, table, update, theme: document?.theme ?? {},
    reset: () => { setDraft(openInspectorDraft(bridge, id)); setResult(null); },
    merge: (startRow: number, endRow: number, startColumn: number, endColumn: number, unmerge = false) => {
      if (!draft) return;
      const next = mergeInspectorTable(draft.node, startRow, endRow, startColumn, endColumn, unmerge);
      if (!next) { setResult("structuralRefused"); return; }
      update(() => next);
    },
    name: (name: string) => update(node => ({ ...node, name })),
    binding: (value: Record<string, unknown>) => update(node => typeof value.path === "string" && typeof value.nullBehavior === "string" ? { ...node, binding: { ...value, path: value.path, nullBehavior: value.nullBehavior } } : node),
    direction: (direction: string) => { setResult(null); setDraft(value => value ? { ...value, direction } : null); },
    focal: (key: "focalX" | "focalY") => (value: number) => update(node => ({ ...node, props: { ...node.props, crop: { focalX: 0.5, focalY: 0.5, ...inspectorRecord(node.props.crop), [key]: value } } })),
    resetStyle: () => update(node => ({ ...node, style: {} })),
    addTotal: (path: string) => update(node => ({ ...node, props: { ...node.props, rows: [...inspectorRecords(node.props.rows), { id: generateUUIDv7(), label: "", binding: { path, nullBehavior: "EMPTY" }, emphasis: "NORMAL", visible: true }] } })),
    moveTotal: (index: number, delta: -1 | 1) => update(node => {
      const rows = [...inspectorRecords(node.props.rows)], target = index + delta;
      if (target < 0 || target >= rows.length) return node;
      [rows[index], rows[target]] = [rows[target], rows[index]];
      return { ...node, props: { ...node.props, rows } };
    }),
    removeTotal: (index: number) => update(node => ({ ...node, props: { ...node.props, rows: inspectorRecords(node.props.rows).filter((_, at) => at !== index) } })),
  };
}
export type InspectorForm = ReturnType<typeof useInspectorForm>;


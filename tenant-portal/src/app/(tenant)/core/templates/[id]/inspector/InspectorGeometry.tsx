"use client";
import { Button } from "@/design-system";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import type { EditorNode } from "../../template-editor-model";
import type { InspectorArrangement, InspectorBridge } from "./inspector-contract";
import { InspectorNumber } from "./InspectorFields";
import { useInspectorGeometry } from "./useInspectorGeometry";

export function InspectorGeometry({ node, bridge, arrangement, disabled, copy: c }: { node: EditorNode; bridge: InspectorBridge; arrangement: InspectorArrangement; disabled: boolean; copy: InspectorCopy }) {
  const form = useInspectorGeometry(node, bridge, arrangement, disabled);
  return <form onSubmit={form.submit}><fieldset disabled={disabled} className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">{c.geometry}</legend>
    <div className="grid grid-cols-2 gap-3">{(["x", "y", "width", "height", "rotationDeg"] as const).map(key => <InspectorNumber key={key} label={c[key]} value={form.frame[key]} min={key === "rotationDeg" ? -180 : key === "width" || key === "height" ? 0.001 : 0} max={key === "rotationDeg" ? 180 : 1000} step={0.001} onValue={form.change(key)} />)}</div>
    <Button type="submit" size="sm" variant="outline">{c.geometryApply}</Button>
    {form.failed && <p role="alert" className="text-sm text-destructive">{c.invalid}</p>}
  </fieldset></form>;
}

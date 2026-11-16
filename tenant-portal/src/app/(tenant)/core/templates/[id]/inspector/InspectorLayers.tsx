"use client";
import { Badge, Button, Checkbox } from "@/design-system";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import type { EditorDocument } from "../../template-editor-model";
import type { InspectorArrangement, InspectorBridge } from "./inspector-contract";
import { inspectorSelectionFlag, useInspectorLayers } from "./useInspectorLayers";
import { inspectorArrangementAffordances } from "./inspector-affordances";
import { inspectorLayerLabel } from "./inspector-labels";

export function InspectorLayers({ document, bridge, arrangement, pendingProperties = false, copy: c }: { document: EditorDocument; bridge: InspectorBridge; arrangement?: InspectorArrangement; pendingProperties?: boolean; copy: InspectorCopy }) {
  const layers = useInspectorLayers(document, bridge, arrangement, pendingProperties), selectedIds = bridge.selection();
  const available = inspectorArrangementAffordances(document, selectedIds);
  const disabled = pendingProperties || !arrangement || !bridge.canEdit() || bridge.read().gestureActive || !selectedIds.length;
  return <section className="space-y-3" aria-label={c.layers}>
    <h3 className="text-sm font-medium">{c.layers}</h3><p className="text-xs text-muted-foreground">{c.layerHelp}</p>
    <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">{layers.nodes.map(({ id, depth }, index) => <div key={id} className="flex min-w-0 items-center gap-2">
      <Button disabled={pendingProperties} variant={selectedIds.includes(id) ? "secondary" : "ghost"} type="button" size="sm" className="min-w-0 flex-1 justify-start truncate" aria-pressed={selectedIds.includes(id)} onClick={layers.select(id)}>{Array.from({ length: depth }, () => "·").join("")} {inspectorLayerLabel(document.nodes[id], index, c, layers.number)}</Button>
      {document.nodes[id].locked && <Badge tone="neutral">{c.locked}</Badge>}{document.nodes[id].hidden && <Badge tone="neutral">{c.hidden}</Badge>}
    </div>)}</div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" disabled={disabled || !available.forward} onClick={layers.forward}>{c.forward}</Button><Button type="button" size="sm" variant="outline" disabled={disabled || !available.backward} onClick={layers.backward}>{c.backward}</Button>
      <Button type="button" size="sm" variant="outline" disabled={disabled || !available.group} onClick={layers.group}>{c.group}</Button><Button type="button" size="sm" variant="outline" disabled={disabled || !available.ungroup} onClick={layers.ungroup}>{c.ungroup}</Button>
      <label className="flex min-h-8 items-center gap-2 text-sm"><Checkbox disabled={disabled} checked={inspectorSelectionFlag(document, selectedIds, "locked")} onCheckedChange={layers.lock} />{c.lock}</label>
      <label className="flex min-h-8 items-center gap-2 text-sm"><Checkbox disabled={disabled} checked={inspectorSelectionFlag(document, selectedIds, "hidden")} onCheckedChange={layers.hide} />{c.hide}</label>
    </div>
    {!disabled && !available.eligible && <p role="status" className="text-xs text-muted-foreground">{c.positionedSelectionHelp}</p>}
    {layers.failed && <p role="alert" className="text-sm text-destructive">{c.blocked}</p>}
  </section>;
}

"use client";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import type { TemplateAsset } from "../../template-assets-contract";
import { InspectorCheck, InspectorNumber, InspectorSelect, InspectorText } from "./InspectorFields";
import { inspectorRecord } from "./inspector-contract";
import type { InspectorForm } from "./useInspectorForm";
import { InspectorImagePreview } from "./InspectorImagePreview";

export function InspectorContent({ form, assets, copy: c }: { form: InspectorForm; assets: TemplateAsset[]; copy: InspectorCopy }) {
  const node = form.draft!.node;
  return <>
    {node.type === "text" && <InspectorText label={c.text} value={node.props.text} multiline maxLength={20_000} onValue={form.prop("text")} />}
    {node.type === "divider" && <fieldset className="space-y-3"><legend className="text-sm font-medium">{c.nodeDivider}</legend>
      <InspectorText label={c.dividerColor} value={node.props.color} onValue={form.prop("color")} />
      <InspectorNumber label={c.dividerThickness} value={node.props.thicknessPx} min={0.1} max={12} onValue={form.prop("thicknessPx")} />
      <InspectorSelect label={c.border} value={node.props.style} options={(["SOLID", "DASHED", "DOTTED"] as const).map(value => ({ value, label: c[value] }))} onValue={form.prop("style")} />
    </fieldset>}
    {node.type === "image" && <fieldset className="space-y-3 rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">{c.image}</legend>
      <InspectorSelect label={c.asset} value={node.props.assetId} options={[{ value: String(node.props.assetId), label: assets.find(asset => asset.id === node.props.assetId)?.originalFileName ?? String(node.props.assetId) }, ...assets.filter(asset => asset.id !== node.props.assetId && asset.status === "ACTIVE").map(asset => ({ value: asset.id, label: asset.originalFileName }))]} onValue={form.prop("assetId")} />
      <InspectorText label={c.alt} value={node.props.alt} onValue={form.prop("alt")} maxLength={500} />
      <InspectorCheck label={c.decorative} value={node.props.decorative} onValue={form.prop("decorative")} />
      <InspectorSelect label={c.fit} value={node.style.objectFit ?? "CONTAIN"} options={(["CONTAIN", "COVER", "FILL"] as const).map(value => ({ value, label: c[value] }))} onValue={form.style("objectFit")} />
      <div className="grid grid-cols-2 gap-3"><InspectorNumber label={c.focalX} value={inspectorRecord(node.props.crop).focalX ?? 0.5} min={0} max={1} onValue={form.focal("focalX")} /><InspectorNumber label={c.focalY} value={inspectorRecord(node.props.crop).focalY ?? 0.5} min={0} max={1} onValue={form.focal("focalY")} /></div>
      <InspectorImagePreview node={node} assets={assets} copy={c} />
      <p className="text-xs text-muted-foreground">{c.cropHelp}</p>
    </fieldset>}
  </>;
}

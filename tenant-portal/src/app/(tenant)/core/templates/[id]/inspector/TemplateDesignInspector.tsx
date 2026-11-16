"use client";
import { Button } from "@/design-system";
import type { TemplateDataSchema } from "../../template-design-api";
import type { TemplateAsset } from "../../template-assets-contract";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import type { InspectorArrangement, InspectorBridge, InspectorNative } from "./inspector-contract";
import { InspectorAppearance } from "./InspectorAppearance";
import { InspectorContent } from "./InspectorContent";
import { InspectorTable } from "./InspectorTable";
import { InspectorTotals } from "./InspectorTotals";
import { InspectorLayers } from "./InspectorLayers";
import { InspectorGeometry } from "./InspectorGeometry";
import { InspectorBinding } from "./InspectorBinding";
import { inspectorArrangementAffordances } from "./inspector-affordances";
import { createInspectorCurrencyQualification } from "./inspector-currency";
import { useInspectorCopy, useInspectorForm } from "./useInspectorForm";

import { bindInspectorAdmission, inspectorAdmissionCurrent, type InspectorExtensionPorts, type InspectorFontMetadata, type InspectorImageCropPort, type InspectorLocalState, type InspectorValidationContext } from "./inspector-ports";
import { InspectorPortsContext } from "./useInspectorPorts";
import { useInspectorLocalState, useInspectorSession } from "./useInspectorLocalState";
import type { DataEligibilityPort } from "../bindings/data-eligibility";

export interface TemplateDesignInspectorProps {
  bridge: InspectorBridge;
  native?: InspectorNative;
  arrangement?: InspectorArrangement;
  schema: TemplateDataSchema | null;
  assets: TemplateAsset[];
  validation?: InspectorValidationContext;
  fonts?: readonly InspectorFontMetadata[];
  imageCrop?: InspectorImageCropPort;
  eligibility?: DataEligibilityPort;
  extensions?: InspectorExtensionPorts;
  onLocalStateChange?: (state: InspectorLocalState) => void;
}

/** Parent subscribes to the canonical store, as it does for the canvas and ribbon. */
export function TemplateDesignInspector(props: TemplateDesignInspectorProps) {
  const session = useInspectorSession(props.onLocalStateChange);
  const c = useInspectorCopy(), state = props.bridge.read(), selectedIds = props.bridge.selection();
  if (!state.document || !props.bridge.context().canRead) return null;
  if (!props.native) return <p role="status" className="text-sm text-muted-foreground">{c.unavailable}</p>;
  const admitted = inspectorAdmissionCurrent(props.bridge, props.validation), guardedBridge = bindInspectorAdmission(props.bridge, props.validation);
  const selected = selectedIds.length === 1 ? state.document.nodes[selectedIds[0]] : null;
  return <aside aria-label={c.title} className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-4">
    <h2 className="text-sm font-semibold">{c.title}</h2>
    {!admitted && <p role="status" className="text-sm text-muted-foreground">{c.descriptorUnavailable}</p>}
    {admitted && !props.bridge.canEdit() && <p role="status" className="text-sm text-muted-foreground">{c.readOnly}</p>}
    {selected ? <InspectorNodeForm key={`${props.bridge.context().key}:${state.generation}:${selected.id}`} {...props} bridge={guardedBridge} onLocalStateChange={session.change} native={props.native} id={selected.id} copy={c} /> : <p className="text-sm text-muted-foreground">{selectedIds.length ? c.multiple : c.select}</p>}
    <InspectorLayers document={state.document} bridge={guardedBridge} arrangement={props.arrangement} copy={c} pendingProperties={!!session.state?.dirty} />
  </aside>;
}

function InspectorNodeForm({ bridge, native, validation, arrangement, schema, assets, fonts = [], imageCrop, eligibility, extensions = {}, onLocalStateChange, id, copy: c }: TemplateDesignInspectorProps & { native: InspectorNative; id: string; copy: InspectorCopy }) {
  const form = useInspectorForm(bridge, native, id), node = form.draft?.node;
  useInspectorLocalState({ ownerKey: bridge.context().key, nodeId: id, dirty: form.dirty, stale: form.stale, disabled: form.disabled }, onLocalStateChange);
  const RichTextEditor = extensions.RichTextEditor, Feedback = extensions.Feedback;
  if (!node) return null;
  const currency = createInspectorCurrencyQualification(bridge, native, validation, form.draft, eligibility);
  return <InspectorPortsContext.Provider value={{ fonts, extensions, imageCrop, currency, disabled: form.disabled }}><div className="space-y-4">
    <form onSubmit={form.submit} className="space-y-3">
      {form.stale && <p role="alert" className="text-sm text-destructive">{c.stale}</p>}
      <fieldset disabled={form.disabled} className="space-y-3">
        <InspectorAppearance form={form} copy={c} />
        <InspectorContent form={form} assets={assets} copy={c} />
        {node.type === "dataField" && <InspectorBinding value={node.binding} fields={schema?.fields.filter(field => !field.path.includes("[]")) ?? []} onValue={form.binding} copy={c} />}
        {(node.type === "staticTable" || node.type === "dynamicTable") && <InspectorTable form={form} fields={schema?.fields ?? []} copy={c} />}
        {node.type === "totals" && <InspectorTotals form={form} fields={schema?.fields ?? []} copy={c} />}
      </fieldset>
      {form.result && (Feedback ? <Feedback result={form.result} dirty={form.dirty} stale={form.stale} disabled={form.disabled} /> : <p role={form.result === "applied" || form.result === "unchanged" ? "status" : "alert"} className="text-sm">{c[form.result]}</p>)}
      <div className="flex flex-wrap gap-2"><Button type="submit" size="sm" variant="outline" disabled={form.disabled || !form.dirty}>{c.apply}</Button><Button type="button" size="sm" variant="ghost" onClick={form.reset}>{c.reset}</Button></div>
    </form>
    {node.type === "richText" && RichTextEditor && <RichTextEditor bridge={bridge} native={native} node={bridge.read().document!.nodes[id]} disabled={form.disabled || form.dirty} />}
    {node.layout.kind === "ABSOLUTE" && (arrangement ? <InspectorGeometry key={JSON.stringify(bridge.read().document?.nodes[id]?.layout)} node={node} bridge={bridge} arrangement={arrangement} disabled={form.disabled || form.dirty || !inspectorArrangementAffordances(bridge.read().document, [id]).eligible} copy={c} /> : <p role="status" className="text-xs text-muted-foreground">{c.geometryUnavailable}</p>)}
    {form.dirty && <p className="text-xs text-muted-foreground">{c.geometrySeparate}</p>}
  </div></InspectorPortsContext.Provider>;
}

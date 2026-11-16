"use client";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/design-system";
import { BindingEditor, FormatEditor } from "./BindingEditor";
import { FormulaEditor } from "./FormulaEditor";
import { RichTokenEditor, TokenEditor } from "./TokenEditor";
import { VisibilityEditor } from "./VisibilityEditor";
import { dataRecord, type DataBridge, type DataCatalogue, type DataNative } from "./binding-contract";
import { documentFormulas } from "./binding-catalogue";
import { useBindingForm } from "./hooks/useBindingForm";
import { useDataCopy, useDataNotice } from "./hooks/useDataControls";
import { DataEditingContext } from "./data-editing-context";
import { DataEligibilityContext } from "./data-eligibility-context";
import type { DataEligibilityPort } from "./data-eligibility";

export interface TemplateBindingDialogProps { bridge: DataBridge; native: DataNative | null; catalogue: DataCatalogue | null; nodeId: string; eligibility?: DataEligibilityPort }
export function TemplateBindingDialog(props: TemplateBindingDialogProps) {
  const c = useDataCopy();
  return <Dialog><DialogTrigger asChild><Button type="button" size="sm" variant="outline" disabled={!props.bridge.context().canRead}>{c.title}</Button></DialogTrigger>
    <DialogContent size="2xl" className="max-h-[85dvh] overflow-y-auto"><DialogTitle>{c.title}</DialogTitle><DialogDescription>{c.help}</DialogDescription>
      <TemplateBindingForm key={props.nodeId} {...props} />
    </DialogContent>
  </Dialog>;
}
export function TemplateBindingForm({ bridge, native, catalogue, nodeId, eligibility }: TemplateBindingDialogProps) {
  const c = useDataCopy(), form = useBindingForm(bridge, native, catalogue, nodeId), node = form.draft?.node, descriptor = form.descriptor;
  const notice = useDataNotice(form.result);
  if (!node || !descriptor || !catalogue) return <p role="status">{c.status.unavailable}</p>;
  return <form className="space-y-5" onSubmit={form.submit}>
    <p className="break-all text-xs text-muted-foreground">{c.schemaPin}: <bdi dir="ltr">{descriptor.key} / {descriptor.version} / {descriptor.checksum}</bdi></p>
    <DataEligibilityContext.Provider value={eligibility ?? null}><DataEditingContext.Provider value={form.disabled}><fieldset disabled={form.disabled} className="space-y-5">
      {node.type === "dataField" && <BindingEditor descriptor={descriptor} value={node.binding} change={form.binding} />}
      {node.type === "formula" && <section className="space-y-4" aria-label={c.formula}>
        <FormulaEditor value={node.props.expression} descriptor={descriptor} catalogue={catalogue} formulas={Object.keys(documentFormulas(bridge.read().document!)).filter(id => id !== node.props.formulaId)} change={value => form.prop("expression", value)} />
        <FormatEditor currencyRequest={{ kind: "FORMULA", expression: node.props.expression, format: node.props.format }} value={node.props.format} allowed={["TEXT", "NUMBER", "CURRENCY", "PERCENTAGE", "DATE", "BOOLEAN"]} change={value => form.prop("format", value)} />
        <Button type="button" variant="outline" onClick={form.check}>{c.check}</Button>
        {form.inferred && <p role="status">{c.resultType}: {c.status[form.inferred.type as keyof typeof c.status]} / {c.status[form.inferred.dimension as keyof typeof c.status]}</p>}
      </section>}
      {["link", "button"].includes(node.type) && <section aria-label={c.tokens}><TokenEditor descriptor={descriptor} value={dataRecord(node.props.label).segments} change={form.label} /></section>}
      {node.type === "richText" && <section aria-label={c.tokens}><RichTokenEditor descriptor={descriptor} value={node.props.document} change={value => form.prop("document", value)} /></section>}
      {node.visibilityRule !== undefined && <p className="text-sm text-muted-foreground">{c.legacy}</p>}
      {node.type !== "pageBreak" && <VisibilityEditor descriptor={descriptor} value={node.visibilityExpression} change={form.visibility} />}
    </fieldset></DataEditingContext.Provider></DataEligibilityContext.Provider>
    {form.result && <p ref={notice} tabIndex={-1} role={form.result === "applied" || form.result === "unchanged" ? "status" : "alert"}>{c.status[form.result]}</p>}
    <div className="flex flex-wrap gap-2"><Button type="submit" variant="outline" disabled={form.disabled}>{c.apply}</Button><Button type="button" variant="ghost" onClick={form.reset}>{c.discard}</Button></div>
  </form>;
}

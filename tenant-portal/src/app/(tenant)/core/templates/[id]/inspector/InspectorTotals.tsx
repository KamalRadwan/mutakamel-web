"use client";
import { Button } from "@/design-system";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import type { TemplateDataSchema } from "../../template-design-api";
import { InspectorCheck, InspectorSelect, InspectorText } from "./InspectorFields";
import { InspectorBinding } from "./InspectorBinding";
import { inspectorRecords } from "./inspector-contract";
import type { InspectorForm } from "./useInspectorForm";

export function InspectorTotals({ form, fields, copy: c }: { form: InspectorForm; fields: TemplateDataSchema["fields"]; copy: InspectorCopy }) {
  const rows = inspectorRecords(form.draft!.node.props.rows), scalarFields = fields.filter(field => !field.path.includes("[]") && !["ARRAY", "OBJECT", "IMAGE"].includes(field.dataType));
  return <fieldset className="space-y-3"><legend className="text-sm font-medium">{c.totals}</legend>
    <p className="text-xs text-muted-foreground">{c.totalsHelp}</p>
    {rows.map((row, index) => <div key={String(row.id)} className="space-y-3 rounded-lg border border-border p-3">
      <InspectorText label={c.label} value={row.label} onValue={label => form.collection("rows", index)({ label })} />
      <InspectorBinding value={row.binding} fields={scalarFields} copy={c} onValue={binding => form.collection("rows", index)({ binding })} />
      <InspectorSelect label={c.emphasis} value={row.emphasis} options={(["NORMAL", "STRONG", "GRAND_TOTAL"] as const).map(value => ({ value, label: c[value] }))} onValue={emphasis => form.collection("rows", index)({ emphasis })} />
      <InspectorCheck label={c.visible} value={row.visible} onValue={visible => form.collection("rows", index)({ visible })} />
      <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={!index} onClick={() => form.moveTotal(index, -1)}>{c.up}</Button><Button type="button" size="sm" variant="outline" disabled={index === rows.length - 1} onClick={() => form.moveTotal(index, 1)}>{c.down}</Button><Button type="button" size="sm" variant="outline" disabled={rows.length <= 1} onClick={() => form.removeTotal(index)}>{c.remove}</Button></div>
    </div>)}
    <Button type="button" size="sm" variant="outline" disabled={rows.length >= 20 || !scalarFields.length} onClick={() => form.addTotal(scalarFields[0].path)}>{c.addTotal}</Button>
  </fieldset>;
}

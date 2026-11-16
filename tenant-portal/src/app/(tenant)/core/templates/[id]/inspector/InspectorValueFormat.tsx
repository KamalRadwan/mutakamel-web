"use client";
import type { TemplateDataSchema } from "../../template-design-api";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import { inspectorRecord } from "./inspector-contract";
import { InspectorCheck, InspectorNumber, InspectorSelect, InspectorText } from "./InspectorFields";
import { changeInspectorFormat, inspectorAllowedFormats, inspectorFormatTypes, type InspectorFormatType } from "./inspector-format";
import { InspectorCurrencyField } from "./InspectorCurrencyField";

export function InspectorValueFormat({ value, fields, onValue, copy: c }: { value: unknown; fields: TemplateDataSchema["fields"]; onValue: (value: Record<string, unknown>) => void; copy: InspectorCopy }) {
  const binding = inspectorRecord(value), format = inspectorRecord(binding.format), type = String(format.type ?? "INHERIT");
  const allowed = inspectorAllowedFormats(String(binding.path), fields), registered = fields.some(field => field.path === binding.path);
  const options = [...new Set([...allowed, ...(inspectorFormatTypes.includes(type as InspectorFormatType) ? [type as InspectorFormatType] : [])])];
  const update = (key: string) => (value: unknown) => onValue({ ...binding, format: { ...format, [key]: value } });
  return <fieldset disabled={!registered} className="space-y-3">
    {!registered && <p role="status" className="text-xs text-muted-foreground">{c.bindingUnavailable}</p>}
    <InspectorSelect label={c.format} value={type} options={[{ value: "INHERIT", label: c.inherit }, ...options.map(value => ({ value, label: c[value], disabled: !allowed.includes(value) }))]} onValue={type => { const next = changeInspectorFormat(binding, type, fields); if (next) onValue(next); }} disabled={!registered} />
    {(["NUMBER", "CURRENCY", "PERCENTAGE"].includes(type)) && <>
      <InspectorNumber label={c.minimumFractionDigits} value={format.minimumFractionDigits ?? 0} min={0} max={8} step={1} onValue={update("minimumFractionDigits")} />
      <InspectorNumber label={c.maximumFractionDigits} value={format.maximumFractionDigits ?? 2} min={0} max={8} step={1} onValue={update("maximumFractionDigits")} />
      {type === "NUMBER" && <InspectorCheck label={c.useGrouping} value={format.useGrouping ?? "indeterminate"} onValue={update("useGrouping")} />}
      {type === "CURRENCY" && <InspectorCurrencyField value={value} onValue={onValue} disabled={!registered} copy={c} />}
    </>}
    {(type === "DATE" || type === "DATETIME") && <InspectorSelect label={c.dateStyle} value={format.dateStyle} options={(["SHORT", "MEDIUM", "LONG"] as const).map(value => ({ value, label: c[value] }))} onValue={update("dateStyle")} />}
    {type === "DATETIME" && <InspectorSelect label={c.timeStyle} value={format.timeStyle} options={(["SHORT", "MEDIUM"] as const).map(value => ({ value, label: c[value] }))} onValue={update("timeStyle")} />}
    {type === "TEXT" && <InspectorSelect label={c.transform} value={format.transform ?? "NONE"} options={(["NONE", "UPPERCASE", "LOWERCASE"] as const).map(value => ({ value, label: c[value] }))} onValue={update("transform")} />}
    {type === "BOOLEAN" && <><InspectorText label={c.trueText} value={format.trueText} onValue={update("trueText")} /><InspectorText label={c.falseText} value={format.falseText} onValue={update("falseText")} /></>}
  </fieldset>;
}

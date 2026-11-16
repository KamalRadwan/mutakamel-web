"use client";
import type { TemplateDataSchema } from "../../template-design-api";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import { inspectorRecord } from "./inspector-contract";
import { InspectorSelect } from "./InspectorFields";
import { InspectorValueFormat } from "./InspectorValueFormat";
import { useInspectorPorts } from "./useInspectorPorts";

export function InspectorBinding({ value, fields, onValue, copy: c }: { value: unknown; fields: TemplateDataSchema["fields"]; onValue: (value: Record<string, unknown>) => void; copy: InspectorCopy }) {
  const binding = inspectorRecord(value), path = String(binding.path ?? ""), ports = useInspectorPorts();
  const paths = [...new Set([path, ...fields.filter(field => !["ARRAY", "OBJECT", "IMAGE"].includes(field.dataType)).map(field => field.path)])].filter(Boolean);
  const BindingPicker = ports.extensions.BindingPicker;
  return <div className="space-y-3">
    {BindingPicker ? <BindingPicker value={value} fields={fields} onValue={onValue} disabled={ports.disabled} /> : <InspectorSelect label={c.binding} value={path} options={paths.map(value => ({ value, label: value }))} onValue={path => onValue({ ...binding, path })} />}
    <InspectorValueFormat value={value} fields={fields} onValue={onValue} copy={c} />
  </div>;
}

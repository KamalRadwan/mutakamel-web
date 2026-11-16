"use client";
import type { TemplateDataSchema } from "../../template-design-api";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import { inspectorRecord } from "./inspector-contract";
import { InspectorSelect, InspectorText } from "./InspectorFields";
import { InspectorBinding } from "./InspectorBinding";
import { useInspectorPorts } from "./useInspectorPorts";

export function InspectorCellValue({ value, fields, onValue, label, copy: c }: { value: unknown; fields: TemplateDataSchema["fields"]; onValue: (value: Record<string, unknown>) => void; label: string; copy: InspectorCopy }) {
  const cell = inspectorRecord(value), kind = String(cell.kind), scalar = fields.filter(field => !["ARRAY", "OBJECT", "IMAGE"].includes(field.dataType));
  const ports = useInspectorPorts();
  const CellValuePicker = ports.extensions.CellValuePicker;
  if (CellValuePicker) return <CellValuePicker value={value} fields={fields} onValue={onValue} disabled={ports.disabled} />;
  return <div className="space-y-3">
    <InspectorSelect label={label} value={kind} options={[{ value: "TEXT", label: c.TEXT }, ...(scalar.length ? [{ value: "BINDING", label: c.BINDING }] : []), ...(kind === "FORMULA" ? [{ value: "FORMULA", label: c.FORMULA }] : [])]} onValue={kind => {
      if (kind === "TEXT") onValue({ kind, value: "" });
      if (kind === "BINDING" && scalar.length) onValue({ kind, binding: { path: scalar[0].path, nullBehavior: "EMPTY" } });
    }} />
    {kind === "TEXT" && <InspectorText label={c.text} value={cell.value} onValue={value => onValue({ ...cell, value })} maxLength={20_000} />}
    {kind === "BINDING" && <InspectorBinding fields={fields} value={cell.binding} onValue={binding => onValue({ ...cell, binding })} copy={c} />}
    {kind === "FORMULA" && <p className="text-xs text-muted-foreground">{c.unsupportedValue}</p>}
  </div>;
}

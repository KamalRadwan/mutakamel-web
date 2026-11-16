"use client";
import { Button } from "@/design-system";
import { dataFields } from "./binding-catalogue";
import { dataRecord, type DataDescriptor, type DataValue } from "./binding-contract";
import { DataInput, DataNumber, DataSelect } from "./DataControls";
import { FieldPicker } from "./FieldPicker";
import { useDataCopy } from "./hooks/useDataControls";

export function VisibilityEditor({ descriptor, value: input, change, depth = 0 }: { descriptor: DataDescriptor; value: unknown; change(value: DataValue | undefined): void; depth?: number }) {
  const c = useDataCopy(), value = dataRecord(input), kind = String(value.kind ?? "IS_NOT_NULL");
  const field = dataFields(descriptor).find(row => row.path === value.path)?.field;
  const patch = (key: string, next: unknown) => change({ ...value, [key]: next });
  if (!input) return <section className="space-y-2"><p className="text-sm text-muted-foreground">{c.noCondition}</p><Button type="button" variant="outline" onClick={() => change({ kind: "IS_NOT_NULL", path: "" })}>{c.addCondition}</Button></section>;
  if (depth > 32) return <p role="alert">{c.status.invalid}</p>;
  return <fieldset className="space-y-3 rounded-md border border-border p-3">
    <DataSelect label={c.visibility} value={kind} values={["IS_NULL", "IS_NOT_NULL", "COMPARE", "ALL", "ANY", "NOT"]} change={kind => change(kind === "ALL" || kind === "ANY" ? { kind, operands: [{ kind: "IS_NOT_NULL", path: "" }] } : kind === "NOT" ? { kind, operand: { kind: "IS_NOT_NULL", path: "" } } : { kind, path: "", ...(kind === "COMPARE" ? { operator: "EQ", value: "" } : {}) })} />
    {["IS_NULL", "IS_NOT_NULL", "COMPARE"].includes(kind) && <FieldPicker descriptor={descriptor} value={String(value.path ?? "")} change={path => {
      const selected = dataFields(descriptor).find(row => row.path === path)?.field;
      change({ kind, path, ...(kind === "COMPARE" ? { operator: "EQ", value: selected?.dataType === "BOOLEAN" ? false : selected?.dataType === "NUMBER" ? 0 : "" } : {}) });
    }} />}
    {kind === "COMPARE" && <>
      <DataSelect label={c.operator} value={String(value.operator)} values={field?.dataType === "BOOLEAN" ? ["EQ", "NE"] : ["EQ", "NE", "LT", "LTE", "GT", "GTE"]} change={next => patch("operator", next)} />
      {field?.dataType === "BOOLEAN" ? <DataSelect label={c.value} value={value.value === true ? "TRUE" : "FALSE"} values={["TRUE", "FALSE"]} change={next => patch("value", next === "TRUE")} /> : field?.dataType === "NUMBER" ? <DataNumber label={c.value} value={value.value as number} change={next => patch("value", next)} /> : <DataInput label={c.value} value={String(value.value ?? "")} change={next => patch("value", next)} hint={field?.dataType === "DECIMAL" ? c.decimalHint : undefined} />}
    </>}
    {kind === "NOT" && <VisibilityEditor descriptor={descriptor} value={value.operand} depth={depth + 1} change={next => patch("operand", next)} />}
    {["ALL", "ANY"].includes(kind) && <>
      {(Array.isArray(value.operands) ? value.operands : []).map((item, index) => <div key={index} className="space-y-2"><VisibilityEditor descriptor={descriptor} value={item} depth={depth + 1} change={next => patch("operands", (value.operands as unknown[]).map((row, at) => at === index ? next : row))} /><Button type="button" size="sm" variant="outline" onClick={() => patch("operands", (value.operands as unknown[]).filter((_, at) => at !== index))}>{c.remove}</Button></div>)}
      <Button type="button" size="sm" variant="outline" disabled={Array.isArray(value.operands) && value.operands.length >= 100} onClick={() => patch("operands", [...(Array.isArray(value.operands) ? value.operands : []), { kind: "IS_NOT_NULL", path: "" }])}>{c.addCondition}</Button>
    </>}
    {depth === 0 && <Button type="button" size="sm" variant="outline" onClick={() => change(undefined)}>{c.clear}</Button>}
  </fieldset>;
}
